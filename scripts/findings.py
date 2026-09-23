#!/usr/bin/env -S uv run --script
# agent-kit-sha256: 51c61f27df5573ca72c1a19d44dfec72ad21765bfb04964812baa1e0a2f16353
# /// script
# requires-python = ">=3.14"
# ///
# The interpreter is declared here, not chosen by the caller.
# ~/.claude/references/python-interpreter-contract.md is the rule and the reasoning.
"""Query and validate the findings ledger (``tasks/findings.md``).

The ledger is an **append-only log**; the work queue is derived from it here. A
finding's position in the file therefore carries no meaning, which is what lets a
run append wherever it happens to be writing without anyone having to file it "in
the right place".

Grouping is by ``Root`` only; findings without a root are singletons. A shared root cause
crosses area boundaries — two findings can share no file and sit in different
areas yet be one defect. Picking them up together means one interview instead of
two, and removes the case where fixing the second undoes the first.

The contract — field meanings, ranking, the decision discipline — is
``~/.claude/references/findings-ledger-contract.md``. **This script is deliberately
identical across projects.** Everything project-specific is read from the ledger
or the project manifest: the area vocabulary from the markdown header, or — for a
Controller-generated JSON export — from ``.project.json`` ``findings.areas``; the
governing decisions from the sibling ``decisions.md``. Nothing project-specific
may be added below.

Subcommands
-----------
``check``        validate every header and the sibling decisions ledger's ids;
                 exit 1 on any violation
``list``         print findings, optionally filtered
``summary``      print counts, who is waiting, and what is drainable
``next``         print the highest-ranked pickable cluster, the decisions governing it,
                 and separately the ones merely touching its files
``related``      print findings sharing an area or naming the same files
``file``         publish one new finding entry through the inbox spool
``merge-inbox``  fold published findings from the inbox into the ledger
``finalize-claims`` release prepared claims whose entries are proven in ``HEAD``
``decisions``    print Felix-facing blockers waiting on Felix
``apply-answers`` fold answers back in and unblock what was decided
``answer``       publish one answer atomically through the answers spool
``commit-ledger`` commit an expected ledger snapshot by its exact bytes
``drain-status`` exit 0 if a drain holds this repo's lock, 1 otherwise
``set-header``  mutate selected fields of one finding header
``annotate``    append file contents to one finding entry
``record-decision`` append decisions through the decisions ledger lock
``set-trailer`` set decision supersession references, adding the trailer where an
                 entry predates it, and refresh their covering receipt
``merge-driver`` git merge driver for the two ledgers (``%O %A %B %P``); appends merge
                 block by block, everything else falls back to ``git merge-file``
"""

from __future__ import annotations

import argparse
import errno
import fcntl
import hashlib
import io
import itertools
import json
import os
import re
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time
from collections.abc import Callable, Collection, Iterator
from contextlib import contextmanager, redirect_stderr, redirect_stdout, suppress
from dataclasses import dataclass, field, replace
from datetime import datetime
from enum import Enum, auto
from pathlib import Path, PurePosixPath
from typing import Literal, cast

# Named so the formatter cannot rewrite them. `ruff format` at target-version py314
# strips redundant parentheses from an explicit `except (A, B):` tuple literal, and
# the parenthesized form is what a pre-3.14 interpreter needs to parse this file
# (`d-20260830-26`). A name is a single expression with nothing to strip.
_READ_ERRORS = (OSError, UnicodeError)

# Keep one failed breadcrumb report, including its final newline, within this
# fixed width so a helper cannot flood the drain's stderr. The beginning of the
# cause is retained because it is usually the useful part of the diagnostic.
DRAIN_BREADCRUMB_DIAGNOSTIC_MAX_CHARS = 4096
DRAIN_BREADCRUMB_FAILURE_MARKER = "breadcrumb not written:"
DRAIN_BREADCRUMB_TRUNCATION_MARKER = "... [truncated]"
_DRAIN_BREADCRUMB_ERRORS = (OSError, subprocess.SubprocessError)


def _probe_git_toplevel() -> tuple[Path | None, str]:
    """Read-only `git rev-parse --show-toplevel` of the current working directory.

    Never writes. Never falls back to ``__file__`` or cwd. The stderr string is
    what a verb prints inside ``REFUSING: not inside a git checkout (...)``.
    """
    git = shutil.which("git") or "/usr/bin/git"
    try:
        completed = subprocess.run(
            [git, "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as exc:
        return None, str(exc)
    err = (completed.stderr or completed.stdout or "").strip()
    if completed.returncode != 0:
        return None, err or "git rev-parse --show-toplevel failed"
    text = completed.stdout.strip()
    if not text:
        return None, err or "git rev-parse --show-toplevel returned empty"
    return Path(text), ""

# Length is part of the cross-language protocol: `drain-findings.sh` truncates to
# the same width. Changing it here alone renames the lock for one side only.
DRAIN_LOCK_KEY_CHARS = 8


def _lock_for_root(root: Path) -> Path:
    """Consumer-lock path for one git toplevel, matching drain-lock-name.sh."""
    key = hashlib.sha256(str(root).encode()).hexdigest()[:DRAIN_LOCK_KEY_CHARS]
    return Path.home() / ".claude" / f"drain-lock-{root.name}-{key}"


def _require_git_toplevel() -> Path:
    """Verb-time root. Exit 3 outside a checkout; never fall back."""
    root, err = _probe_git_toplevel()
    if root is None:
        print(f"REFUSING: not inside a git checkout ({err})", file=sys.stderr)
        raise SystemExit(3)
    return root


_IMPORT_ROOT, _IMPORT_GIT_ERR = _probe_git_toplevel()
# Import-time paths exist so tests that inspect the module constants, and
# argparse defaults that production CLI calls omit, still resolve. Verbs
# re-derive from the cwd's git toplevel at execution; they never use __file__.
REPO_ROOT: Path | None = _IMPORT_ROOT
LEDGER = (
    REPO_ROOT / "tasks" / "findings.md"
    if REPO_ROOT is not None
    else Path("tasks") / "findings.md"
)
DECISIONS = (
    REPO_ROOT / "tasks" / "decisions.md"
    if REPO_ROOT is not None
    else Path("tasks") / "decisions.md"
)
# Git-ignored spool for findings filed through `file`. Separate atomically
# published files prevent two filing sessions from overwriting each other while
# the entry waits for its merge.
INBOX = (
    REPO_ROOT / "tasks" / "findings-inbox"
    if REPO_ROOT is not None
    else Path("tasks") / "findings-inbox"
)
LEGACY_INBOX = (
    REPO_ROOT / "tasks" / "findings-inbox.md"
    if REPO_ROOT is not None
    else Path("tasks") / "findings-inbox.md"
)
CLAIM = (
    REPO_ROOT / "tasks" / "findings-inbox.claim"
    if REPO_ROOT is not None
    else Path("tasks") / "findings-inbox.claim"
)
# A Controller-enrolled checkout regenerates ``tasks/findings.md`` from its SQLite
# ledger as a fenced JSON payload rather than the ``###`` entry contract. That
# form is read-only here: the Controller owns every write to it.
PROJECT_MANIFEST_NAME = ".project.json"
CONTROLLER_EXPORT_MARKERS = (
    "Generated from the authoritative SQLite ledger",
    "findings-generation:",
)
# The markers are only honoured in the file's head, so a markdown finding that
# quotes one of them further down cannot switch the parser.
CONTROLLER_EXPORT_HEAD_CHARS = 4096
# The section every Controller finding reports: the export has no ``## `` headings.
CONTROLLER_EXPORT_SECTION = "controller-export"
CONTROLLER_JSON_FENCE_RE = re.compile(r"```json[ \t]*\n(?P<body>.*?)```", re.S)
# A filer publishes first and only then checks this lock. The environment override
# keeps that branch testable without ever consulting the real drain lock.
DRAIN_LOCK_ENV = "FINDINGS_DRAIN_LOCK"


def _bounded_drain_breadcrumb_failure(context: str, cause: object = "") -> str:
    """Return one bounded, newline-terminated breadcrumb failure diagnostic."""
    diagnostic = context
    if cause:
        diagnostic += f": {cause}"
    if not diagnostic.endswith("\n"):
        diagnostic += "\n"
    if len(diagnostic) <= DRAIN_BREADCRUMB_DIAGNOSTIC_MAX_CHARS:
        return diagnostic
    suffix = DRAIN_BREADCRUMB_TRUNCATION_MARKER + "\n"
    available = DRAIN_BREADCRUMB_DIAGNOSTIC_MAX_CHARS - len(suffix)
    return diagnostic[:available] + suffix


def append_drain_breadcrumb(label: str, detail: str) -> None:
    step_file = os.environ.get("DRAIN_STEP_FILE")
    if not step_file:
        return
    library = os.environ.get(
        "DRAIN_BREADCRUMB_LIB",
        str(Path.home() / ".claude" / "scripts" / "lib" / "drain-breadcrumb.sh"),
    )
    try:
        result = subprocess.run(
            [
                "bash",
                "-c",
                'source "$1" && drain_breadcrumb "$2" "$3"',
                "_",
                library,
                label,
                detail,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        context = (
            f"{DRAIN_BREADCRUMB_FAILURE_MARKER} {step_file} "
            f"(helper {library}, exit {exc.returncode})"
        )
        sys.stderr.write(_bounded_drain_breadcrumb_failure(context, exc.stderr))
    except _DRAIN_BREADCRUMB_ERRORS as exc:
        context = (
            f"{DRAIN_BREADCRUMB_FAILURE_MARKER} {step_file} "
            f"(helper {library})"
        )
        sys.stderr.write(_bounded_drain_breadcrumb_failure(context, exc))
    else:
        if result.stderr:
            if DRAIN_BREADCRUMB_FAILURE_MARKER in result.stderr:
                context = (
                    f"{DRAIN_BREADCRUMB_FAILURE_MARKER} {step_file} "
                    f"(helper {library})"
                )
                sys.stderr.write(
                    _bounded_drain_breadcrumb_failure(
                        context,
                        result.stderr.replace(DRAIN_BREADCRUMB_FAILURE_MARKER, "", 1),
                    )
                )
            else:
                sys.stderr.write(result.stderr)


# Keyed by the RESOLVED PATH, not the basename. Two checkouts of one repo — a
# worktree, a /tmp clone — used to share one `drain-lock-<repo>` name, so a
# drain in either made a filer in the other believe its entry would be merged by
# a drain that reads a different ledger: the entry then waits in a spool with no
# consumer, silently. Liveness checking does not help, because the pid IS alive.
# The basename stays in the name so `rm ~/.claude/drain-lock-<repo>-*` still
# works and the file is still recognisable by eye.
# `drain-findings.sh` computes the same suffix and the two MUST agree —
# `test_drain_lock_name_matches_the_drain_script` proves it rather than trusting
# two implementations of one hash.
DEFAULT_DRAIN_LOCK = (
    _lock_for_root(REPO_ROOT)
    if REPO_ROOT is not None
    else Path.home() / ".claude" / "drain-lock-unknown"
)
# Felix's answers to parked decisions. A separate spool from INBOX because the two
# do opposite things: the inbox appends whole new entries, an answer *edits* an
# existing one. Same unique-name plus exclusive-publish discipline (`ln` in
# `/decide`, `os.link` here), same "drain applies it between clusters" timing,
# so an answer given mid-run re-enters that run.
ANSWERS = (
    REPO_ROOT / "tasks" / "findings-answers"
    if REPO_ROOT is not None
    else Path("tasks") / "findings-answers"
)

# Which Felix-facing blockers have already been announced. Git-ignored: it is
# machine state about who has been told what, not part of the ledger's record.
ANNOUNCED_STATE = ".decisions-announced.json"
# The desktop notifier shared with Codex and the Claude hooks
# (~/.local/bin/notify). Reused whole — nothing here draws a notification
# itself. Not found means no announcement, never an error: another developer's
# checkout has no reason to carry Felix's notifier.
NOTIFIER = "notify"
# Matches APPLICATIONS in `notify`, which keys the desktop entry off the title,
# so a parked Felix-facing blocker looks like every other Claude notification.
NOTIFY_APP = "Claude Code"
# Matches Claude/Grok session toasts (`EXPIRE_MS = 30000`). 0 is DBus "never
# expire" and is wrong here: a park ping is the same class as a finished turn.
NOTIFY_DURATION_MS = 30000
# Overlay copies on other screens keep `notify show` alive for the duration.
# The subprocess timeout must outlast that wait, or a successful post is killed
# and left unrecorded, so the next named `decisions` toasts again.
NOTIFY_POST_TIMEOUT_S = (NOTIFY_DURATION_MS + 999) // 1000 + 2
# Lets the waiter outlast the overlay-length post timeout plus the state write.
NOTIFY_STATE_WRITE_GRACE_S = 5.0
NOTIFY_TITLE_CHARS = 90
# Ledger writers may wait for the exact-byte pre-commit hook and its termination
# grace period. Keep this above both those bounds so a hook never races another
# writer's read or worktree restoration.
LEDGER_LOCK_WAIT_SECONDS = 660.0
# The merge-driver config lock fences only the short `git config` repair in a
# shared Git common directory; it is never held across a hook, so contention is
# reported promptly instead of delaying a cheap read command.
MERGE_DRIVER_CONFIG_LOCK_WAIT_SECONDS = 1.0
LEDGER_LOCK_RETRY_INTERVAL_SECONDS = 0.05
DRAIN_LOCK_READ_BYTES = 4096
# What `drain-findings.sh` writes into the consumer lock once it has released the
# flock. With the flock already free, a decimal marker would read as a stale drain
# rather than a finished one, so the marker distinguishes "finished" from "died".
DRAIN_LOCK_RELEASED_MARKER = "released"
# `_unique_suffix` cannot repeat within a process, so a second attempt is not this
# process colliding with itself. It recovers from a name another process already
# took, or from a filesystem that refused the link. Bounded rather than `while
# True` so a persistent collision errors out instead of hanging in a filing session.
PUBLISH_NAME_ATTEMPTS = 8
# A publisher must never wait forever behind a crashed or wedged writer. The
# lock is a short fence around rename/link and claim cleanup, so callers report a
# retryable refusal when this bounded window expires.
PUBLISH_LOCK_TIMEOUT_SECONDS = 30.0
RECEIPT_DIGEST_HEX_LENGTH = 64
# A completed `.part` is adopted only after this grace period. A live publisher
# keeps the publish lock, so the grace protects only writers from older versions
# that did not use that fence.
ORPHAN_PART_GRACE_SECONDS = 60.0
# Scratch files are intentionally retained for a while because one candidate
# writer remains outside the ledger lock. The bound is explicit: a writer paused
# for an hour is outside the supported write window, and a swept candidate makes
# the failed write visible rather than silently losing it.
SCRATCH_GRACE_SECONDS = 3600.0
_GENERATED_SCRATCH_RE = re.compile(r"^(?P<target>.+)\.(?:tmp|candidate)-\d+-\d+-\d+$")
_GENERATED_INBOX_PART_RE = re.compile(r"^\.\d{8}-\d{6}-\d+-\d+-\d+\.part$")
MERGE_INTENT_NAME = ".merge-intent.json"
# Set by the test harness. `decisions` is a query, and a query run in a suite
# must not put real popups on Felix's screen.
NOTIFY_OFF_ENV = "FINDINGS_NO_NOTIFY"

STATUSES = frozenset({"open", "handled", "rejected"})
ENTRIES = frozenset({"inline", "lens", "build"})
ENTRY_RANK = {"inline": 0, "lens": 1, "build": 2}

# One grammar for a finding id, so the validator that rejects a malformed one and
# the allocator that mints a new one cannot drift apart.
ID_DATE_LEN = 8
ID_SEQ_DIGITS = 2
ID_SEQ_MAX = 10**ID_SEQ_DIGITS - 1
ID_RE = re.compile(rf"^f-(\d{{{ID_DATE_LEN}}})-\d{{{ID_SEQ_DIGITS}}}$")
# What a filing session writes into the spool instead of choosing an id. See
# `assign_pending_ids` for why choosing one itself cannot be made race-free.
PENDING_ID = "f-PENDING"
PENDING_DECISION_ID = "d-PENDING"
LEDGER_META_PREFIX = "<!-- ledger-meta "
LEDGER_META_SUFFIX = " -->"
LEDGER_META_VERSION = 1
MUTATION_RECEIPT_KIND = "mutation-receipt"
CITATION_CONTEXT_KIND = "citation-context"
RECEIPT_PLACEHOLDER = "<!-- ledger-meta receipt-placeholder -->"
# The git merge driver for the two append-only ledgers. `.gitattributes` names
# the driver; the command can only live in the clone's own `.git/config`, so
# `check` installs it (`ensure_merge_driver`) and a fresh clone needs no hand.
MERGE_DRIVER_NAME = "ledger-append"
MERGE_DRIVER_COMMAND = "./scripts/findings.py merge-driver %O %A %B %P"
MERGE_DRIVER_DESCRIPTION = "append-only ledger merge (findings.py merge-driver)"
MERGE_DRIVER_CONFIG_LOCK_NAME = "findings-merge-driver-config.lock"
MERGE_DRIVER_LEDGERS = {
    "tasks/findings.md": "findings",
    "tasks/decisions.md": "decisions",
}
# A request id has one required first character plus up to 127 more.
REQUEST_ID_MAX_LENGTH = 128
REQUEST_ID_RE = re.compile(
    rf"^[A-Za-z0-9][A-Za-z0-9._-]{{0,{REQUEST_ID_MAX_LENGTH - 1}}}$"
)
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
# The decisions spool uses the same pending-token shape as the findings spool.
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEADER_RE = re.compile(
    r"^\* \*\*ID:\*\* (?P<id>\S+) · "
    r"\*\*Status:\*\* (?P<status>\S+) · "
    r"\*\*Area:\*\* (?P<area>\S+) · "
    r"\*\*Root:\*\* (?P<root>\S+) · "
    r"\*\*Entry:\*\* (?P<entry>\S+) · "
    r"\*\*Blocked:\*\* (?P<blocked>\S+)\s*$"
)
HEADER_MARKER = "**ID:**"
ENTRY_MARKER = "### "
# Bold-label header keys in the form already used for Area vocabulary. Tooling
# areas is optional; a missing line means no finding is tooling.
_BOLD_LABEL_RE_TEMPLATE = r"\*\*{label}:\*\*(?P<body>.+?)(?:\n\n|\Z)"
VOCAB_RE = re.compile(_BOLD_LABEL_RE_TEMPLATE.format(label=r"Area vocabulary"), re.S)
TOOLING_AREAS_RE = re.compile(
    _BOLD_LABEL_RE_TEMPLATE.format(label=r"Tooling areas"), re.S
)
PLAN_ADOPTED_COLUMN = "plan_adopted_per_round"
PLAN_ADOPTED_NOT_RECORDED = "not-recorded"
# Labelled counts `r1=6 r2=2 r3=0`: sequential rN from 1, non-negative ints.
_PLAN_ADOPTED_TOKEN_RE = re.compile(r"^r([1-9]\d*)=(\d+)$")
NEXT_OUTCOME_CLUSTER = "cluster"
NEXT_OUTCOME_EMPTY = "empty"
NEXT_OUTCOME_BLOCKED_ONLY = "blocked-only"
# Every CLI verb is classified once so plan-only mode cannot silently miss a
# newly added writer. ``file`` is guarded except for its read-only ``--status``
# form and its explicitly authorised planner spool form.
COMMAND_CLASSIFICATION = {
    "check": "read-only",
    "drain-status": "read-only",
    "list": "read-only",
    "summary": "read-only",
    "next": "read-only",
    "related": "read-only",
    "decisions": "read-only",
    "file": "guarded",
    "merge-inbox": "guarded",
    "finalize-claims": "guarded",
    "apply-answers": "guarded",
    "answer": "guarded",
    "commit-ledger": "guarded",
    "set-header": "guarded",
    "annotate": "guarded",
    "record-decision": "guarded",
    "set-trailer": "guarded",
    "merge-driver": "guarded",
}
PLAN_ONLY_ENV = "DRAIN_PLAN_ONLY"
PLAN_INBOX_ENV = "DRAIN_PLAN_INBOX"
# `*`, `-` and `+` are all list bullets in Markdown. Detection and rendering
# must agree on the accepted bullet class or a gated entry can be reported as
# having no Sentry short-ID.
_BULLET = r"[*+-]"
BULLET_LINE_RE = re.compile(rf"^[ \t]*{_BULLET}[ \t]+\S")
CONTINUATION_LINE_RE = re.compile(r"^[ \t]+\S")
REJECTED_RE = re.compile(
    rf"^[ \t]*{_BULLET}[ \t]+\*\*Why rejected:\*\*[ \t]*(?P<reason>\S.*)",
    re.MULTILINE,
)
APPROVED_RE = re.compile(
    rf"^[ \t]*{_BULLET}[ \t]+\*\*Approved:\*\*[ \t]*", re.MULTILINE
)
SENTRY_RE = re.compile(rf"^[ \t]*{_BULLET}[ \t]+\*\*Sentry:\*\*[ \t]*", re.MULTILINE)
SENTRY_ORIGIN_RE = re.compile(
    rf"^[ \t]*{_BULLET}[ \t]+\*\*Origin:\*\*[ \t]+sentry-intake[ \t]*$",
    re.MULTILINE,
)
SENTRY_CONTEXT_RE = re.compile(
    rf"^[ \t]*{_BULLET}[ \t]+\*\*(?:Where|Defect):\*\*[ \t]*", re.MULTILINE
)
_VERIFIER_ACTOR_PATTERN = (
    r"automated Sentry-origin verifier \(codex, run [A-Za-z0-9._-]+, "
    r"body (?P<body>[0-9a-f]{64})\)"
)
VERIFIER_ACTOR_FULL_RE = re.compile(_VERIFIER_ACTOR_PATTERN)
VERIFIER_EVIDENCE_RE = re.compile(
    rf"^(?P<actor>{_VERIFIER_ACTOR_PATTERN}):[ \t]*(?P<reason>\S.*)$"
)
VERIFIER_DECISION_RE = re.compile(
    rf"^(?P<kind>approve|reject) — (?P<actor>{_VERIFIER_ACTOR_PATTERN}):[ \t]*\S"
)


def _body_is_sentry_origin(body: str) -> bool:
    """Return whether an unfenced body carries either Sentry-origin marker."""
    return (
        SENTRY_RE.search(body) is not None or SENTRY_ORIGIN_RE.search(body) is not None
    )


# A finding parked on Felix has to carry the brief that makes it answerable away
# from the session that parked it. Without this, answering days later means
# re-deriving an investigation that already happened — the same waste as
# restarting a crashed cluster instead of resuming it.
#
# All four use the shared `_BULLET` grammar rather than a hand-written `[*-]`.
# They carried their own copy until 2026-09-01, which silently rejected a
# CommonMark `+ ` bullet -- and because every locked mutation validates the
# whole ledger, one such entry would have refused every later write to it.
DECISION_BRIEF_RE = re.compile(
    rf"^[ \t]*{_BULLET}[ \t]+\*\*Decision:\*\*[ \t]*(?P<question>\S.*)",
    re.MULTILINE,
)
RECOMMEND_RE = re.compile(
    rf"^[ \t]*{_BULLET}[ \t]+\*\*Recommend:\*\*[ \t]*(?P<choice>\S.*)",
    re.MULTILINE,
)
# The parking session's id, so `/decide` can mine the transcript that holds the
# investigation instead of re-deriving it. Required by the contract and, until
# now, by nothing that checked.
SESSION_RE = re.compile(
    rf"^[ \t]*{_BULLET}[ \t]+\*\*Session:\*\*[ \t]*(?P<sid>\S.*)",
    re.MULTILINE,
)
# The gate that decides whether the question is Felix's at all: what does a user
# of the app see, get, pay or get promised differently depending on the answer?
# A technical question never parks, however consequential — the session holding
# the investigation is the one positioned to apply the optimal-long-term rule.
#
# This is enforced rather than merely written down because the failure mode is
# not a badly written park, it is a *well* written one. `f-20260824-21` parked a
# choice between npx, a devDependency and a hand-written allowlist behind a
# complete, well-argued brief; Felix: "This is purely technical stuff. I don't
# understand what you're talking about. I just enter your recommendations."
# `Entry: build` was 691 of 1137 filed findings on 2026-09-09, 60 % of the queue,
# because the contract's "when uncertain, write `build`" costs nothing to assert
# and needs evidence to undo. The counter-pressure is the same shape as the
# product-impact gate below: a bullet the filing session has to write. Uncertainty
# that cannot name its design question is not a design question, it is an unread
# file, and the finding belongs at `inline` or `lens`.
#
# Filing-time only, deliberately. It is NOT part of `validate`, which
# `findings.py check` runs over the whole ledger and every project gate calls:
# 690 existing `build` entries across four repositories were filed before this
# rule and would redden every gate at once. The rule is about what a filer was
# asked, and no existing entry's filer was asked.
OPEN_QUESTION_RE = re.compile(
    rf"^[ \t]*{_BULLET}[ \t]+\*\*Open question:\*\*[ \t]*(?P<question>\S.*)",
    re.MULTILINE,
)
OPEN_QUESTION_REFUSAL = (
    "{where}: `Entry: build` needs an '**Open question:**' bullet naming the design "
    "question the plan has to answer. If the question cannot be written, file it as "
    "`inline` or `lens`."
)
# Brief quality is not what makes a question his, so no amount of prose in the
# contract catches this — only a bullet the parking session has to write and
# cannot write honestly for a technical question.
PRODUCT_IMPACT_RE = re.compile(
    rf"^[ \t]*{_BULLET}[ \t]+\*\*Product impact:\*\*[ \t]*(?P<impact>\S.*)",
    re.MULTILINE,
)
# A bullet that exists and says nothing satisfies the letter of the gate while
# defeating its purpose, and the phrasings that do it are few and predictable:
# a run that has just been told it must name a product impact, and has none,
# writes exactly one of these. The validator cannot judge honesty and does not
# try -- it refuses the grossly vacuous forms, which is the difference between
# a gate an agent must think past and one it can type past.
VACUOUS_IMPACT_RE = re.compile(
    r"^(?:"
    r"[\s.,()\[\]\-–—…;:!?*_`\"']*"  # punctuation-only, e.g. "." or "--" or "()"
    r"|n/?a\b.*"
    r"|none\b.*"
    r"|nothing\b.*"
    r"|unknown\b.*"
    r"|tbd\b.*"
    r"|(?:no|zero)\s+(?:user|product|customer|visible|direct)\b.*"
    r"|no\s+impact\b.*"
    r"|no\s+(?:users?|teachers?|customers?|one)\b.*"
    r"|(?:purely|only|just)\s+(?:a\s+)?technical\b.*"
    r"|technical\s+(?:only|choice|decision)\b.*"
    r"|(?:this\s+)?(?:is\s+)?(?:a\s+)?technical\b.*"
    # Anchored at the START of the bullet, deliberately, where the sibling
    # matched them anywhere in it. Matching anywhere refuses a legitimate
    # CONTRAST -- "(a) no user-visible change; (b) the teacher sees a warning"
    # names a real product impact and is exactly the sentence this gate wants.
    # Refusing it is the harmful direction: the failure message tells the author
    # the question is technical and should be unparked, so an over-broad rule
    # here pushes a genuine product question off Felix's list.
    r"|(?:there\s+is\s+)?no\s+(?:user|product|customer)[- ]visible\b.*"
    r"|nothing\s+(?:a\s+)?users?\s+(?:can\s+)?(?:see|observe|notice)\b.*"
    r"|(?:this\s+(?:is|would\s+be)\s+)?invisible\s+to\s+(?:the\s+|every\s+|all\s+)?users?\b.*"
    r")$",
    re.IGNORECASE | re.DOTALL,
)
# Slugs naming the waits that depend on Felix. Answerable blockers carry a
# question; other `felix-*` values name preconditions he must clear.
FELIX_DECISION = "felix-decision"
# The old spelling remains a read alias for already filed entries. New writes use
# SENTRY_UNVERIFIED so this trust boundary is not mistaken for a Felix decision.
SENTRY_UNVERIFIED = "sentry-unverified"
FELIX_SENTRY_ORIGIN = "felix-sentry-origin"
SENTRY_VERIFIER_BLOCKERS = frozenset({SENTRY_UNVERIFIED, FELIX_SENTRY_ORIGIN})
# The derived verification states that make a finding automated-verification
# work rather than Felix's. It is its own set because the state is derived from
# the body, not from the `Blocked` slug, and both the summary classifier and the
# drain read the same two names.
SENTRY_VERIFICATION_STATES = frozenset({"unverified", "drifted"})
ANSWERABLE_BLOCKERS = frozenset({FELIX_DECISION})
# The `summary --json` contract. Versioned because the drain's preflight and
# the cross-repository view both read it from another process; a shape change
# that both ends learned to expect the way this one is spelled would otherwise
# be indistinguishable from a payload that merely happened to parse.
FINDINGS_SUMMARY_SCHEMA = "findings-summary/1"
DECIDED_MARKER = "**Decision made:**"


# Every marker only the answer route may write. `**Why rejected:**` is legal
# body text on an ordinary finding and answer-route-only on a Sentry-origin one,
# so the helper below scopes it; claim recovery reads the whole tuple, because a
# Sentry approval or rejection is landed evidence exactly as a decision is.
ANSWER_EVIDENCE_MARKERS = (
    (
        re.compile(rf"^[ \t]*{_BULLET}[ \t]+\*\*Approved:\*\*[ \t]*", re.MULTILINE),
        "**Approved:**",
    ),
    (
        re.compile(
            rf"^[ \t]*{_BULLET}[ \t]+{re.escape(DECIDED_MARKER)}[ \t]*",
            re.MULTILINE,
        ),
        DECIDED_MARKER,
    ),
    (
        re.compile(
            rf"^[ \t]*{_BULLET}[ \t]+\*\*Why rejected:\*\*[ \t]*",
            re.MULTILINE,
        ),
        "**Why rejected:**",
    ),
)
ANSWER_EVIDENCE_MARKER_LINE_RE = re.compile(
    rf"^[ \t]*{_BULLET}[ \t]+\*\*(?:Approved|Why rejected|Decision made):\*\*"
)
SENTRY_ONLY_ANSWER_EVIDENCE = "**Why rejected:**"

# The answer spool has a smaller header than the findings ledger. Reusing
# HEADER_RE would silently reject the actual answer shape; anchoring this grammar
# also keeps ids in prose or fenced examples from becoming answer targets.
ANSWER_ID_RE = re.compile(
    rf"^[ \t]*{_BULLET}[ \t]+\*\*ID:\*\*[ \t]+"
    rf"(?P<id>f-\d{{{ID_DATE_LEN}}}-\d{{{ID_SEQ_DIGITS}}})(?=[ \t]*(?:·|$))",
    re.MULTILINE,
)
DECISION_BULLET_RE = re.compile(
    rf"^[ \t]*{_BULLET}[ \t]+"
    rf"(?P<decision>{re.escape(DECIDED_MARKER)}.*)$"
)


def _answer_evidence_marker(body: str, *, sentry_origin: bool) -> str | None:
    """Name answer-route-only evidence in ``body``, if it carries any."""
    for pattern, marker in ANSWER_EVIDENCE_MARKERS:
        if marker == SENTRY_ONLY_ANSWER_EVIDENCE and not sentry_origin:
            continue
        if pattern.search(body) is not None:
            return marker
    return None


# A thematic break may contain spaces between its three or more matching markers.
HRULE_RE = re.compile(r" {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$")
BLOCKER_NONE = "none"
BLOCKER_ANSWERABLE = "answerable"
BLOCKER_PRECONDITION = "precondition"
BLOCKER_EXTERNAL = "external"
BLOCKER_VERIFIER = "verifier"
BLOCKER_CLASSES = frozenset(
    {
        BLOCKER_NONE,
        BLOCKER_ANSWERABLE,
        BLOCKER_PRECONDITION,
        BLOCKER_EXTERNAL,
        BLOCKER_VERIFIER,
    }
)


def classify_blocker(blocked: str) -> str:
    """Classify a blocker without enumerating future Felix-only preconditions."""
    if blocked == BLOCKER_NONE:
        blocker_class = BLOCKER_NONE
    elif blocked in SENTRY_VERIFIER_BLOCKERS:
        blocker_class = BLOCKER_VERIFIER
    elif blocked in ANSWERABLE_BLOCKERS:
        blocker_class = BLOCKER_ANSWERABLE
    elif blocked.startswith("felix-"):
        blocker_class = BLOCKER_PRECONDITION
    else:
        blocker_class = BLOCKER_EXTERNAL
    assert blocker_class in BLOCKER_CLASSES
    return blocker_class


# Any backtick-quoted token that looks like a path or a filename.
# Brackets and parentheses are in the class for Next.js App Router route groups and
# dynamic segments (`(dashboard)`, `[id]`, `[...slug]`): without them
# `frontend/web/src/app/(dashboard)/puzzle/page.tsx` matched NOTHING at all -- the
# scan stopped dead at the `(` and no shorter match could reach the closing
# backtick. Every route-group path in the ledger was invisible to the duplicate
# check and to decision matching, which is most of this repo's frontend surface.
PATH_RE = re.compile(r"`([A-Za-z0-9_./()\[\]-]*[A-Za-z0-9_)\]-])(?::[\d\-]+)?`")
FENCED_LINE_NUMBER_RE = re.compile(r":\d+(?:-\d+)?$")
FENCED_URL_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*://")
FENCED_TOKEN_LEADING_CHARS = "\"'`([{<*"
FENCED_TOKEN_TRAILING_CHARS = "\"'`.,;:!?)]}>*"
DECISION_RE = re.compile(r"^ {0,3}### (?P<id>d-\d{8}-\d{2}) — (?P<question>.+)$")
# Pending headings are recognized separately until the locked allocator mints an id.
DECISION_PENDING_RE = re.compile(r"^ {0,3}### (?P<id>d-PENDING) — (?P<question>.+)$")
# Match the complete would-be owner token before validating it as a slug. Keeping
# punctuation and additional colons in that token prevents a malformed owner such
# as ``repo.slug:`` or ``repo:slug:`` from being reinterpreted at a valid suffix.
QUALIFIER_TOKEN_RE = r"[^\s`\"'“”‘’()\[\]{}<>,;|*–—]+"
QUALIFIER_LEFT_BOUNDARY_RE = r"(?<![^\s`\"'“”‘’()\[\]{}<>,;|*–—])"
QUALIFIED_DECISION_RE = re.compile(
    QUALIFIER_LEFT_BOUNDARY_RE + rf"(?:(?P<owner>{QUALIFIER_TOKEN_RE}):)?"
    r"(?P<id>d-\d{8}-\d{2})(?![A-Za-z0-9_-])"
)
QUALIFIED_FINDING_RE = re.compile(
    QUALIFIER_LEFT_BOUNDARY_RE + rf"(?:(?P<owner>{QUALIFIER_TOKEN_RE}):)?"
    r"(?P<id>f-\d{8}-\d{2})(?![A-Za-z0-9_-])"
)
INLINE_REFERENCE_RE = re.compile(
    r"\s*(?:(?:(?:[a-z0-9]+(?:-[a-z0-9]+)*):)?"
    r"[df]-\d{8}-\d{2}|-)\s*"
)
# Deliberately looser than the strict form above: it has to CATCH a near-miss
# so validation can reject it. Requiring a digit after `d-` excludes the format
# template in the decisions ledger's own header.
DECISION_MARKER_RE = re.compile(r"^ {0,3}#+\s*d-\d")
# Clause 1 of `tasks/decisions.md` requires every recorded decision to preserve
# the question, chosen option, rejected option, and reason. The ledger contains
# both bare and bulleted forms, and both punctuation forms are established in
# its existing entries.
DECISION_CLAUSE_ONE_FIELDS = ("Question", "Chosen", "Rejected", "Reason")
DECISION_FIELD_RE = {
    field: re.compile(
        rf"^[ \t]*(?:{_BULLET}[ \t]+)?\*\*{field}(?:\.|:)\*\*[ \t]*\S",
        re.MULTILINE,
    )
    for field in DECISION_CLAUSE_ONE_FIELDS
}
GOVERNS_RE = re.compile(r"\*\*Governs:\*\*(?P<ids>.+)")
DECISION_REFERENCE_PATTERN = r"(?:(?:[a-z0-9]+(?:-[a-z0-9]+)*):)?d-\d{8}-\d{2}"
QUOTED_DECISION_REFERENCE_PATTERN = (
    rf"(?:`{DECISION_REFERENCE_PATTERN}`|{DECISION_REFERENCE_PATTERN})"
)
SUPERSEDED_BY_RE = re.compile(
    r"\*\*Superseded-by:\*\*[ \t]*"
    rf"(?P<refs>{QUOTED_DECISION_REFERENCE_PATTERN}"
    rf"(?:[ \t]*,[ \t]*{QUOTED_DECISION_REFERENCE_PATTERN})*|`-`|-)"
    r"[.,;:!?]?(?:\s*$|\s+·)"
)
# Deliberately looser than the strict form above: it has to CATCH a near-miss
# so validation can reject it. A trailer with an unparseable id must not vanish
# from the ledger's validation output just because it is not a link. The second
# branch catches a case-insensitive supersed-ish by-marker and a decision id
# inside one bold run, including a marker with the id inside the bold text.
SUPERSEDED_BY_MARKER_RE = re.compile(
    r"\*\*Superseded-by:\*\*"
    r"|\*\*(?=[^*\n]*d-\d{8}-\d{2}[^*\n]*\*\*)"
    r"[^*\n]*supersed(?:e|ed)?[- ]by\b[^*\n]*\*\*",
    re.IGNORECASE,
)
# Deliberately looser than the strict form below: it has to CATCH a near-miss
# so validation can reject it. Anchored at column 0 it would silently ignore an
# indented bullet, and the link would simply not exist with nothing said.
GOVERNED_BY_MARKER_RE = re.compile(r"^\s*[*-]\s+\*\*Governed-by:\*\*")
GOVERNED_BY_RE = re.compile(
    r"^\* \*\*Governed-by:\*\* "
    rf"(?P<ids>{DECISION_REFERENCE_PATTERN}"
    rf"(?:,\s*{DECISION_REFERENCE_PATTERN})*)\s*$"
)


@dataclass(frozen=True)
class LedgerMeta:
    line: int
    data: dict[str, object]


class DuplicateLedgerMetadataKey(ValueError):
    """A ledger metadata object repeated one JSON key."""


@dataclass(frozen=True)
class CitationOccurrence:
    source: str
    entry: str
    cited_id: str
    owner: str | None
    line: int
    line_text: str
    occurrence: int


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_text(value: str) -> str:
    return _sha256_bytes(value.encode("utf-8"))


def _metadata_line(data: dict[str, object]) -> str:
    return LEDGER_META_PREFIX + json.dumps(
        data, ensure_ascii=True, sort_keys=True, separators=(",", ":")
    ) + LEDGER_META_SUFFIX


def _metadata_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    """Build a metadata object while rejecting ambiguous duplicate JSON keys."""
    data: dict[str, object] = {}
    for key, value in pairs:
        if key in data:
            raise DuplicateLedgerMetadataKey
        data[key] = value
    return data


def _has_ledger_meta_comment(line: str) -> bool:
    """Recognize reserved metadata comment syntax without banning prose names."""
    marker = line.find("<!--")
    if marker < 0:
        return False
    remainder = line[marker + 4 :].lstrip()
    name = "ledger-meta"
    return remainder.startswith(name) and (
        len(remainder) == len(name)
        or not (remainder[len(name)].isalnum() or remainder[len(name)] in "_-")
    )


def _metadata_schema_issues(meta: LedgerMeta, path: Path) -> list[str]:
    data = meta.data
    where = f"{path}:{meta.line}: ledger-meta"
    kind = data.get("kind")
    version = data.get("v")
    if type(version) is not int or version != LEDGER_META_VERSION:
        return [f"{where}: invalid field 'v' (expected {LEDGER_META_VERSION})"]
    common = {"v", "kind"}
    if kind == MUTATION_RECEIPT_KIND:
        expected = common | {
            "command", "operation", "request_id_sha256", "target",
            "input_sha256", "options", "results", "effect_lines",
            "effect_sha256",
        }
        issues: list[str] = []
        if set(data) != expected:
            issues.append(
                f"{where}: invalid fields for kind {kind}: "
                f"{sorted(set(data) ^ expected)}"
            )
        command = data.get("command")
        if not isinstance(command, str) or command not in (
            "annotate", "record-decision"
        ):
            issues.append(f"{where}: invalid field 'command'")
        for field_name in ("operation", "input_sha256", "effect_sha256"):
            value = data.get(field_name)
            if not isinstance(value, str) or SHA256_RE.fullmatch(value) is None:
                issues.append(f"{where}: invalid field {field_name!r}")
        request_hash = data.get("request_id_sha256")
        if request_hash is not None and (
            not isinstance(request_hash, str)
            or SHA256_RE.fullmatch(request_hash) is None
        ):
            issues.append(f"{where}: invalid field 'request_id_sha256'")
        if not isinstance(data.get("target"), str):
            issues.append(f"{where}: invalid field 'target'")
        options = data.get("options")
        if not isinstance(options, dict) or set(options) != {"section"}:
            issues.append(f"{where}: invalid field 'options'")
        elif options["section"] is not None and not isinstance(options["section"], str):
            issues.append(f"{where}: invalid field 'options.section'")
        results = data.get("results")
        results_invalid = (
            not isinstance(results, list)
            or not results
            or not all(isinstance(value, str) for value in results)
        )
        if isinstance(results, list) and results:
            if command == "annotate":
                results_invalid = results_invalid or not all(
                    isinstance(value, str) and ID_RE.fullmatch(value)
                    for value in results
                )
            elif command == "record-decision":
                results_invalid = results_invalid or not all(
                    isinstance(value, str)
                    and DECISION_RE.fullmatch(f"### {value} — x")
                    for value in results
                )
        if results_invalid:
            issues.append(f"{where}: invalid field 'results'")
        effect_lines = data.get("effect_lines")
        if (
            not isinstance(effect_lines, int)
            or isinstance(effect_lines, bool)
            or effect_lines <= 0
        ):
            issues.append(f"{where}: invalid field 'effect_lines'")
        if not issues:
            options = cast(dict[str, str | None], data["options"])
            operation_source = (
                {
                    "command": data["command"],
                    "request_id_sha256": data["request_id_sha256"],
                }
                if data["request_id_sha256"] is not None
                else {
                    "command": data["command"],
                    "target": data["target"],
                    "input_sha256": data["input_sha256"],
                    "section": options["section"],
                }
            )
            expected_operation = _sha256_text(
                json.dumps(operation_source, sort_keys=True, separators=(",", ":"))
            )
            if data["operation"] != expected_operation:
                issues.append(f"{where}: invalid field 'operation'")
        return issues
    if kind == CITATION_CONTEXT_KIND:
        base = common | {
            "source", "entry", "cited", "line_sha256", "occurrence", "status"
        }
        status = data.get("status")
        expected = base | (
            {"owner"} if status == "external" else {"corrections", "reason"}
        )
        issues = []
        if set(data) != expected:
            issues.append(
                f"{where}: invalid fields for kind {kind}: "
                f"{sorted(set(data) ^ expected)}"
            )
        source = data.get("source")
        if not isinstance(source, str) or source not in ("findings", "decisions"):
            issues.append(f"{where}: invalid field 'source'")
        entry = data.get("entry")
        if not isinstance(entry, str) or re.fullmatch(
            r"[fd]-\d{8}-\d{2}", entry
        ) is None:
            issues.append(f"{where}: invalid field 'entry'")
        cited = data.get("cited")
        if not isinstance(cited, str) or re.fullmatch(
            r"d-\d{8}-\d{2}", cited
        ) is None:
            issues.append(f"{where}: invalid field 'cited'")
        line_hash = data.get("line_sha256")
        if not isinstance(line_hash, str) or SHA256_RE.fullmatch(line_hash) is None:
            issues.append(f"{where}: invalid field 'line_sha256'")
        occurrence = data.get("occurrence")
        if (
            not isinstance(occurrence, int)
            or isinstance(occurrence, bool)
            or occurrence <= 0
        ):
            issues.append(f"{where}: invalid field 'occurrence'")
        if status == "external":
            owner = data.get("owner")
            if (
                not isinstance(owner, str)
                or owner == "local"
                or SLUG_RE.fullmatch(owner) is None
            ):
                issues.append(f"{where}: invalid field 'owner'")
        elif status == "historical-error":
            corrections = data.get("corrections")
            if (
                not isinstance(corrections, list)
                or not corrections
                or not all(
                    isinstance(value, str)
                    and re.fullmatch(r"d-\d{8}-\d{2}", value)
                    for value in corrections
                )
            ):
                issues.append(f"{where}: invalid field 'corrections'")
            reason = data.get("reason")
            if not isinstance(reason, str) or not reason.strip():
                issues.append(f"{where}: invalid field 'reason'")
        else:
            issues.append(f"{where}: invalid field 'status'")
        return issues
    return [f"{where}: unknown metadata kind"]


def _scan_ledger_metadata(text: str, path: Path) -> tuple[list[LedgerMeta], list[str]]:
    lines = text.splitlines()
    mask = _fence_mask(lines)
    found: list[LedgerMeta] = []
    issues: list[str] = []
    for index, line in enumerate(lines):
        if (
            mask[index] is not FenceState.OUTSIDE
            or not _has_ledger_meta_comment(line)
        ):
            continue
        where = f"{path}:{index + 1}"
        if not (line.startswith(LEDGER_META_PREFIX) and line.endswith(LEDGER_META_SUFFIX)):
            issues.append(f"{where}: malformed reserved ledger-meta marker")
            continue
        payload = line[len(LEDGER_META_PREFIX) : -len(LEDGER_META_SUFFIX)]
        try:
            data = json.loads(payload, object_pairs_hook=_metadata_object)
        except DuplicateLedgerMetadataKey:
            issues.append(f"{where}: duplicate ledger-meta JSON key")
            continue
        except (json.JSONDecodeError, UnicodeError):
            issues.append(f"{where}: malformed ledger-meta JSON")
            continue
        if not isinstance(data, dict):
            issues.append(f"{where}: ledger-meta payload must be an object")
            continue
        meta = LedgerMeta(index + 1, data)
        found.append(meta)
        issues.extend(_metadata_schema_issues(meta, path))
    return found, issues


def _receipt_effect_issues(
    text: str, path: Path, metadata: list[LedgerMeta]
) -> list[str]:
    lines = text.splitlines()
    fence_states = _fence_mask(lines)
    issues: list[str] = []
    seen: dict[tuple[str, str], int] = {}
    finding_at_line: dict[int, str] = {}
    if "**Area vocabulary:**" in text.split("### ", 1)[0]:
        _found_lines, headers, _orphans = _unfenced_header_matches(
            text, fence_states
        )
        for heading_index, header_index, match in headers:
            end = _find_entry_span(lines, fence_states, header_index)
            for index in range(heading_index, end):
                finding_at_line[index + 1] = match.group("id")
    for meta in metadata:
        data = meta.data
        if (
            data.get("kind") != MUTATION_RECEIPT_KIND
            or _metadata_schema_issues(meta, path)
        ):
            continue
        command = str(data["command"])
        operation = str(data["operation"])
        duplicate = seen.get((command, operation))
        if duplicate is not None:
            issues.append(
                f"{path}:{meta.line}: duplicate mutation receipt identity; "
                f"first seen at line {duplicate}"
            )
        else:
            seen[(command, operation)] = meta.line
        count = cast(int, data["effect_lines"])
        start = meta.line - 1 - count
        if start < 0:
            issues.append(
                f"{path}:{meta.line}: mutation receipt effect_lines exceeds "
                "preceding content"
            )
            continue
        effect = lines[start : meta.line - 1]
        if _sha256_text("\n".join(effect)) != data["effect_sha256"]:
            issues.append(
                f"{path}:{meta.line}: mutation receipt effect_sha256 does not "
                "match its preceding effect block"
            )
            continue
        results = cast(list[str], data["results"])
        target = str(data["target"])
        if command == "annotate":
            if results != [target] or ID_RE.fullmatch(target) is None:
                issues.append(
                    f"{path}:{meta.line}: annotate receipt has inconsistent "
                    "target/results"
                )
            effect_lines = range(start + 1, meta.line + 1)
            if any(finding_at_line.get(number) != target for number in effect_lines):
                issues.append(
                    f"{path}:{meta.line}: annotate receipt/effect is outside "
                    f"target finding {target}"
                )
        else:
            if target != "decisions-ledger" or not results:
                issues.append(
                    f"{path}:{meta.line}: record-decision receipt has "
                    "inconsistent target/results"
                )
            headings = [
                match.group("id")
                for _index, match in _decision_heading_matches(chr(10).join(effect))[1]
            ]
            if headings != results:
                issues.append(
                    f"{path}:{meta.line}: record-decision receipt results do "
                    "not match effect headings"
                )
    return issues


# Suffixes that make a path-shaped token a real source file. `Finding.paths()` is
# deliberately loose -- it feeds a duplicate check where a spurious candidate costs
# one line of output -- so it also yields `React.memo` and `test.fixme`. That is
# harmless between findings and NOT harmless when matching decisions to a cluster:
# `React.memo` appears in most frontend prose in this repo, so an unfiltered overlap
# would surface half the decision ledger and the mechanism would be ignored as noise.
SOURCE_SUFFIXES = frozenset(
    {
        ".cjs",
        ".conf",
        ".css",
        ".dart",
        ".html",
        ".ini",
        ".js",
        ".json",
        ".jsx",
        ".lock",
        ".md",
        ".mjs",
        ".py",
        ".sh",
        ".sql",
        ".toml",
        ".ts",
        ".tsx",
        ".txt",
        ".yaml",
        ".yml",
    }
)


def scan_paths(body: list[str], body_fenced: list[bool]) -> set[str]:
    """Every path-shaped token anywhere in a ledger entry's body.

    Deliberately not restricted to the ``**Where:**`` bullet: a file named only
    in a ``**Defect:**`` or ``**Fix shape:**`` bullet is exactly the overlap a
    pre-filing duplicate check has to catch.

    Fenced tracebacks and snippets usually contain bare paths rather than
    backtick-quoted ones. Their slash requirement and repo-root check keep
    URL and version-number noise out while still making those paths visible.

    Shared by findings and decisions: matching the two by the files they name is
    the only linkage that works without one of them already knowing the other
    exists, which the hand-written ``Governs:`` / ``Governed-by:`` fields cannot.
    """
    out: set[str] = set()
    fenced_out: set[str] = set()
    for index, line in enumerate(body):
        is_fenced = index < len(body_fenced) and body_fenced[index]
        if not is_fenced:
            out.update(PATH_RE.findall(line))
            continue
        for raw_token in line.split():
            token = raw_token.lstrip(FENCED_TOKEN_LEADING_CHARS).rstrip(
                FENCED_TOKEN_TRAILING_CHARS
            )
            token = FENCED_LINE_NUMBER_RE.sub("", token)
            if "/" not in token or FENCED_URL_RE.match(token):
                continue
            candidate = Path(token)
            if candidate.is_absolute() and REPO_ROOT is not None:
                try:
                    token = candidate.resolve().relative_to(REPO_ROOT).as_posix()
                except ValueError:
                    continue
            fenced_out.add(token)
    return {p for p in out if "/" in p or "." in p} | fenced_out


# Filenames that the App Router assigns by convention, so dozens of unrelated files
# share each one. A basename match on these carries no information -- it says both
# entries touch *a* route, not the same route -- and the decisions it surfaced in
# testing were uniformly wrong. Excluded rather than denylisted case by case,
# because the ambiguity is a property of the framework, not of this repo.
AMBIGUOUS_BASENAMES = frozenset(
    f"{stem}{suffix}"
    for stem in (
        "default",
        "error",
        "global-error",
        "index",
        "layout",
        "loading",
        "not-found",
        "page",
        "page.test",
        "route",
        "template",
    )
    for suffix in (".ts", ".tsx", ".js", ".jsx")
)


# Files that are real sources without carrying a suffix.
EXTENSIONLESS_SOURCES = frozenset({"Dockerfile", "Makefile", "Procfile"})

# How many shared filenames to print beside an advisory match. Enough to show why the
# decision surfaced without turning one line into a paragraph; the reader opens the
# decision for the rest.
SHARED_FILES_SHOWN = 3


def _is_source_name(name: str) -> bool:
    if name in AMBIGUOUS_BASENAMES:
        return False
    if name in EXTENSIONLESS_SOURCES:
        return True
    return PurePosixPath(name).suffix.lower() in SOURCE_SUFFIXES


def source_file_keys(paths: set[str]) -> tuple[set[str], set[str]]:
    """Split a body's path tokens into (full paths, bare filenames).

    Kept apart because the two ledgers cite the same file at different depths: a
    finding writes ``frontend/web/src/.../usePuzzleSubmission.ts:739`` while a
    decision's prose writes ``usePuzzleSubmission.ts:284``. Collapsing everything to
    a basename connects that pair -- and also connects pairs that must NOT be
    connected. Measured on the live ledger: `backend/app/core/auth.py` and
    `backend/app/api/routes/auth.py` are two different files, and collapsing both to
    ``auth.py`` surfaced `d-20260822-14` for `f-20260821-28`, which it does not
    govern. So a basename is used only where a basename is all one side supplied.
    """
    full: set[str] = set()
    bare: set[str] = set()
    for path in paths:
        name = PurePosixPath(path).name
        if not _is_source_name(name):
            continue
        if "/" in path:
            full.add(path)
        else:
            bare.add(name)
    return full, bare


def shared_source_files(
    left: tuple[set[str], set[str]], right: tuple[set[str], set[str]]
) -> set[str]:
    """The files both sides name, requiring a full match wherever both gave one."""
    left_full, left_bare = left
    right_full, right_bare = right
    shared = left_full & right_full
    left_names = {PurePosixPath(p).name for p in left_full}
    right_names = {PurePosixPath(p).name for p in right_full}
    shared |= left_bare & right_bare
    shared |= left_bare & right_names
    shared |= right_bare & left_names
    return shared


@dataclass
class Finding:
    id: str
    status: str
    area: str
    root: str
    entry: str
    blocked: str
    title: str
    section: str
    line: int
    body: list[str] = field(default_factory=list)
    body_fenced: list[bool] = field(default_factory=list)
    governed_by: set[str] = field(default_factory=set)
    # Set only for a finding read from a Controller export: it has no source-byte
    # slice of its own, so its ``list --raw`` identity is the digest of its
    # canonical JSON object instead.
    source_sha256: str | None = None

    @property
    def controller_export(self) -> bool:
        """Controller blockers are opaque wait keys; validation branches on this."""
        return self.source_sha256 is not None

    @property
    def pickable(self) -> bool:
        return (
            self.status == "open"
            and classify_blocker(self.blocked) == BLOCKER_NONE
            and self.sentry_verification is None
        )

    @property
    def sentry_origin_clearance(self) -> str | None:
        """Return why a Sentry origin is not cleared, or None once it is.

        Status-independent, so a header change is judged on the approval
        evidence the body actually carries rather than on the entry's current
        status.  `None` means either "not Sentry-origin at all" or "origin
        approved and the approval still covers this body".
        """
        if not _body_is_sentry_origin(_unfenced_body(self)):
            return None
        if classify_blocker(self.blocked) == BLOCKER_VERIFIER:
            return "unverified"
        body = _unfenced_body(self)
        if APPROVED_RE.search(body) is None:
            return "unverified"
        verifier_digest = _last_approved_verifier_digest(body)
        # Legacy/manual approval evidence has no verifier digest and remains a
        # completed approval.  Only the latest verifier-authenticated approval
        # can drift when the covered body changes.
        if verifier_digest is None:
            return None
        if verified_body_sha256(self) != verifier_digest:
            return "drifted"
        return None

    @property
    def sentry_verification(self) -> str | None:
        """Return derived Sentry verification state for queue-facing surfaces."""
        if self.status != "open":
            return None
        return self.sentry_origin_clearance

    @property
    def cluster_key(self) -> tuple[str, str]:
        """Group by an evidenced root; otherwise identify this finding alone."""
        return ("root", self.root) if self.root != "-" else ("finding", self.id)

    def paths(self) -> set[str]:
        """Every path-shaped token anywhere in the body."""
        return scan_paths(self.body, self.body_fenced)

    def summary(self) -> str:
        """Two-line rendering: header facts, then the title."""
        flag = (
            f"  [{self.blocked}]"
            if classify_blocker(self.blocked) != BLOCKER_NONE
            else ""
        )
        root = f" root={self.root}" if self.root != "-" else ""
        return (
            f"{self.id}  {self.status:<8} {self.area:<20}{root} "
            f"entry={self.entry}{flag}\n    {self.title}"
        )


@dataclass(frozen=True)
class SummaryBuckets:
    """One classification of a parsed ledger, for every counting consumer.

    Consumers that print or count Felix-facing classes read these fields
    instead of re-deriving them, so the overview, the drain's start screen and
    ``decisions`` cannot disagree about which finding waits on what.

    ``answerable`` is derived from its two stored, slug-partitioned halves
    rather than stored beside them: a third field could disagree with its own
    partition.
    """

    total: int
    handled: int
    rejected: int
    open_: int
    pickable: tuple[Finding, ...]
    product: tuple[Finding, ...]
    approvals: tuple[Finding, ...]
    preconditions: tuple[Finding, ...]
    external: tuple[Finding, ...]

    @property
    def answerable(self) -> tuple[Finding, ...]:
        return self.product + self.approvals

    @property
    def blocked(self) -> int:
        """Every open finding whose blocker is not ``none``, verifier included."""
        return (
            len(self.product)
            + len(self.approvals)
            + len(self.preconditions)
            + len(self.external)
        )


def summary_buckets(findings: list[Finding]) -> SummaryBuckets:
    """Classify parsed findings into the four blocker classes exactly once.

    The verifier class takes precedence over the ``Blocked`` slug, exactly as
    the drain's row classifier does: a Sentry-origin finding whose body drifted
    is automated-verification work, never a pickable one, even when its slug is
    ``none``. That precedence is what keeps every consumer's counts identical.
    """
    handled = 0
    rejected = 0
    open_findings: list[Finding] = []
    for finding in findings:
        if finding.status == "handled":
            handled += 1
        elif finding.status == "rejected":
            rejected += 1
        elif finding.status == "open":
            open_findings.append(finding)
    approvals = tuple(
        finding
        for finding in open_findings
        if classify_blocker(finding.blocked) == BLOCKER_VERIFIER
        or finding.sentry_verification in SENTRY_VERIFICATION_STATES
    )
    approval_ids = {finding.id for finding in approvals}
    product = tuple(
        finding
        for finding in open_findings
        if finding.blocked == FELIX_DECISION and finding.id not in approval_ids
    )
    preconditions = tuple(
        finding
        for finding in open_findings
        if classify_blocker(finding.blocked) == BLOCKER_PRECONDITION
        and finding.id not in approval_ids
    )
    external = tuple(
        finding
        for finding in open_findings
        if classify_blocker(finding.blocked) == BLOCKER_EXTERNAL
        and finding.id not in approval_ids
    )
    return SummaryBuckets(
        total=len(findings),
        handled=handled,
        rejected=rejected,
        open_=len(open_findings),
        pickable=tuple(finding for finding in open_findings if finding.pickable),
        product=product,
        approvals=approvals,
        preconditions=preconditions,
        external=external,
    )


def _summary_counts_line(buckets: SummaryBuckets) -> str:
    """The one counts line, byte-identical to the drain's historical summary."""

    def amount(count, singular, plural):
        return "%d %s" % (count, singular if count == 1 else plural)

    return "%s (%s, %s, %s); %s; %s (%s, %s, %s, %s)" % (
        amount(buckets.total, "finding", "findings"),
        amount(buckets.handled, "handled", "handled"),
        amount(buckets.rejected, "rejected", "rejected"),
        amount(buckets.open_, "open", "open"),
        amount(len(buckets.pickable), "pickable finding", "pickable findings"),
        amount(buckets.blocked, "blocked finding", "blocked findings"),
        amount(len(buckets.product), "decision", "decisions"),
        amount(
            len(buckets.approvals),
            "finding awaiting automated verification",
            "findings awaiting automated verification",
        ),
        amount(
            len(buckets.preconditions), "Felix precondition", "Felix preconditions"
        ),
        amount(
            len(buckets.external),
            "external/technical blocker",
            "external/technical blockers",
        ),
    )


@dataclass
class Decision:
    id: str
    question: str
    governs: set[str]
    # Replacement references named by the trailer, empty while still current.
    superseded_by: str = ""
    # 1-based line of the heading. Only a duplicate-id report needs it, but it is
    # carried on the record rather than rescanned: a second scan is a second
    # parser, and the two drift the moment the heading format moves.
    line: int = 0
    body: list[str] = field(default_factory=list)
    body_fenced: list[bool] = field(default_factory=list)

    def paths(self) -> set[str]:
        """Every path-shaped token anywhere in the decision's body."""
        return scan_paths(self.body, self.body_fenced)


@dataclass(frozen=True)
class FindingExpectation:
    """Captured semantic content that an additive ledger update must preserve."""

    identifier: str
    status: str
    area: str
    root: str
    entry: str
    blocked: str
    title: str
    body: tuple[str, ...]
    body_fenced: tuple[bool, ...]
    governed_by: frozenset[str]


@dataclass(frozen=True)
class DecisionExpectation:
    """Captured semantic content that an additive decision update must preserve."""

    identifier: str
    question: str
    governs: frozenset[str]
    superseded_by: str
    body: tuple[str, ...]
    body_fenced: tuple[bool, ...]


@dataclass(frozen=True)
class AnswerExpectation:
    """Header transition and one additional evidence block from apply-answers."""

    status: str
    blocked: str
    evidence: tuple[str, ...]
    previous_occurrences: int
    previous_line_occurrences: dict[str, int]
    kind: str = "decision"


class LedgerError(Exception):
    pass


class PublishLockBusyError(LedgerError):
    """The bounded publish fence did not become available."""


class LedgerDirtyError(LedgerError):
    """The consumer requested an answer-only commit over foreign ledger dirt."""


class LedgerSupersededError(LedgerError):
    """A foreign ledger commit superseded this command's saved replacement."""


@dataclass
class LedgerCommitIntent:
    """One CLI command's semantic obligation for a replaced ledger."""

    command: str
    ledger: Path
    findings: Path
    decisions: Path
    subject: str = ""
    expected_head: str | None = None
    head_at_write: str | None = None
    identifiers: tuple[str, ...] = ()
    postcondition: Callable[[Path, Path], bool] | None = None
    replaced: bool = False
    written_bytes: bytes | None = None
    companion: Path | None = None
    companion_bytes: bytes | None = None
    claim: Path | None = None
    finalize: Callable[[], str] | None = None
    provisional: tuple[str, ...] = ()


@dataclass(frozen=True)
class LedgerCommitResult:
    """Whether a ledger commit obligation was proven durable."""

    durable: bool
    cause: str = ""
    # A branch ref can be durable even when index refresh or the final
    # postcondition read fails. Keep that head so callers never describe the
    # created commit as absent or retry it into a second commit.
    durable_head: str = ""
    phase: str = "before-update-ref"


@dataclass(frozen=True)
class ClaimIntent:
    """The validated durable state describing one findings claim."""

    phase: str
    ids: list[str]
    receipt_ids: dict[str, str | dict[str, str]]
    has_receipt_ids: bool
    fixed: set[str]
    has_fixed: bool
    claimed: tuple[Path, ...]
    files: dict[str, dict[str, object]] | None = None
    quarantined: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class HeadSnapshot:
    """The committed ledger blobs and validation result from one HEAD."""

    findings_text: str | None
    valid: bool
    detail: str
    tasks_dir: Path


@dataclass(frozen=True)
class Reconciliation:
    """The outcome of classifying a prepared findings claim."""

    absent: list[Path]
    receipt_names: dict[str, str]
    fixed: set[str]
    released: bool
    replay: bool = False


_ACTIVE_LEDGER_COMMIT: LedgerCommitIntent | None = None


def _note_ledger_replacement(path: Path, text: str) -> None:
    """Signal replacement immediately, before durability or cleanup can fail."""
    intent = _ACTIVE_LEDGER_COMMIT
    if intent is not None and path == intent.ledger:
        intent.replaced = True
        intent.written_bytes = text.encode("utf-8")
        root = REPO_ROOT
        if root is None:
            intent.head_at_write = None
            return
        try:
            intent.head_at_write = _resolve_head(root.resolve())
        except (LedgerError, OSError, UnicodeError, RuntimeError):
            # An unborn repository has no commit to compare. The commit helper
            # will report its inability to commit later; recording no baseline
            # here keeps the replacement notification itself non-fatal.
            intent.head_at_write = None


def _register_ledger_commit(
    subject: str,
    identifiers: Collection[str],
    postcondition: Callable[[Path, Path], bool],
) -> None:
    """Attach the subject and semantic HEAD check before ledger replacement."""
    intent = _ACTIVE_LEDGER_COMMIT
    if intent is None:
        return
    intent.subject = subject
    intent.identifiers = tuple(identifiers)
    intent.postcondition = postcondition


def _finding_expectation(finding: Finding) -> FindingExpectation:
    return FindingExpectation(
        identifier=finding.id,
        status=finding.status,
        area=finding.area,
        root=finding.root,
        entry=finding.entry,
        blocked=finding.blocked,
        title=finding.title,
        body=tuple(finding.body),
        body_fenced=tuple(finding.body_fenced),
        governed_by=frozenset(finding.governed_by),
    )


def _decision_expectation(decision: Decision) -> DecisionExpectation:
    return DecisionExpectation(
        identifier=decision.id,
        question=decision.question,
        governs=frozenset(decision.governs),
        superseded_by=decision.superseded_by,
        body=tuple(decision.body),
        body_fenced=tuple(decision.body_fenced),
    )


def _ordered_content_preserved(
    expected: tuple[object, ...], actual: tuple[object, ...]
) -> bool:
    """Accept insertions while requiring every captured item in its original order."""
    remaining = iter(actual)
    return all(any(item == candidate for candidate in remaining) for item in expected)


def _finding_matches_expectation(
    finding: Finding, expected: FindingExpectation
) -> bool:
    return (
        finding.status == expected.status
        and finding.root == expected.root
        and finding.entry == expected.entry
        and finding.blocked == expected.blocked
        and _finding_identity_preserved(expected, finding)
        and frozenset(finding.governed_by) == expected.governed_by
    )


def _finding_identity_preserved(
    expected: FindingExpectation, finding: Finding
) -> bool:
    """Match the immutable identity of a claimed finding entry."""
    return (
        finding.title == expected.title
        and finding.area == expected.area
        and _ordered_content_preserved(
            tuple(zip(expected.body, expected.body_fenced, strict=True)),
            tuple(zip(finding.body, finding.body_fenced, strict=True)),
        )
    )


def _findings_preserved(
    expected: Collection[FindingExpectation], findings: Collection[Finding]
) -> bool:
    actual = {finding.id: finding for finding in findings}
    return all(
        (finding := actual.get(item.identifier)) is not None
        and _finding_matches_expectation(finding, item)
        for item in expected
    )


def _decision_matches_expectation(
    decision: Decision, expected: DecisionExpectation
) -> bool:
    return (
        decision.question == expected.question
        and frozenset(decision.governs) == expected.governs
        and decision.superseded_by == expected.superseded_by
        and _ordered_content_preserved(
            tuple(zip(expected.body, expected.body_fenced, strict=True)),
            tuple(zip(decision.body, decision.body_fenced, strict=True)),
        )
    )


def _ledger_snapshot_valid(path: Path, ledger_kind: str) -> bool:
    """Read-only structural and receipt validation for one standalone ledger."""
    text = path.read_text(encoding="utf-8")
    metadata, issues = _scan_ledger_metadata(text, path)
    issues += _receipt_effect_issues(text, path, metadata)
    if ledger_kind == "findings":
        findings, problems, vocabulary = parse(path)
        issues += validate(findings, problems, vocabulary)
    else:
        issues += malformed_decision_headings(path)
        issues += malformed_superseded_trailers(path)
        issues += duplicate_decision_ids(path)
    return not issues


def _pure_insertions(base: list[str], side: list[str]) -> dict[int, list[str]] | None:
    """Decompose ``side`` into ``base`` plus inserted blocks keyed by base index.

    Greedy leftmost matching: ``base`` is a subsequence of ``side`` exactly when
    every base line is found, so ``None`` means the side deleted or rewrote a
    line and is not a pure append. An inserted line equal to the next base
    line is matched as that base line and shifts its block by one; the block
    stays contiguous either way, which is the property the receipts need.
    """
    blocks: dict[int, list[str]] = {}
    cursor = 0
    for index, line in enumerate(base):
        start = cursor
        while cursor < len(side) and side[cursor] != line:
            cursor += 1
        if cursor == len(side):
            return None
        if cursor > start:
            blocks[index] = side[start:cursor]
        cursor += 1
    if cursor < len(side):
        blocks[len(base)] = side[cursor:]
    return blocks


def merge_appended_blocks(base: str, ours: str, theirs: str) -> str | None:
    """Three-way merge of two pure-append sides, each block kept contiguous.

    Git's own ``merge=union`` refines a conflict against the two sides' common
    lines, so two receipted effects that begin with the same line were folded
    into one and the second receipt lost its effect line (measured
    2026-09-12, f-20260907-04). Here every inserted block is emitted whole, ours
    before theirs at the same base index, and an identical block on both sides
    is emitted once. ``None`` when either side is not a pure append; the caller
    then leaves the file to git's ordinary text merge.
    """
    base_lines = base.splitlines()
    ours_blocks = _pure_insertions(base_lines, ours.splitlines())
    theirs_blocks = _pure_insertions(base_lines, theirs.splitlines())
    if ours_blocks is None or theirs_blocks is None:
        return None
    merged: list[str] = []
    for index in range(len(base_lines) + 1):
        mine = ours_blocks.get(index)
        other = theirs_blocks.get(index)
        if mine is not None:
            merged.extend(mine)
        if other is not None and other != mine:
            merged.extend(other)
        if index < len(base_lines):
            merged.append(base_lines[index])
    return "\n".join(merged) + "\n" if merged else ""


def ensure_merge_driver(root: Path) -> bool:
    """Install the ledger merge driver in this clone's config; True if written."""
    settings = (
        (f"merge.{MERGE_DRIVER_NAME}.driver", MERGE_DRIVER_COMMAND),
        (f"merge.{MERGE_DRIVER_NAME}.name", MERGE_DRIVER_DESCRIPTION),
    )
    missing_or_wrong = _merge_driver_settings_to_repair(root, settings)
    if not missing_or_wrong:
        return False

    with _merge_driver_config_lock(root):
        missing_or_wrong = _merge_driver_settings_to_repair(root, settings)
        for name, value in missing_or_wrong:
            result = _git_for_ledger(
                root, "config", "--local", "--replace-all", name, value
            )
            if result.returncode != 0:
                raise LedgerError(
                    f"could not install merge driver {name}: {_git_failure_detail(result)}"
                )
        return bool(missing_or_wrong)


def _merge_driver_settings_to_repair(
    root: Path, settings: tuple[tuple[str, str], ...]
) -> list[tuple[str, str]]:
    """Return merge-driver settings that do not have exactly one expected value."""
    missing_or_wrong: list[tuple[str, str]] = []
    for name, value in settings:
        result = _git_for_ledger(root, "config", "--local", "--get-all", name)
        if result.returncode == 1 and not result.stdout and not result.stderr:
            current_values: list[str] = []
        elif result.returncode == 0:
            current_values = result.stdout.splitlines()
        else:
            raise LedgerError(
                f"could not inspect merge driver {name}: "
                f"{_git_failure_detail(result)}"
            )
        if current_values != [value]:
            missing_or_wrong.append((name, value))
    return missing_or_wrong


@contextmanager
def _merge_driver_config_lock(root: Path) -> Iterator[None]:
    """Serialize merge-driver config repair across worktrees and processes.

    The lock lives in Git's common directory, which is shared by linked worktrees.
    Like the ledger flock, its inode remains on disk so waiters always lock the
    same file.
    """
    common = _git_for_ledger(root, "rev-parse", "--git-common-dir")
    if common.returncode != 0:
        raise LedgerError(
            "could not locate the shared Git directory for merge-driver config: "
            f"{_git_failure_detail(common)}"
        )
    common_text = common.stdout.strip()
    if not common_text:
        raise LedgerError(
            "could not locate the shared Git directory for merge-driver config: "
            "git rev-parse --git-common-dir returned an empty path"
        )
    common_dir = Path(common_text)
    if not common_dir.is_absolute():
        common_dir = root / common_dir
    lock = common_dir.resolve() / MERGE_DRIVER_CONFIG_LOCK_NAME
    try:
        acquired, waited = acquire_ledger_lock(
            lock, MERGE_DRIVER_CONFIG_LOCK_WAIT_SECONDS
        )
    except LedgerError as exc:
        raise LedgerError(
            f"could not acquire merge-driver config lock {lock}: {exc}"
        ) from exc
    if not acquired:
        raise LedgerError(
            f"could not acquire merge-driver config lock {lock} "
            f"(waited {waited:.2f}s)"
        )

    try:
        yield
    finally:
        release_ledger_lock(lock)


def cmd_merge_driver(args: argparse.Namespace) -> int:
    """Git merge driver entry: ``%O %A %B %P``, result written into ``%A``.

    A non-zero exit tells git the file conflicts and leaves ``%A`` as written,
    so every refusal first hands the three inputs to ``git merge-file`` -- the
    merge git would have done without a driver -- and validates a clean ledger
    result too, so an invalid union never reports success.
    """
    ledger_kind = MERGE_DRIVER_LEDGERS.get(Path(args.path).as_posix())
    reason: str
    controller_export = False
    if ledger_kind is None:
        reason = f"{args.path} is not a ledger this driver merges"
    else:
        try:
            sides = [
                side.read_text(encoding="utf-8")
                for side in (args.base, args.ours, args.theirs)
            ]
        except (OSError, UnicodeDecodeError) as exc:
            merged = None
            reason = f"could not read the merge inputs: {exc}"
        else:
            controller_export = any(is_controller_export(side) for side in sides)
            if controller_export:
                # A block append after the JSON fence is invisible to the
                # export parser, so it would validate and then be discarded at
                # the Controller's next regeneration.
                merged = None
                reason = "a side is a Controller-generated export"
            else:
                merged = merge_appended_blocks(*sides)
                reason = "a side changed existing lines instead of appending"
        if merged is not None:
            candidate: Path | None = None
            try:
                with tempfile.NamedTemporaryFile(
                    mode="w",
                    encoding="utf-8",
                    dir=args.ours.parent,
                    prefix=f".{args.ours.name}.ledger-merge-",
                    delete=False,
                ) as scratch:
                    candidate = Path(scratch.name)
                    scratch.write(merged)
                valid = _ledger_snapshot_valid(cast(Path, candidate), ledger_kind)
            except (LedgerError, OSError, UnicodeError) as exc:
                valid = False
                reason = f"the appended blocks could not be validated: {exc}"
            else:
                reason = "the appended blocks do not validate together"
            finally:
                if candidate is not None:
                    candidate.unlink(missing_ok=True)
            if valid:
                args.ours.write_text(merged, encoding="utf-8")
                return 0
    print(
        f"merge-driver: {reason}; {args.path} is left to git merge-file",
        file=sys.stderr,
    )
    result = _git_for_ledger(
        cast(Path, REPO_ROOT),
        "merge-file",
        "-L", "ours", "-L", "base", "-L", "theirs",
        str(args.ours), str(args.base), str(args.theirs),
    )
    if result.stderr.strip():
        for line in result.stderr.splitlines():
            print(f"merge-driver: git merge-file: {line}", file=sys.stderr)
    if controller_export:
        # Validation cannot vouch for this result: a markdown tail after the
        # JSON fence is invisible to the export parser. The file is resolved by
        # regenerating it from the Controller, never by a clean driver merge.
        print(
            f"merge-driver: {args.path} is a Controller-generated export; left "
            "conflicted — regenerate it from the Controller",
            file=sys.stderr,
        )
        return 1
    if result.returncode == 0:
        if ledger_kind is not None:
            try:
                valid = _ledger_snapshot_valid(args.ours, ledger_kind)
                preserved = (
                    _ledger_entry_ids_preserved(args.base, args.ours, ledger_kind)
                    if valid
                    else False
                )
            except (LedgerError, OSError, UnicodeError) as exc:
                print(
                    f"merge-driver: could not validate git merge-file result for "
                    f"{args.path} ({args.ours}): {exc}",
                    file=sys.stderr,
                )
                valid = False
                preserved = False
            if not valid:
                print(
                    f"merge-driver: git merge-file joined {args.path} cleanly but "
                    "the result does not validate; left conflicted for a hand",
                    file=sys.stderr,
                )
                return 1
            if not preserved:
                print(
                    f"merge-driver: git merge-file removed entries from the merge "
                    f"base for {args.path}; left conflicted for a hand",
                    file=sys.stderr,
                )
                return 1
        return 0
    return result.returncode if 0 < result.returncode < 128 else 1


def _ledger_snapshot_preserved(before: Path, after: Path, ledger_kind: str) -> bool:
    """Whether every parsed entry in ``before`` survives semantically in ``after``.

    This is deliberately pure: it reads and parses the two paths but performs no Git
    operation, lock acquisition, recovery, or write.

    The drain supervisor imports this symbol by name across the kit-to-consumer
    vendoring boundary. Its name and ``(before, after, ledger_kind) -> bool``
    signature are part of that contract; changing either requires updating
    ``LedgerOps._snapshot_preserved`` and its capability probe together.
    """
    if ledger_kind not in {"findings", "decisions"}:
        raise ValueError("ledger_kind must be exactly 'findings' or 'decisions'")
    try:
        if not _ledger_snapshot_valid(before, ledger_kind):
            return False
        if not _ledger_snapshot_valid(after, ledger_kind):
            return False
        if ledger_kind == "findings":
            captured = [_finding_expectation(item) for item in parse(before)[0]]
            return _findings_preserved(captured, parse(after)[0])
        captured_decisions = [
            _decision_expectation(item) for item in load_decisions(before)
        ]
        actual = {item.id: item for item in load_decisions(after)}
        return all(
            (decision := actual.get(item.identifier)) is not None
            and _decision_matches_expectation(decision, item)
            for item in captured_decisions
        )
    except (LedgerError, OSError, UnicodeError):
        return False


def _ledger_entry_ids_preserved(
    before: Path, after: Path, ledger_kind: str
) -> bool:
    """Whether all entry IDs in the merge base still exist in the result.

    This intentionally permits in-place edits to existing entries, such as a
    finding status change or a decision's supersession trailer update.
    """
    if ledger_kind not in {"findings", "decisions"}:
        raise ValueError("ledger_kind must be exactly 'findings' or 'decisions'")
    if ledger_kind == "findings":
        before_ids = {finding.id for finding in parse(before)[0]}
        after_ids = {finding.id for finding in parse(after)[0]}
    else:
        before_ids = {decision.id for decision in load_decisions(before)}
        after_ids = {decision.id for decision in load_decisions(after)}
    return before_ids <= after_ids


def _finding_entries_postcondition(
    expected: Collection[FindingExpectation],
) -> Callable[[Path, Path], bool]:
    def holds(findings_path: Path, _decisions_path: Path) -> bool:
        findings, problems, vocabulary = parse(findings_path)
        return not validate(findings, problems, vocabulary) and _findings_preserved(
            expected, findings
        )

    return holds


def _finding_header_postcondition(
    identifier: str, expected: dict[str, str]
) -> Callable[[Path, Path], bool]:
    def holds(findings_path: Path, _decisions_path: Path) -> bool:
        findings, problems, vocabulary = parse(findings_path)
        if validate(findings, problems, vocabulary):
            return False
        target = next((finding for finding in findings if finding.id == identifier), None)
        return target is not None and all(
            getattr(target, field) == value for field, value in expected.items()
        )

    return holds


def _receipt_postcondition(
    *, command: str, operation: str, results: Collection[str], decisions: bool
) -> Callable[[Path, Path], bool]:
    expected_results = list(results)

    def holds(findings_path: Path, decisions_path: Path) -> bool:
        path = decisions_path if decisions else findings_path
        text = path.read_text(encoding="utf-8")
        metadata, issues = _scan_ledger_metadata(text, path)
        issues += _receipt_effect_issues(text, path, metadata)
        return not issues and any(
            meta.data.get("kind") == MUTATION_RECEIPT_KIND
            and meta.data.get("command") == command
            and meta.data.get("operation") == operation
            and meta.data.get("results") == expected_results
            for meta in metadata
        )

    return holds


def _decision_trailer_postcondition(
    identifier: str, references: Collection[str]
) -> Callable[[Path, Path], bool]:
    expected = ", ".join(references)

    def holds(_findings_path: Path, decisions_path: Path) -> bool:
        decisions = load_decisions(decisions_path)
        target = next((decision for decision in decisions if decision.id == identifier), None)
        return target is not None and target.superseded_by == expected

    return holds


def _contiguous_occurrences(haystack: Collection[str], needle: tuple[str, ...]) -> int:
    values = tuple(haystack)
    if not needle:
        return 0
    return sum(
        values[index : index + len(needle)] == needle
        for index in range(len(values) - len(needle) + 1)
    )


def _answers_postcondition(
    expected: dict[str, AnswerExpectation],
) -> Callable[[Path, Path], bool]:
    def holds(findings_path: Path, _decisions_path: Path) -> bool:
        text = findings_path.read_text(encoding="utf-8")
        for identifier, answer in expected.items():
            record = {
                "id": identifier,
                "status": answer.status,
                "blocked": answer.blocked,
                "evidence": list(answer.evidence),
                "previous_occurrences": answer.previous_occurrences,
                "previous_line_occurrences": answer.previous_line_occurrences,
                "kind": answer.kind,
            }
            if _answer_effect_state(text, record) != "complete":
                return False
        return True

    return holds


def _answer_effect_state(
    text: str, record: dict[str, object]
) -> Literal["complete", "untouched", "inconsistent", "missing"]:
    """Classify one recorded answer effect in a ledger text."""
    identifier = cast(str, record["id"])
    lines = text.splitlines()
    fence_states = _fence_mask(lines)
    target = _answer_target_spans(lines, fence_states, {identifier}).get(identifier)
    if target is None:
        return "missing"
    header_index, end, header_match = target
    status = cast(str, record["status"])
    blocked = cast(str, record["blocked"])
    kind = cast(str, record["kind"])
    current_status = header_match.group("status")
    current_blocked = header_match.group("blocked")
    done_status = "rejected" if kind == "reject" else status
    header_done = current_blocked == BLOCKER_NONE and current_status == done_status
    header_untouched = current_blocked == blocked and current_status == status

    evidence = tuple(cast(list[str], record["evidence"]))
    previous_occurrences = cast(int, record["previous_occurrences"])
    previous_lines = cast(dict[str, int], record["previous_line_occurrences"])
    body = tuple(
        lines[index]
        for index in range(header_index + 1, end)
        if fence_states[index] is FenceState.OUTSIDE
    )
    block_count = _contiguous_occurrences(body, evidence)
    line_counts: dict[str, int] = {}
    for line in body:
        line_counts[line] = line_counts.get(line, 0) + 1
    evidence_line_counts: dict[str, int] = {}
    for line in evidence:
        evidence_line_counts[line] = evidence_line_counts.get(line, 0) + 1
    lines_done = all(
        line_counts.get(line, 0) == previous_lines[line] + count
        for line, count in evidence_line_counts.items()
    )
    lines_untouched = all(
        line_counts.get(line, 0) == previous_lines[line]
        for line in evidence_line_counts
    )
    evidence_done = (
        block_count == previous_occurrences + 1 and lines_done
    )
    evidence_untouched = block_count == previous_occurrences and lines_untouched
    if header_done and evidence_done:
        return "complete"
    if header_untouched and evidence_untouched:
        return "untouched"
    return "inconsistent"


_READ_ERRORS_LEDGER = (OSError, UnicodeError, LedgerError)


class FenceState(Enum):
    OUTSIDE = auto()
    DELIMITER = auto()
    CONTENT = auto()


def _fence_mask(lines: list[str]) -> list[FenceState]:
    """Classify each line as outside, a fence delimiter, or fenced content.

    The ledger documents its own header format in a fenced example. A full example
    including its ``###`` heading would otherwise be parsed as a real finding and
    collide with the entry it illustrates.

    An **unbalanced** fence is fatal rather than tolerated: it would mask every
    entry after it, and ``check`` would then report a smaller, valid-looking ledger
    while silently dropping findings out of the queue.
    """
    inside = False
    opened_at = 0
    fence_char = ""
    fence_length = 0
    mask: list[FenceState] = []
    for number, line in enumerate(lines, start=1):
        stripped = line.lstrip()
        # CommonMark allows ``` and ~~~, and a fence is only closed by one of the
        # same character. Toggling on any fence-looking line would let a ```-block
        # containing ~~~ (or the reverse) end early and expose its contents.
        opener = (
            "`"
            if stripped.startswith("```")
            else "~"
            if stripped.startswith("~~~")
            else ""
        )
        run_length = len(stripped) - len(stripped.lstrip(opener)) if opener else 0
        # A closing fence must be at least as long as the one that opened it.
        # Without the length test a four-backtick block QUOTING a three-backtick
        # one closes at the inner delimiter, and the rest of the outer block is
        # read as ledger structure — which is how a fenced ``###`` becomes a
        # second finding, the exact defect the mask exists to prevent.
        if opener and (
            not inside or (opener == fence_char and run_length >= fence_length)
        ):
            mask.append(FenceState.DELIMITER)
            if not inside:
                opened_at = number
                fence_char = opener
                fence_length = run_length
            inside = not inside
            continue
        mask.append(FenceState.CONTENT if inside else FenceState.OUTSIDE)
    if inside:
        raise LedgerError(
            f"unclosed code fence opened at line {opened_at} — everything after it "
            "would be masked, so the ledger would validate while hiding findings"
        )
    return mask


def _mask_inline_code_spans(line: str) -> str:
    """Mask quoted marker text in complete inline code spans on one line.

    Backtick runs delimit spans only when their opening and closing lengths match.
    Process longer runs first so a double-backtick span containing single
    backticks is masked as one quoted span rather than split into inner spans.
    A span containing only a valid local or qualified ledger reference, or the
    ``-`` sentinel, stays visible because it can be part of an otherwise visible
    near-miss marker. Unclosed spans remain visible to the caller and never
    consume a later line.
    """
    masked = line
    run_lengths = sorted(
        {len(match.group()) for match in re.finditer(r"`+", line)}, reverse=True
    )
    for run_length in run_lengths:
        span = re.compile(
            rf"(?<!`)`{{{run_length}}}(?!`)[^\n]*?"
            rf"(?<!`)`{{{run_length}}}(?!`)"
        )

        def replace(match: re.Match[str], run_length: int = run_length) -> str:
            content = match.group()[run_length:-run_length]
            if INLINE_REFERENCE_RE.fullmatch(content):
                return match.group()
            return " " * len(match.group())

        masked = span.sub(replace, masked)
    return masked


def _read_decision_lines(
    path: Path,
) -> tuple[list[str], list[FenceState]] | None:
    """Read a decisions ledger and classify each line's fence state once."""
    if not path.exists():
        return None
    lines = path.read_text(encoding="utf-8").splitlines()
    return lines, _fence_mask(lines)


def _ledger_header_text(lines: list[str], fence_states: list[FenceState]) -> str:
    """Unfenced ledger text before the first finding entry.

    The boundary is the first ``### ``, not the first ``## ``: the header
    legitimately uses ``## `` subsections to document the contract. Shared by
    every bold-label read so Area vocabulary and Tooling areas cannot drift onto
    different regions.
    """
    header: list[str] = []
    for line, fence_state in zip(lines, fence_states, strict=True):
        if fence_state is not FenceState.OUTSIDE:
            continue

        if line.startswith("### "):
            break
        header.append(line)
    return "\n".join(header) + "\n\n"


def _backticks_after_bold_label(
    header: str, pattern: re.Pattern[str]
) -> frozenset[str] | None:
    """Return the backtick-quoted tokens of one bold-label header line, if present."""
    match = pattern.search(header)
    if match is None:
        return None
    return frozenset(re.findall(r"`([^`]+)`", match.group("body")))


def load_vocabulary(lines: list[str], fence_states: list[FenceState]) -> frozenset[str]:
    """Read the closed area set from the ledger header.

    Bounded to the region before the first finding entry and outside fences, so a
    stray occurrence in a finding body cannot define the accepted vocabulary.
    """
    found = _backticks_after_bold_label(
        _ledger_header_text(lines, fence_states), VOCAB_RE
    )
    if found is None:
        raise LedgerError(
            "ledger header has no '**Area vocabulary:**' line before the first finding "
            "entry — the closed area set lives in the ledger, not in this script"
        )
    return found


def load_tooling_areas(
    lines: list[str], fence_states: list[FenceState]
) -> frozenset[str]:
    """Read ``**Tooling areas:**`` from the same header region as the vocabulary.

    Optional: a ledger without the line treats every finding as not tooling.
    """
    found = _backticks_after_bold_label(
        _ledger_header_text(lines, fence_states), TOOLING_AREAS_RE
    )
    return found if found is not None else frozenset()


def load_tooling_areas_from_path(path: Path) -> frozenset[str]:
    """Load tooling areas from a ledger path already proven readable by ``parse``."""
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    return load_tooling_areas(lines, _fence_mask(lines))


def load_vocabulary_from_project_manifest(manifest: Path) -> frozenset[str]:
    """Read the closed area set from ``.project.json`` for a Controller export.

    A Controller-generated ledger has no ``**Area vocabulary:**`` line; the
    project manifest is the authority for the closed set, the same rule the
    Controller's own filing path enforces. Still project data, never compiled in.
    """
    if not manifest.is_file():
        raise LedgerError(
            "Controller-generated ledger has no '**Area vocabulary:**' line and "
            f"{manifest} is missing — Controller exports read the closed area set "
            f"from {PROJECT_MANIFEST_NAME} findings.areas"
        )
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise LedgerError(f"{manifest} is not valid JSON: {exc}") from exc
    findings_config = data.get("findings") if isinstance(data, dict) else None
    areas = (
        findings_config.get("areas") if isinstance(findings_config, dict) else None
    )
    if not isinstance(areas, dict) or not areas:
        raise LedgerError(
            f"{manifest} findings.areas is missing or empty — Controller exports "
            "read the closed area vocabulary from the project manifest"
        )
    vocabulary: set[str] = set()
    for values in areas.values():
        if not isinstance(values, list):
            raise LedgerError(
                f"{manifest} findings.areas values must be lists of area slugs"
            )
        for area in values:
            if not isinstance(area, str) or not area.strip():
                raise LedgerError(
                    f"{manifest} findings.areas contains a non-string or empty area"
                )
            vocabulary.add(area)
    return frozenset(vocabulary)


def _controller_export_head(data: bytes) -> str:
    """Decode just the head a marker is honoured in from raw ledger bytes.

    UTF-8 needs at most four bytes per character; a character cut at the
    boundary is dropped, which no ASCII marker can be part of.
    """
    return data[: CONTROLLER_EXPORT_HEAD_CHARS * 4].decode("utf-8", errors="ignore")


def is_controller_export(text: str) -> bool:
    """True when the file's head carries a Controller generated-ledger marker."""
    head = text[:CONTROLLER_EXPORT_HEAD_CHARS]
    return any(marker in head for marker in CONTROLLER_EXPORT_MARKERS)


def _refuse_controller_export(path: Path, text: str, command: str) -> None:
    """Refuse a write to a ledger the Controller regenerates from SQLite.

    Every writer here appends or rewrites markdown entries. Against the fenced
    JSON form that write would either fail late or, worse, validate — a markdown
    tail is invisible to the JSON parser — and land outside the Controller's
    authoritative store, to be discarded at its next regeneration.
    """
    if is_controller_export(text):
        raise LedgerError(
            f"{path} is a Controller-generated export; {command} works only on "
            "the markdown ledger. The Controller owns this one: file and change "
            "findings through its findings tools instead"
        )


def _refuse_controller_export_at(path: Path, command: str) -> None:
    """``_refuse_controller_export`` for a writer that has not read the ledger yet.

    Reads only the bounded head the markers are honoured in, so the check costs
    nothing on a large ledger and leaves the writer's own full read, and its
    compare-and-swap baseline, as the first read of the text it writes. An
    unreadable ledger is left to that read, which already reports it in the
    command's vocabulary.
    """
    try:
        with path.open("rb") as handle:
            head = _controller_export_head(
                handle.read(CONTROLLER_EXPORT_HEAD_CHARS * 4)
            )
    except OSError:
        return
    _refuse_controller_export(path, head, command)


def _controller_export_payload(text: str) -> dict[str, object] | None:
    """Return the parsed JSON payload when ``text`` is a Controller export.

    A marker without a usable ``json`` fence is a hard error: falling through to
    the markdown parser would only fail later on the missing vocabulary line and
    hide the real defect.
    """
    if not is_controller_export(text):
        return None
    match = CONTROLLER_JSON_FENCE_RE.search(text)
    if match is None:
        raise LedgerError(
            "Controller-generated ledger is missing its fenced ```json payload"
        )
    try:
        payload = json.loads(match.group("body"))
    except json.JSONDecodeError as exc:
        raise LedgerError(f"Controller-generated ledger JSON is invalid: {exc}") from exc
    if not isinstance(payload, dict):
        raise LedgerError("Controller-generated ledger JSON must be an object")
    if not isinstance(payload.get("findings"), list):
        raise LedgerError("Controller-generated ledger JSON lacks a 'findings' array")
    return cast(dict[str, object], payload)


def _line_of_finding_id(text: str, finding_id: str) -> int:
    """Best-effort 1-based line of a finding id inside the export text."""
    match = re.search(rf'"id"\s*:\s*{re.escape(json.dumps(finding_id))}', text)
    if match is None:
        return 1
    return text.count("\n", 0, match.start()) + 1


def _optional_string_field(
    raw: dict[str, object], key: str, default: str, where: str
) -> str:
    """Map a nullable Controller string onto the markdown ``-``/``none`` default.

    Any non-empty string passes: a Controller blocker is an opaque wait key or
    prose, not a slug, and the slug rule for roots stays with ``validate``.
    """
    value = raw.get(key)
    if value is None:
        return default
    if isinstance(value, str) and value.strip():
        return value
    raise ValueError(f"{where}: {key} must be null or a non-empty string")


def _finding_from_controller(raw: object, index: int, text: str) -> Finding | str:
    """Map one Controller wire object to a Finding, or return a problem string.

    ``index`` is the object's position in the ``findings`` array, the only
    locator a problem has before an id is known.
    """
    if not isinstance(raw, dict):
        return f"Controller findings[{index}] is not an object"
    raw = cast(dict[str, object], raw)
    finding_id = raw.get("id")
    if not isinstance(finding_id, str) or not finding_id:
        return f"Controller findings[{index}] is missing a string id"
    line = _line_of_finding_id(text, finding_id)
    where = f"{finding_id} (line {line})"

    for key in ("status", "area", "entry", "title"):
        value = raw.get(key)
        if not isinstance(value, str) or not value:
            return f"{where}: missing string field '{key}'"
    try:
        blocked = _optional_string_field(raw, "blocked", BLOCKER_NONE, where)
        root = _optional_string_field(raw, "root", "-", where)
    except ValueError as exc:
        return str(exc)

    body_lines: list[str] = []
    body_text = raw.get("body")
    if isinstance(body_text, str) and body_text.strip():
        body_lines.append(body_text)

    files = raw.get("files")
    if files is None:
        files = []
    elif not isinstance(files, list):
        return f"{where}: files must be an array"
    for path in files:
        if not isinstance(path, str) or not path.strip():
            return f"{where}: files entries must be non-empty strings"
        # Feed paths() / related the same backtick form the markdown ledger uses.
        body_lines.append(f"* **Where:** `{path}`.")

    brief = raw.get("decision_brief")
    if isinstance(brief, dict):
        for label, key in (
            ("Decision", "question"),
            ("Recommend", "recommend"),
            ("Session", "session_id"),
        ):
            value = brief.get(key)
            if isinstance(value, str) and value.strip():
                body_lines.append(f"* **{label}:** {value}")

    status = cast(str, raw["status"])
    if status == "rejected" and not any(REJECTED_RE.search(item) for item in body_lines):
        triage = raw.get("triage")
        evidence = triage.get("evidence") if isinstance(triage, dict) else None
        if isinstance(evidence, str) and evidence.strip():
            reason = evidence
        elif isinstance(body_text, str) and body_text.strip():
            reason = body_text
        else:
            reason = "Controller triage rejected this finding"
        body_lines.append(f"* **Why rejected:** {reason}")

    if not body_lines:
        return f"{where}: entry has no body and no files"

    return Finding(
        id=finding_id,
        status=status,
        area=cast(str, raw["area"]),
        root=root,
        entry=cast(str, raw["entry"]),
        blocked=blocked,
        title=cast(str, raw["title"]),
        section=CONTROLLER_EXPORT_SECTION,
        line=line,
        body=body_lines,
        body_fenced=[False] * len(body_lines),
        source_sha256=_sha256_text(
            json.dumps(raw, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        ),
    )


def parse_controller_export(
    payload: dict[str, object], text: str, manifest: Path
) -> tuple[list[Finding], list[str], frozenset[str]]:
    """Parse a Controller-generated JSON ledger export."""
    vocabulary = load_vocabulary_from_project_manifest(manifest)
    findings: list[Finding] = []
    problems: list[str] = []
    for index, raw in enumerate(cast(list[object], payload["findings"])):
        mapped = _finding_from_controller(raw, index, text)
        if isinstance(mapped, str):
            problems.append(mapped)
        else:
            findings.append(mapped)
    return findings, problems, vocabulary


def parse(path: Path = LEDGER) -> tuple[list[Finding], list[str], frozenset[str]]:
    text = path.read_text(encoding="utf-8")
    controller = _controller_export_payload(text)
    if controller is not None:
        # The manifest sits beside ``tasks/``; derived from the ledger's own path
        # so a scratch candidate next to the ledger resolves the same file.
        return parse_controller_export(
            controller, text, path.parent.parent / PROJECT_MANIFEST_NAME
        )
    lines = text.splitlines()
    fence_states = _fence_mask(lines)
    vocabulary = load_vocabulary(lines, fence_states)

    findings: list[Finding] = []
    problems: list[str] = []
    _, header_matches, orphans = _unfenced_header_matches(text, fence_states)
    headers_by_heading = {
        heading_index: (header_index, match)
        for heading_index, header_index, match in header_matches
    }
    problems.extend(
        f"line {idx + 1}: orphaned header line was not attached to an eligible '### ' "
        "heading by the parser's forward lookahead"
        for idx, _match in orphans
    )
    section = "(none)"
    pending: Finding | None = None
    # 1-based line of the header already consumed by the lookahead below, so the
    # main loop does not re-encounter it and report it as a duplicate.
    consumed_header_line = -1

    for idx, line in enumerate(lines, start=1):
        fence_state = fence_states[idx - 1]
        if fence_state is FenceState.CONTENT:
            if pending is not None and line.strip():
                pending.body.append(line)
                pending.body_fenced.append(True)
            continue
        if fence_state is FenceState.DELIMITER:
            continue
        if line.startswith("# "):
            pending = None
            continue
        if line.startswith("## "):
            pending = None
            section = line[3:].strip()
            continue
        if line.startswith("### "):
            title = line[4:].strip()
            header_info = headers_by_heading.get(idx - 1)
            if header_info is None:
                problems.append(
                    f"line {idx}: '{title}' has no valid header line as its first bullet"
                )
                pending = None
                continue
            header_index, match = header_info
            consumed_header_line = header_index + 1
            pending = Finding(
                id=match.group("id"),
                status=match.group("status"),
                area=match.group("area"),
                root=match.group("root"),
                entry=match.group("entry"),
                blocked=match.group("blocked"),
                title=title,
                section=section,
                line=idx,
            )
            findings.append(pending)
            continue
        if pending is None:
            continue
        if idx == consumed_header_line:
            continue
        governed_by = GOVERNED_BY_RE.fullmatch(line)
        if governed_by is not None:
            if pending.governed_by:
                problems.append(
                    f"{pending.id} (line {idx}): a second '**Governed-by:**' "
                    "bullet in one entry — the contract allows exactly one"
                )
            else:
                pending.governed_by.update(
                    match.group("id")
                    for match in QUALIFIED_DECISION_RE.finditer(
                        governed_by.group("ids")
                    )
                    if match.group("owner") in {None, "local"}
                )
        if HEADER_MARKER in line and line.startswith("* "):
            # The first header was consumed above; any further one is a second
            # header in the same entry, which the contract forbids.
            problems.append(
                f"{pending.id} (line {idx}): a second header line in one entry — "
                "the contract allows exactly one"
            )
            continue
        if line.strip() and not HRULE_RE.fullmatch(line):
            pending.body.append(line)
            pending.body_fenced.append(False)

    return findings, problems, vocabulary


def validate(
    findings: list[Finding],
    problems: list[str],
    vocabulary: frozenset[str],
    *,
    allow_pending: bool = False,
) -> list[str]:
    issues = list(problems)
    seen: dict[str, Finding] = {}

    for f in findings:
        where = f"{f.id} (line {f.line})"
        blocker_class = classify_blocker(f.blocked)
        id_match = ID_RE.match(f.id)
        if f.id == PENDING_ID and allow_pending:
            id_match = None
        elif not id_match:
            issues.append(f"{where}: id must be f-YYYYMMDD-nn")
        else:
            try:
                datetime.strptime(id_match.group(1), "%Y%m%d").astimezone()
            except ValueError:
                issues.append(
                    f"{where}: id carries an impossible date '{id_match.group(1)}'"
                )
        if f.id in seen:
            issues.append(
                f"{where}: duplicate id, first seen at line {seen[f.id].line}"
            )
        seen[f.id] = f
        if f.status not in STATUSES:
            issues.append(f"{where}: status '{f.status}' not in {sorted(STATUSES)}")
        if f.area not in vocabulary:
            issues.append(
                f"{where}: area '{f.area}' is not in the ledger's area vocabulary "
                f"{sorted(vocabulary)} — add it there deliberately or use an existing one"
            )
        if f.root != "-" and not SLUG_RE.match(f.root):
            issues.append(f"{where}: root '{f.root}' must be a slug or '-'")
        if f.entry not in ENTRIES:
            issues.append(f"{where}: entry '{f.entry}' not in {sorted(ENTRIES)}")
        if (
            blocker_class != BLOCKER_NONE
            and not f.controller_export
            and not SLUG_RE.match(f.blocked)
        ):
            issues.append(f"{where}: blocked '{f.blocked}' must be a slug or 'none'")
        if not f.body:
            issues.append(f"{where}: entry has a header but no body")

        for index, line in enumerate(f.body):
            is_fenced = index < len(f.body_fenced) and f.body_fenced[index]
            if is_fenced or not GOVERNED_BY_MARKER_RE.match(line):
                continue
            if GOVERNED_BY_RE.fullmatch(line) is None:
                issues.append(
                    f"{where}: '**Governed-by:**' must be a top-level '* ' bullet "
                    "listing one or more d-YYYYMMDD-nn, local:d-YYYYMMDD-nn, or "
                    "repo-slug:d-YYYYMMDD-nn decision references, comma-separated"
                )

        joined = _unfenced_body(f)
        sentry_origin = _body_is_sentry_origin(joined)
        if f.blocked in SENTRY_VERIFIER_BLOCKERS and not sentry_origin:
            issues.append(
                f"{where}: entry {f.id} is not Sentry-origin but carries verifier "
                f"blocker {f.blocked}; it must carry {FELIX_DECISION}"
            )
        if (
            f.status == "open"
            and sentry_origin
            and APPROVED_RE.search(joined) is None
            and f.blocked not in SENTRY_VERIFIER_BLOCKERS
        ):
            issues.append(
                f"{where}: Sentry-origin open finding without an '**Approved:**' "
                f"bullet must be blocked on {SENTRY_UNVERIFIED}"
            )
        if f.status == "handled" and "Still open" in joined:
            issues.append(
                f"{where}: status is 'handled' but the body still says 'Still open' — "
                "split the open part into its own finding"
            )
        if f.status == "rejected" and not REJECTED_RE.search(joined):
            issues.append(
                f"{where}: status 'rejected' needs a '**Why rejected:**' bullet with a "
                "stated reason why this is genuinely not a defect"
            )
        if f.status == "open" and f.blocked == FELIX_DECISION:
            issues.extend(_park_brief_issues(where, joined))

    return issues


def _park_brief_issues(where: str, joined: str) -> list[str]:
    """Check a `felix-decision` park's brief, reporting every missing part.

    Two properties that were both wrong until 2026-09-01:

    * **All missing markers are reported at once.** These were an ``elif``
      chain, so a brief missing three of them surfaced one per attempt. That is
      merely annoying for ``check``, but every locked ledger mutation validates
      the whole file first, so each undisclosed omission kept refusing every
      write to the ledger until someone guessed the next one.
    * **The markers are searched inside the brief, not the whole entry.** The
      contract places the brief last, running from ``**Decision:**`` to the end
      of the entry. Searching the whole body let an unrelated or historical
      ``**Product impact:**`` bullet somewhere above the question satisfy the
      gate for a question that never had one -- which is exactly the bypass the
      gate exists to close.
    """
    decision = DECISION_BRIEF_RE.search(joined)
    if decision is None:
        return [
            f"{where}: blocked on {FELIX_DECISION} but carries no "
            "'**Decision:**' bullet — state the question, the options and what "
            "each costs, while the investigation that produced them is loaded"
        ]

    brief = joined[decision.start() :]
    issues: list[str] = []
    if not RECOMMEND_RE.search(brief):
        issues.append(
            f"{where}: has a '**Decision:**' bullet but no '**Recommend:**' in "
            "the brief — park with a recommendation so answering is a "
            "confirmation, not an investigation"
        )
    if not SESSION_RE.search(brief):
        issues.append(
            f"{where}: has a '**Decision:**' brief but no '**Session:**' id — "
            "name the parking session so its transcript can be mined instead "
            "of the investigation being re-derived"
        )
    impact = PRODUCT_IMPACT_RE.search(brief)
    if impact is None:
        issues.append(
            f"{where}: has a '**Decision:**' brief but no "
            "'**Product impact:**' — state what a user of the app sees, gets, "
            "pays or is promised differently depending on the answer. If that "
            "sentence cannot be written, the question is technical and does "
            "not park: decide it, record it in tasks/decisions.md, and name "
            "the decision in the completion message"
        )
    elif VACUOUS_IMPACT_RE.match(impact.group("impact").strip()):
        issues.append(
            f"{where}: its '**Product impact:**' says there is none "
            f"({impact.group('impact').strip()!r}), which is the answer that "
            "disqualifies the park rather than satisfying it. A question with "
            "no product impact is technical: clear the blocker and decide it, "
            "or give it a slug naming the precondition it actually waits on"
        )
    return issues


def load_decisions(path: Path) -> list[Decision]:
    """Parse the sibling decisions ledger. Absent or empty is fine."""
    decision_lines = _read_decision_lines(path)
    if decision_lines is None:
        return []
    decisions: list[Decision] = []
    pending: Decision | None = None
    lines, mask = decision_lines
    for number, line in enumerate(lines, 1):
        # The mask governs the WHOLE line, not just whether its paths count. Until
        # 2026-08-22 it gated only the body, so a fenced example heading still became a
        # real decision and a fenced `Governs:` still created a binding link -- the
        # ledger documents its own entry shape in exactly such a fence.
        if mask[number - 1] is not FenceState.OUTSIDE:
            if pending is not None:
                pending.body.append(line)
                pending.body_fenced.append(True)
            continue
        match = DECISION_RE.match(line)
        if match:
            pending = Decision(
                match.group("id"),
                match.group("question").strip(),
                set(),
                line=number,
            )
            decisions.append(pending)
            continue
        if pending is None:
            continue
        pending.body.append(line)
        pending.body_fenced.append(False)
        governs = GOVERNS_RE.search(line)
        if governs:
            pending.governs.update(
                match.group("id")
                for match in QUALIFIED_FINDING_RE.finditer(governs.group("ids"))
                if match.group("owner") in {None, "local"}
            )
        superseded_by = SUPERSEDED_BY_RE.search(_mask_inline_code_spans(line))
        if superseded_by:
            refs = superseded_by.group("refs").replace("`", "")
            pending.superseded_by = "" if refs == "-" else refs
    return decisions


def duplicate_decision_ids(decisions_path: Path) -> list[str]:
    """Report any id carried by two different decision headings.

    A decision id is the stable reference everything else cites — findings carry
    it in ``Governed-by:``, plans and commit messages name it. A duplicate makes
    every one of those citations unresolvable without reading both entries and
    guessing from context, which is exactly how `f-20260820-09` was found: a plan
    cited `d-20260819-20` and the reviewing lenses could not tell which decision
    was meant.

    **Fatal, not a warning.** A duplicate is born the moment a run appends a
    decision without looking at what the last one took, and at that moment it is
    free to fix — nothing cites the new entry yet. One citation later, renumbering
    trades the duplicate for a dangling reference. So this has to bite at creation
    time, which is `check` running after every cluster.
    """
    seen: dict[str, int] = {}
    issues: list[str] = []
    for decision in load_decisions(decisions_path):
        first = seen.get(decision.id)
        if first is None:
            seen[decision.id] = decision.line
            continue
        issues.append(
            f"{decisions_path}:{decision.line}: decision id {decision.id} is "
            f"already used at line {first}. Keep it on the entry with live "
            f"inbound references and give this one the next free id for its date."
        )
    return issues


def malformed_decision_headings(decisions_path: Path) -> list[str]:
    """Report a heading that tries to be a decision and misses the strict form.

    `DECISION_RE` is exact, so a heading written with a plain hyphen or at the
    wrong level is not a malformed decision to the parser — it is not a decision
    at all. It then carries an id nothing can see, which is precisely what
    `duplicate_decision_ids` above has to see to do its job: the escaped entry can
    reuse a live id and `check` stays green. Reported separately from the
    duplicates so the message names the real problem rather than its consequence.
    """
    decision_lines = _read_decision_lines(decisions_path)
    if decision_lines is None:
        return []
    issues: list[str] = []
    lines, mask = decision_lines
    for number, line in enumerate(lines, 1):
        if mask[number - 1] is not FenceState.OUTSIDE:
            continue
        if DECISION_MARKER_RE.match(line) and not DECISION_RE.match(line):
            issues.append(
                f"{decisions_path}:{number}: malformed decision heading. Expected "
                "'### d-YYYYMMDD-nn — <the question, as a question>'."
            )
    return issues


def malformed_superseded_trailers(decisions_path: Path) -> list[str]:
    """Report a supersession trailer whose reference list or sentinel is malformed.

    The decisions ledger documents its own format in fenced examples, so the same
    mask as ``load_decisions`` and ``malformed_decision_headings`` must govern this
    validation scan too. A malformed trailer is an explicit authoring error, not an
    absent supersession link that the queue should silently ignore.
    """
    decision_lines = _read_decision_lines(decisions_path)
    if decision_lines is None:
        return []
    lines, mask = decision_lines
    issues: list[str] = []
    for number, line in enumerate(lines, 1):
        if mask[number - 1] is not FenceState.OUTSIDE:
            continue
        masked_line = _mask_inline_code_spans(line)
        if any(
            SUPERSEDED_BY_RE.match(masked_line, marker.start()) is None
            for marker in SUPERSEDED_BY_MARKER_RE.finditer(masked_line)
        ):
            issues.append(
                f"{decisions_path}:{number}: malformed Superseded-by trailer. "
                "Expected '**Superseded-by:** d-YYYYMMDD-nn', "
                "'**Superseded-by:** local:d-YYYYMMDD-nn', "
                "'**Superseded-by:** repo-slug:d-YYYYMMDD-nn', or "
                "'**Superseded-by:** -'; references may be comma-separated, "
                "optionally backtick-quoted and "
                "followed by punctuation."
            )
    return issues


def cluster_members(findings: list[Finding], key: tuple[str, str]) -> list[Finding]:
    return [f for f in findings if f.pickable and f.cluster_key == key]


def rank(findings: list[Finding]) -> list[tuple[tuple[str, str], list[Finding]]]:
    """Pickable root clusters and singletons, ordered by relation then age."""
    keys: list[tuple[str, str]] = []
    for f in findings:
        if f.pickable and f.cluster_key not in keys:
            keys.append(f.cluster_key)
    clusters = [(key, cluster_members(findings, key)) for key in keys]

    def sort_key(item: tuple[tuple[str, str], list[Finding]]) -> tuple[int, str]:
        (kind, _name), members = item
        # Root relation comes first, then the oldest member; size never ranks work.
        return (0 if kind == "root" else 1, min(m.id for m in members))

    return sorted(clusters, key=sort_key)


def _warn_problems(issues: list[str], command: str) -> None:
    for issue in issues:
        print(f"WARN {issue}", file=sys.stderr)
    if issues:
        print(
            f"WARN {command} ran against a ledger with {len(issues)} validation "
            "problem(s). Run `check`.",
            file=sys.stderr,
        )


def _count_pending_inbox(inbox: Path) -> tuple[int, bool, list[Path]]:
    """Count filed-but-unmerged entries, and whether the spool sweep was complete.

    The completeness flag is ``_enumerate_orphan_parts``' own: a part whose
    ``stat`` raised is dropped from the list, and only the flag distinguishes
    that from a spool that held nothing. `summary` reports it; the advisory
    duplicate warning ignores it.

    Returns the count, the flag and the files that were read, so the warning
    can name the directories without walking the spool a second time.
    """
    legacy = LEGACY_INBOX if inbox == INBOX else inbox.with_suffix(".md")
    claim = CLAIM if inbox == INBOX else inbox.with_name(f"{inbox.name}.claim")
    sources = sorted(inbox.glob("*.md"))
    orphan_parts, complete = _enumerate_orphan_parts(inbox)
    sources += orphan_parts
    # A prepared or refused batch sits in the claim, outside both the ledger and the spool.
    # Leaving it out here is the worst of the three: `related` would answer
    # "this looks new" about a finding that is already filed but unmergeable,
    # so the duplicate gets written AND the unresolved refusal stays quiet.
    sources += sorted(claim.glob("*.md"))
    if legacy.exists():
        sources.append(legacy)
    # A merge running in another terminal renames these files out from under the
    # glob. That is normal and means the entries are being consumed right now, so
    # a vanished file is skipped rather than crashing a read-only query.
    read: list[tuple[Path, str]] = []
    for p in sources:
        try:
            read.append((p, p.read_text(encoding="utf-8")))
        except FileNotFoundError:
            continue
    # Count ENTRIES, not allocated ids. `header_ids` deliberately reports only ids
    # that are taken, and a spooled entry carries `**ID:** f-PENDING` by contract --
    # so counting ids reported 0 pending for exactly the normal case, and `related`
    # printed no warning at all about a spool that was holding work. That is the one
    # thing this function exists to prevent. Found by a push review lens, 2026-08-22.
    pending = 0
    for _, text in read:
        _lines, headers, orphans = _unfenced_header_matches(text)
        pending += len(headers) + len(orphans)
    return pending, complete, [p for p, _ in read]


def _warn_pending_inbox(inbox: Path) -> None:
    """A duplicate check that cannot see the inbox invites the duplicate.

    Entries filed during a drain are not in the ledger yet, so `related` would
    answer "looks new" about something already filed — and the collision only
    surfaces later, as a duplicate id that refuses the whole merge.
    """
    # The completeness flag belongs to `summary`, which reports it; here a
    # dropped part only weakens a duplicate warning that is advisory anyway.
    pending, _complete, sources = _count_pending_inbox(inbox)
    if not pending:
        return
    claim = CLAIM if inbox == INBOX else inbox.with_name(f"{inbox.name}.claim")
    # Name the directories that actually hold something; `inbox` alone may not
    # even exist when the pending entries are in the claim or at the legacy path.
    where = ", ".join(dict.fromkeys(str(p.parent) for p in sources))
    print(
        f"NOTE {pending} finding(s) are pending in {where} and are not listed "
        "below. Read them before filing.",
        file=sys.stderr,
    )
    if any(p.parent == claim for p in sources):
        try:
            intent = _read_claim_intent(claim)
        except LedgerError:
            intent = None
        if intent is not None and intent.phase == "prepared":
            print(
                f"NOTE a prepared claim at {claim} awaits proof that its ledger "
                "write is durable; findings.py finalize-claims releases it once "
                "it is committed, and the next merge replays whatever the commit "
                "discarded",
                file=sys.stderr,
            )
        else:
            print(
                f"NOTE a previously refused batch is unresolved in {claim}; "
                "merging is blocked until it is fixed.",
                file=sys.stderr,
            )


def _split_markdown_row(line: str) -> list[str]:
    """Split one pipe table row into stripped cells."""
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    if stripped.endswith("|"):
        stripped = stripped[:-1]
    return [cell.strip() for cell in stripped.split("|")]


def _is_table_separator(cells: list[str]) -> bool:
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def _plan_adopted_cell_ok(cell: str) -> bool:
    """True for ``not-recorded`` or sequential labelled counts ``r1=6 r2=2 r3=0``."""
    if cell == PLAN_ADOPTED_NOT_RECORDED:
        return True
    parts = cell.split(" ")
    if not parts or parts == [""]:
        return False
    for index, part in enumerate(parts, start=1):
        match = _PLAN_ADOPTED_TOKEN_RE.fullmatch(part)
        if match is None or int(match.group(1)) != index:
            return False
    return True


def validate_plan_adopted_column(path: Path) -> list[str]:
    """D6: well-formed ``plan_adopted_per_round`` cells, only when a header names it.

    A missing file, or a table whose header row does not name the column, is
    not an error — today's ledgers have no such column. Unfenced tables only:
    a fenced format example must not be validated as data. Blank lines between
    row groups under one header do not end the table; a new header row or a
    non-table line does. A pipe row whose cell count differs from the header
    is malformed (an interior ``|`` in a cell is the usual cause).
    """
    if not path.is_file():
        return []
    try:
        text = path.read_text(encoding="utf-8")
    except _READ_ERRORS as exc:
        return [f"could not read {path}: {exc}"]
    try:
        lines = text.splitlines()
        fence_states = _fence_mask(lines)
    except LedgerError as exc:
        return [f"{path}: {exc}"]

    issues: list[str] = []
    index = 0
    n_lines = len(lines)
    while index < n_lines:
        if fence_states[index] is not FenceState.OUTSIDE or "|" not in lines[index]:
            index += 1
            continue
        cells = _split_markdown_row(lines[index])
        if PLAN_ADOPTED_COLUMN not in cells:
            index += 1
            continue
        column = cells.index(PLAN_ADOPTED_COLUMN)
        header_width = len(cells)
        sep_index = index + 1
        while sep_index < n_lines and not lines[sep_index].strip():
            sep_index += 1
        if (
            sep_index >= n_lines
            or fence_states[sep_index] is not FenceState.OUTSIDE
            or not _is_table_separator(_split_markdown_row(lines[sep_index]))
        ):
            index += 1
            continue
        row_index = sep_index + 1
        while row_index < n_lines:
            if fence_states[row_index] is not FenceState.OUTSIDE:
                break
            row_line = lines[row_index]
            if not row_line.strip():
                row_index += 1
                continue
            if "|" not in row_line:
                break
            row_cells = _split_markdown_row(row_line)
            if _is_table_separator(row_cells):
                row_index += 1
                continue
            if PLAN_ADOPTED_COLUMN in row_cells:
                break
            where = f"{path}:{row_index + 1}"
            if len(row_cells) != header_width:
                issues.append(
                    f"{where}: row has {len(row_cells)} cells, "
                    f"header has {header_width}"
                )
            else:
                cell = row_cells[column]
                if not _plan_adopted_cell_ok(cell):
                    issues.append(
                        f"{where}: {PLAN_ADOPTED_COLUMN} cell {cell!r} is not "
                        "well-formed — expected 'r1=6 r2=2 r3=0' (labelled "
                        f"counts) or '{PLAN_ADOPTED_NOT_RECORDED}'"
                    )
            row_index += 1
        index = row_index
    return issues


def _print_json(payload: object) -> int:
    """Write one complete JSON value to stdout. Returns 0 for ``return`` sites."""
    print(json.dumps(payload, ensure_ascii=False))
    return 0


def _json_requested(args: argparse.Namespace) -> bool:
    """True when ``--json`` was set. Direct callers may omit the attribute."""
    return bool(getattr(args, "json", False))


def _citation_line_ordinal(
    entry: str,
    cited: str,
    line: str,
    duplicate_lines: dict[tuple[str, str, str], int],
    ordinals_on_line: dict[str, int],
) -> int:
    """Allocate one ordinal per identical source line and cited id."""
    ordinal = ordinals_on_line.get(cited)
    if ordinal is None:
        key = (entry, cited, line)
        ordinal = duplicate_lines.get(key, 0) + 1
        duplicate_lines[key] = ordinal
        ordinals_on_line[cited] = ordinal
    return ordinal


def _append_citation_occurrences(
    occurrences: list[CitationOccurrence],
    issues: list[str],
    pattern: re.Pattern[str],
    *,
    path: Path,
    source: str,
    entry: str,
    line_number: int,
    line: str,
    duplicate_lines: dict[tuple[str, str, str], int],
    ordinals_on_line: dict[str, int],
) -> None:
    """Append valid references while rejecting their complete malformed owners."""
    for match in pattern.finditer(line):
        owner = match.group("owner")
        cited = match.group("id")
        if owner is not None and SLUG_RE.fullmatch(owner) is None:
            issues.append(
                f"{path}:{line_number}: malformed citation qualifier for {cited}"
            )
            continue
        occurrences.append(
            CitationOccurrence(
                source,
                entry,
                cited,
                owner,
                line_number,
                line,
                _citation_line_ordinal(
                    entry, cited, line, duplicate_lines, ordinals_on_line
                ),
            )
        )


def _citation_occurrences(
    path: Path, source: str, *, text: str | None = None
) -> tuple[list[CitationOccurrence], list[str]]:
    if text is None:
        if not path.exists():
            return [], []
        text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    mask = _fence_mask(lines)
    occurrences: list[CitationOccurrence] = []
    issues: list[str] = []
    current_entry = ""
    pending_finding_heading = False
    duplicate_lines: dict[tuple[str, str, str], int] = {}
    for index, line in enumerate(lines):
        if mask[index] is not FenceState.OUTSIDE:
            continue
        if line.startswith(LEDGER_META_PREFIX):
            continue
        if source == "decisions":
            heading = DECISION_RE.match(line)
            if heading is not None:
                current_entry = heading.group("id")
                continue
            if line.startswith(("# ", "## ")):
                current_entry = ""
                continue
        else:
            if line.startswith("### "):
                pending_finding_heading = True
                current_entry = ""
                continue
            if pending_finding_heading:
                header_match = HEADER_RE.match(line)
                if header_match is not None:
                    current_entry = header_match.group("id")
                    pending_finding_heading = False
                    continue
            if line.startswith(("# ", "## ")):
                current_entry = ""
                continue
        if not current_entry:
            continue
        ordinals_on_line: dict[str, int] = {}

        _append_citation_occurrences(
            occurrences,
            issues,
            QUALIFIED_DECISION_RE,
            path=path,
            source=source,
            entry=current_entry,
            line_number=index + 1,
            line=line,
            duplicate_lines=duplicate_lines,
            ordinals_on_line=ordinals_on_line,
        )
        if GOVERNS_RE.search(line) is not None:
            _append_citation_occurrences(
                occurrences,
                issues,
                QUALIFIED_FINDING_RE,
                path=path,
                source=source,
                entry=current_entry,
                line_number=index + 1,
                line=line,
                duplicate_lines=duplicate_lines,
                ordinals_on_line=ordinals_on_line,
            )
    return occurrences, issues


def _citation_context_key(data: dict[str, object]) -> tuple[object, ...]:
    return (
        data.get("source"),
        data.get("entry"),
        data.get("cited"),
        data.get("line_sha256"),
        data.get("occurrence"),
    )


def _citation_resolution(
    ledger_path: Path,
    decisions_path: Path,
    *,
    ledger_text: str | None = None,
    ledger_metadata: list[LedgerMeta] | None = None,
    decision_text: str | None = None,
    decision_metadata: list[LedgerMeta] | None = None,
) -> tuple[dict[str, set[str]], list[str]]:
    finding_occurrences, issues = _citation_occurrences(
        ledger_path, "findings", text=ledger_text
    )
    decision_occurrences, decision_scan_issues = _citation_occurrences(
        decisions_path, "decisions", text=decision_text
    )
    issues.extend(decision_scan_issues)
    if decision_text is None:
        decision_text = (
            decisions_path.read_text(encoding="utf-8")
            if decisions_path.exists()
            else ""
        )
    if decision_metadata is None:
        decision_metadata, metadata_issues = _scan_ledger_metadata(
            decision_text, decisions_path
        )
        issues.extend(metadata_issues)
    if ledger_text is None:
        ledger_text = ledger_path.read_text(encoding="utf-8")
    if ledger_metadata is None:
        ledger_metadata, ledger_metadata_issues = _scan_ledger_metadata(
            ledger_text, ledger_path
        )
        issues.extend(ledger_metadata_issues)
    for meta in ledger_metadata:
        if meta.data.get("kind") == CITATION_CONTEXT_KIND:
            issues.append(
                f"{ledger_path}:{meta.line}: citation-context declarations are "
                "allowed only in decisions.md"
            )
    contexts: dict[tuple[object, ...], LedgerMeta] = {}
    decision_lines = decision_text.splitlines()
    decision_mask = _fence_mask(decision_lines)
    decision_entry_at_line: dict[int, str] = {}
    current_decision = ""
    for index, line in enumerate(decision_lines):
        if decision_mask[index] is not FenceState.OUTSIDE:
            continue
        if (heading := DECISION_RE.match(line)) is not None:
            current_decision = heading.group("id")
        elif line.startswith(("# ", "## ")):
            current_decision = ""
        decision_entry_at_line[index + 1] = current_decision
    for meta in decision_metadata:
        if meta.data.get("kind") != CITATION_CONTEXT_KIND:
            continue
        if not decision_entry_at_line.get(meta.line):
            issues.append(
                f"{decisions_path}:{meta.line}: citation-context declaration "
                "must be inside a decision entry"
            )
            continue
        if _metadata_schema_issues(meta, decisions_path):
            continue
        key = _citation_context_key(meta.data)
        if key in contexts:
            issues.append(
                f"{decisions_path}:{meta.line}: duplicate or conflicting "
                "citation-context declaration"
            )
        else:
            contexts[key] = meta
    local_decisions = {decision.id for decision in load_decisions(decisions_path)}
    local_findings = {finding.id for finding in parse(ledger_path)[0]}
    resolved: dict[str, set[str]] = {}
    used_contexts: set[tuple[object, ...]] = set()
    for occurrence in finding_occurrences + decision_occurrences:
        if occurrence.cited_id.startswith("f-"):
            if occurrence.owner not in {None, "local"}:
                continue
            if occurrence.cited_id not in local_findings:
                issues.append(
                    f"{(ledger_path if occurrence.source == 'findings' else decisions_path)}:"
                    f"{occurrence.line}: unknown local finding citation "
                    f"{occurrence.cited_id}"
                )
            continue
        if occurrence.owner not in {None, "local"}:
            continue
        key = (
            occurrence.source,
            occurrence.entry,
            occurrence.cited_id,
            _sha256_text(occurrence.line_text),
            occurrence.occurrence,
        )
        context = contexts.get(key)
        if context is not None and occurrence.owner is None:
            used_contexts.add(key)
            if context.data.get("status") == "historical-error":
                corrections = cast(list[str], context.data["corrections"])
                missing = [value for value in corrections if value not in local_decisions]
                if missing:
                    issues.append(
                        f"{decisions_path}:{context.line}: citation-context has "
                        f"nonexistent correction ids {missing}"
                    )
                resolved.setdefault(occurrence.entry, set()).update(corrections)
            continue
        if occurrence.cited_id not in local_decisions:
            source_path = ledger_path if occurrence.source == "findings" else decisions_path
            issues.append(
                f"{source_path}:{occurrence.line}: unknown local decision citation "
                f"{occurrence.cited_id}"
            )
        else:
            resolved.setdefault(occurrence.entry, set()).add(occurrence.cited_id)
    for key, meta in contexts.items():
        if key not in used_contexts:
            issues.append(
                f"{decisions_path}:{meta.line}: unused citation-context declaration"
            )
    return resolved, issues


def cmd_check(args: argparse.Namespace) -> int:
    if os.environ.get(PLAN_ONLY_ENV) != "1" and ensure_merge_driver(
        cast(Path, REPO_ROOT)
    ):
        print(f"installed git merge driver {MERGE_DRIVER_NAME}", file=sys.stderr)
    findings, problems, vocabulary = parse(args.ledger)
    issues = validate(findings, problems, vocabulary)
    ledger_text = args.ledger.read_text(encoding="utf-8")
    ledger_metadata, ledger_meta_issues = _scan_ledger_metadata(
        ledger_text, args.ledger
    )
    issues += ledger_meta_issues
    issues += _receipt_effect_issues(ledger_text, args.ledger, ledger_metadata)
    # The sibling decisions ledger may be absent only while no local decision is
    # cited. When present, its ids and metadata are load-bearing for this file.
    # Counted separately so the summary names the file the reader has to open;
    # each message carries its own path for the same reason.
    decision_issues = malformed_decision_headings(args.decisions)
    decision_issues += malformed_superseded_trailers(args.decisions)
    decision_issues += duplicate_decision_ids(args.decisions)
    decision_text = ""
    decision_metadata: list[LedgerMeta] = []
    if args.decisions.exists():
        decision_text = args.decisions.read_text(encoding="utf-8")
        decision_metadata, decision_meta_issues = _scan_ledger_metadata(
            decision_text, args.decisions
        )
        decision_issues += decision_meta_issues
        decision_issues += _receipt_effect_issues(
            decision_text, args.decisions, decision_metadata
        )
    _resolved_citations, citation_issues = _citation_resolution(
        args.ledger,
        args.decisions,
        ledger_text=ledger_text,
        ledger_metadata=ledger_metadata,
        decision_text=decision_text,
        decision_metadata=decision_metadata,
    )
    decision_issues += citation_issues
    build_ledger = args.ledger.parent / "build-ledger.md"
    build_issues = validate_plan_adopted_column(build_ledger)
    if issues or decision_issues or build_issues:
        for issue in issues + decision_issues + build_issues:
            print(f"FAIL {issue}", file=sys.stderr)
        where = ", ".join(
            str(path)
            for path, found in (
                (args.ledger, issues),
                (args.decisions, decision_issues),
                (build_ledger, build_issues),
            )
            if found
        )
        print(
            f"\n{len(issues) + len(decision_issues) + len(build_issues)} "
            f"problem(s) in {where}",
            file=sys.stderr,
        )
        return 1
    buckets = summary_buckets(findings)
    print(
        f"ok: {buckets.total} findings, {len(buckets.pickable)} pickable, "
        f"{buckets.blocked} blocked"
    )
    return 0


def _summary_blocker_slug(finding: Finding) -> str:
    """The slug queue-facing surfaces print, including derived verifier drift.

    A drifted Sentry-origin finding keeps ``Blocked: none`` on the ledger after
    approval cleared the slug; ``list``/``next`` already substitute
    ``sentry-unverified`` so the row still names the wait. Summary must emit
    the same slug: otherwise ``kit findings`` groups the row under product
    decisions because ``waiting[].class`` is only ``answerable|precondition``.
    """
    if finding.sentry_verification == "drifted":
        return SENTRY_UNVERIFIED
    return finding.blocked


def _summary_waiting_row(finding: Finding) -> str:
    """One waiting row: id, the slug it waits on, and its heading."""
    return f"  {finding.id}  {_summary_blocker_slug(finding)}  {finding.title}"


def _render_summary_text(
    buckets: SummaryBuckets, counts_line: str, pending: int, inbox_complete: bool
) -> None:
    """The overview: counts line, then who waits, then what is drainable."""
    print(counts_line)
    print()
    print("WAITING ON YOU")
    # Three labelled groups in the order Felix reads them: what needs a product
    # answer, what the machine verifies, then what only he can make true. An
    # empty group is omitted rather than shown as a bare zero.
    for label, rows in (
        ("product decisions", buckets.product),
        ("Sentry approvals", buckets.approvals),
        ("preconditions", buckets.preconditions),
    ):
        if not rows:
            continue
        print(f"{label} ({len(rows)})")
        for finding in rows:
            print(_summary_waiting_row(finding))
    print()
    print("PICKABLE")
    print(f"  {len(buckets.pickable)} pickable finding(s)")
    for finding in buckets.pickable:
        print(f"  {finding.id}  {finding.area}  {finding.entry}  {finding.title}")
    print()
    print("BLOCKED")
    # Grouped by slug so two findings waiting on the same thing read as one
    # clearance. Each row repeats its slug: a row lifted out of this section
    # must still say what it waits on.
    by_slug: dict[str, list[Finding]] = {}
    for finding in buckets.external:
        by_slug.setdefault(finding.blocked, []).append(finding)
    for slug, rows in by_slug.items():
        print(f"{slug} ({len(rows)})")
        for finding in rows:
            print(f"  {finding.id}  {slug}  {finding.title}")
    print()
    print("PENDING INBOX")
    if inbox_complete:
        print(f"pending inbox: {pending}")
    else:
        print(f"pending inbox: {pending} (incomplete scan)")


def _summary_json_payload(
    buckets: SummaryBuckets,
    counts_line: str,
    pending: int,
    inbox_complete: bool,
    validation_problems: int,
) -> dict[str, object]:
    """The versioned object the drain's preflight and `kit findings` read."""

    def waiting_rows(rows: tuple[Finding, ...], row_class: str) -> list[dict[str, str]]:
        return [
            {
                "id": finding.id,
                "blocked": _summary_blocker_slug(finding),
                "heading": finding.title,
                "class": row_class,
            }
            for finding in rows
        ]

    return {
        "schema": FINDINGS_SUMMARY_SCHEMA,
        "counts": {
            "total": buckets.total,
            "handled": buckets.handled,
            "rejected": buckets.rejected,
            "open": buckets.open_,
            "pickable": len(buckets.pickable),
            "decisions": len(buckets.product),
            "sentry": len(buckets.approvals),
            "preconditions": len(buckets.preconditions),
            "external": len(buckets.external),
            "blocked": buckets.blocked,
            "pending_inbox": pending,
        },
        "summary_line": counts_line,
        "waiting": (
            waiting_rows(buckets.product, "answerable")
            + waiting_rows(buckets.approvals, "answerable")
            + waiting_rows(buckets.preconditions, "precondition")
        ),
        "pickable": [
            {
                "id": finding.id,
                "area": finding.area,
                "entry": finding.entry,
                "heading": finding.title,
            }
            for finding in buckets.pickable
        ],
        "external": [
            {"id": finding.id, "blocked": finding.blocked, "heading": finding.title}
            for finding in buckets.external
        ],
        "pending_inbox_complete": inbox_complete,
        "validation_problems": validation_problems,
    }


def cmd_summary(args: argparse.Namespace) -> int:
    """One read-only overview of the ledger: text, or ``--json`` for consumers.

    Read-only and lock-free, like ``list``. A ledger with validation problems
    still answers with counts and warns on stderr, so one damaged entry does not
    hide the rest of the queue; only an unparseable ledger fails.
    """
    findings, problems, vocabulary = parse(args.ledger)
    issues = validate(findings, problems, vocabulary)
    _warn_problems(issues, "summary")
    buckets = summary_buckets(findings)
    pending, inbox_complete, _sources = _count_pending_inbox(args.inbox)
    counts_line = _summary_counts_line(buckets)
    if _json_requested(args):
        return _print_json(
            _summary_json_payload(
                buckets, counts_line, pending, inbox_complete, len(issues)
            )
        )
    _render_summary_text(buckets, counts_line, pending, inbox_complete)
    return 0


def _raw_entry_records(path: Path, findings: list[Finding]) -> dict[int, dict[str, str]]:
    """Hash each entry's exact source-byte slice and retain its section.

    A Controller finding has no byte slice of its own (the export is one JSON
    payload), so its record carries the digest of its canonical JSON object,
    computed at parse time.

    The parser intentionally works on decoded lines, but the planner digest is
    a source identity. Re-encode the decoded ``splitlines(keepends=True)``
    chunks only to recover their byte offsets; UTF-8 is round-tripping here, and
    the hash itself is taken from the original bytes, including CRLF and spaces.
    """
    raw = path.read_bytes()
    text = raw.decode("utf-8")
    lines = text.splitlines()
    chunks = text.splitlines(keepends=True)
    if len(lines) != len(chunks):
        raise LedgerError(f"could not map source lines in {path} to byte offsets")
    offsets: list[int] = [0]
    for chunk in chunks:
        offsets.append(offsets[-1] + len(chunk.encode("utf-8")))
    fence_states = _fence_mask(lines)
    records: dict[int, dict[str, str]] = {}
    for finding in findings:
        if finding.source_sha256 is not None:
            records[finding.line] = {
                "entry_sha256": finding.source_sha256,
                "section": finding.section,
            }
            continue
        start_index = finding.line - 1
        if start_index < 0 or start_index >= len(lines):
            raise LedgerError(
                f"could not locate entry {finding.id} in source bytes of {path}"
            )
        end_index = len(lines)
        for index in range(start_index + 1, len(lines)):
            if fence_states[index] is not FenceState.OUTSIDE:
                continue
            if lines[index].startswith(("### ", "## ")):
                end_index = index
                break
        entry_bytes = raw[offsets[start_index] : offsets[end_index]]
        records[finding.line] = {
            "entry_sha256": _sha256_bytes(entry_bytes),
            "section": finding.section,
        }
    return records


def _list_json_records(
    rows: list[Finding],
    tooling_areas: frozenset[str],
    *,
    include_body: bool = False,
    raw_records: dict[int, dict[str, str]] | None = None,
) -> list[dict[str, object]]:
    """One JSON object per finding; field values are the Finding attributes."""
    result: list[dict[str, object]] = []
    for f in rows:
        record: dict[str, object] = {
            "id": f.id,
            "status": f.status,
            "area": f.area,
            "root": f.root,
            "entry": f.entry,
            "blocked": f.blocked,
            "heading": f.title,
            "tooling": f.area in tooling_areas,
            "sentry_verification": f.sentry_verification,
        }
        if include_body:
            record.update(
                {
                    "body": _unfenced_body(f),
                    "body_sha256": verified_body_sha256(f),
                }
            )
        if raw_records is not None:
            record.update(raw_records[f.line])
        result.append(record)
    return result


def cmd_list(args: argparse.Namespace) -> int:
    findings, problems, vocabulary = parse(args.ledger)
    # Full validation, not just parse problems: an entry with an invented area
    # parses fine, so a structural-only warning would let `related` answer
    # "looks new" about a finding that is already recorded.
    issues = validate(findings, problems, vocabulary)
    _warn_problems(issues, "list")
    if getattr(args, "strict", False) and issues:
        return 1
    rows = findings
    if args.open:
        rows = [f for f in rows if f.status == "open"]
    if args.area:
        rows = [f for f in rows if f.area == args.area]
    if args.root:
        rows = [f for f in rows if f.root == args.root]
    if _json_requested(args):
        raw_records = (
            _raw_entry_records(args.ledger, findings)
            if getattr(args, "raw", False)
            else None
        )
        return _print_json(
            _list_json_records(
                rows,
                load_tooling_areas_from_path(args.ledger),
                include_body=getattr(args, "body", False),
                raw_records=raw_records,
            )
        )
    if not rows:
        print("(none)")
        return 0
    for f in rows:
        print(f.summary())
    return 0


def _unfenced_body(entry: Finding) -> str:
    """The entry's prose with fenced blocks removed.

    A decision id inside a fenced example is an illustration, not a citation. Reading
    one as a citation promotes an unrelated decision into the binding block, which is
    the one place in this output that must not be guessed at.
    """
    return "\n".join(
        line
        for index, line in enumerate(entry.body)
        if not (index < len(entry.body_fenced) and entry.body_fenced[index])
    )


def _verified_body_lines(entry: Finding) -> list[str]:
    """Return body lines covered by a verifier approval.

    Answer evidence is an effect of the answer route, rather than source text
    the verifier judged. Wrapped answer bullets are skipped as one block.
    """
    lines = _unfenced_body(entry).splitlines()
    result: list[str] = []
    skip_continuation = False
    for line in lines:
        if ANSWER_EVIDENCE_MARKER_LINE_RE.match(line):
            skip_continuation = True
            continue
        if skip_continuation and line[:1].isspace():
            continue
        skip_continuation = False
        result.append(line)
    return result


def verified_body_sha256(entry: Finding) -> str:
    """Hash one entry's unfenced, non-answer body with its exact line joins."""
    return _sha256_bytes("\n".join(_verified_body_lines(entry)).encode("utf-8"))


def _last_approved_verifier_digest(body: str) -> str | None:
    """Return the digest from the latest verifier-authenticated approval."""
    latest: str | None = None
    lines = body.splitlines()
    for index, line in enumerate(lines):
        marker = ANSWER_EVIDENCE_MARKER_LINE_RE.match(line)
        if marker is None or re.match(
            rf"^[ \t]*{_BULLET}[ \t]+\*\*Approved:\*\*[ \t]*", line
        ) is None:
            continue
        continuation = index + 1
        while continuation < len(lines) and lines[continuation][:1].isspace():
            continuation += 1
        candidate = " ".join(
            [line[marker.end() :].strip()]
            + [value.strip() for value in lines[index + 1 : continuation]]
        )
        match = VERIFIER_EVIDENCE_RE.fullmatch(candidate)
        if match is not None:
            latest = match.group("body")
    return latest


def _unfenced_text(text: str) -> str:
    """Return raw text with fenced lines removed before marker checks."""
    lines = text.splitlines()
    return chr(10).join(
        line
        for line, fence_state in zip(lines, _fence_mask(lines), strict=True)
        if fence_state is FenceState.OUTSIDE
    )


def _print_related_decisions(
    members: list[Finding], decisions_path: Path, ledger_path: Path
) -> None:
    """Surface settled decisions BEFORE the session forms its own view.

    This is the anti-oscillation mechanism: findings are worked in fresh contexts, so
    without it a later run re-derives a question an earlier one settled and can land on
    the other option.

    Two blocks, and the difference between them is load-bearing. A decision that NAMES
    the cluster (or is named by it) binds. A decision that merely touches the same files
    is a lead to check, printed separately and labelled as such -- it is matched by
    filename, and a filename is evidence, not proof.
    """
    for issue in malformed_superseded_trailers(decisions_path):
        print(f"WARN {issue}", file=sys.stderr)
    ids = {f.id for f in members}
    # Both hand-written directions: the decision naming the finding, and the finding
    # naming the decision in its `Governed-by:` field or anywhere in its prose.
    resolved, citation_issues = _citation_resolution(ledger_path, decisions_path)
    for issue in citation_issues:
        print(f"WARN {issue}", file=sys.stderr)
    governed_by = {
        decision_id
        for finding in members
        for decision_id in resolved.get(finding.id, set())
    }

    # The files the cluster is about. This is the only arm that fires without one side
    # already knowing the other exists -- see the note above the second block below.
    member_full: set[str] = set()
    member_bare: set[str] = set()
    for f in members:
        full, bare = source_file_keys(f.paths())
        member_full |= full
        member_bare |= bare
    member_files = (member_full, member_bare)
    has_files = bool(member_full or member_bare)

    binding: list[Decision] = []
    touching: list[tuple[Decision, set[str]]] = []
    for d in load_decisions(decisions_path):
        if d.governs & ids or d.id in governed_by:
            binding.append(d)
            continue
        if not has_files:
            continue
        # Computed once: the display below needs the same set, and rescanning a
        # decision body to render it is the kind of duplicate the reviewer catches.
        shared = shared_source_files(source_file_keys(d.paths()), member_files)
        if shared:
            touching.append((d, shared))
    if not binding and not touching:
        return

    def render(d: Decision, trailer: str = "") -> None:
        superseded = (
            f" (SUPERSEDED by {d.superseded_by} — read the replacement decisions)"
            if d.superseded_by
            else ""
        )
        print(f"  {d.id} — {d.question}{superseded}{trailer}")

    if binding:
        print("\nDECISIONS GOVERNING THIS CLUSTER — input, not open questions.")
        print(
            "Reversing one needs new evidence it did not consider, never a different opinion."
        )
        for d in binding:
            render(d)
    if touching:
        # `Governs:` and `Governed-by:` are hand-written cross-references, so they can
        # only connect a decision to a finding whose author already knew the decision
        # existed -- which is never true of the case that costs the most: a question
        # filed as open because its answer was recorded before the finding was written.
        # d-20260818-30 settled commit-time ref publication on 2026-08-18 and could not
        # name f-20260822-02, filed four days later; the filer set `Entry: build` for a
        # design question that was already closed, and the run spent 4.5 h on it.
        # Matching the files both sides name is what closes that hole.
        print("\nDECISIONS TOUCHING THE SAME FILES — read before treating any of this")
        print("as an open question. Matched by filename, so check the fit yourself.")
        for d, shared in touching:
            names = sorted(shared)[:SHARED_FILES_SHOWN]
            more = len(shared) - len(names)
            tail = f" (+{more} more)" if more else ""
            render(d, f"\n      shares {', '.join(names)}{tail}")


def _waiting_rows(findings: list[Finding]) -> list[tuple[str, str, str]]:
    """Leftover blocked or drifted rows: (id, slug, title)."""
    return [
        (
            f.id,
            SENTRY_UNVERIFIED if f.sentry_verification == "drifted" else f.blocked,
            f.title,
        )
        for f in findings
        if f.status == "open"
        and (
            classify_blocker(f.blocked) != BLOCKER_NONE
            or f.sentry_verification == "drifted"
        )
    ]


def _cluster_entry_and_ids(members: list[Finding]) -> tuple[str, list[str]]:
    """CLUSTER entry= and IDS values, computed once for both renderings."""
    entry = max(members, key=lambda f: ENTRY_RANK[f.entry]).entry
    return entry, [f.id for f in members]


def _next_exclusion_keys(values: list[str]) -> set[tuple[str, str]]:
    """Parse repeatable cluster exclusions into canonical cluster keys."""
    keys: set[tuple[str, str]] = set()
    for value in values:
        kind, separator, name = value.partition(":")
        if not separator or kind not in {"root", "finding"} or not name:
            raise ValueError(
                "--exclude must be root:<slug> or finding:<id>, "
                f"not {value!r}"
            )
        if (kind == "root" and SLUG_RE.fullmatch(name) is None) or (
            kind == "finding" and ID_RE.fullmatch(name) is None
        ):
            raise ValueError(
                "--exclude must use a valid root slug or finding id, "
                f"not {value!r}"
            )
        keys.add((kind, name))
    return keys


def _next_json_payload(
    *,
    outcome: str,
    cluster_key: tuple[str, str] | None,
    entry: str | None,
    ids: list[str],
    waiting: list[tuple[str, str]],
) -> dict[str, object]:
    """D4 next object. ``cluster_key.value`` is the same string the text line prints."""
    return {
        "outcome": outcome,
        "cluster_key": (
            {"by": cluster_key[0], "value": cluster_key[1]}
            if cluster_key is not None
            else None
        ),
        "entry": entry,
        "ids": ids,
        "waiting": [{"id": fid, "on": slug} for fid, slug in waiting],
    }


def cmd_next(args: argparse.Namespace) -> int:
    findings, problems, vocabulary = parse(args.ledger)
    issues = validate(findings, problems, vocabulary)
    if issues:
        print("refusing to pick from an invalid ledger; run `check`", file=sys.stderr)
        return 1

    waiting_rows = _waiting_rows(findings)

    if args.pin:
        chosen = next((f for f in findings if f.id == args.pin), None)
        if chosen is None:
            print(f"no finding with id {args.pin}", file=sys.stderr)
            return 1
        if not chosen.pickable:
            print(
                f"{args.pin} is not pickable (status={chosen.status}, "
                f"blocked={chosen.blocked})",
                file=sys.stderr,
            )
            return 1
        members = cluster_members(findings, chosen.cluster_key)
        key = chosen.cluster_key
        reason = f"pinned: {args.pin}"
    else:
        try:
            excluded = _next_exclusion_keys(
                list(getattr(args, "exclude", None) or [])
            )
        except ValueError as exc:
            print(f"invalid next filter: {exc}", file=sys.stderr)
            return 1
        requested_entry = getattr(args, "entry", None)
        clusters = rank(findings)
        remaining: list[tuple[tuple[str, str], list[Finding]]] = []
        for candidate_key, candidate_members in clusters:
            effective_entry, _candidate_ids = _cluster_entry_and_ids(
                candidate_members
            )
            if candidate_key in excluded:
                continue
            if requested_entry is not None and effective_entry != requested_entry:
                continue
            remaining.append((candidate_key, candidate_members))
        if not remaining:
            if _json_requested(args):
                return _print_json(
                    _next_json_payload(
                        outcome=(
                            NEXT_OUTCOME_BLOCKED_ONLY
                            if waiting_rows
                            else NEXT_OUTCOME_EMPTY
                        ),
                        cluster_key=None,
                        entry=None,
                        ids=[],
                        waiting=[(fid, slug) for fid, slug, _title in waiting_rows],
                    )
                )
            print("QUEUE EMPTY")
            for fid, slug, title in waiting_rows:
                print(f"  blocked: {fid} on {slug} — {title}")
            return 0
        key, members = remaining[0]
        kind, name = key
        reason = (
            f"root '{name}' ({len(members)} member(s)); roots first, then oldest ID"
            if kind == "root"
            else f"oldest pickable singleton '{name}'; no pickable roots remain"
        )

    entry, ids = _cluster_entry_and_ids(members)
    if _json_requested(args):
        return _print_json(
            _next_json_payload(
                outcome=NEXT_OUTCOME_CLUSTER,
                cluster_key=key,
                entry=entry,
                ids=ids,
                waiting=[],
            )
        )
    print(f"CLUSTER {key[1]}  entry={entry}")
    print(f"WHY     {reason}")
    print(f"IDS     {' '.join(ids)}")
    print()
    for f in members:
        print(f.summary())
        print(f"    section: {f.section}")
    _print_related_decisions(members, args.decisions, args.ledger)
    return 0


def cmd_related(args: argparse.Namespace) -> int:
    findings, problems, vocabulary = parse(args.ledger)
    _warn_problems(validate(findings, problems, vocabulary), "related")
    _warn_pending_inbox(args.inbox)
    wanted = set(args.file or [])
    hits: list[tuple[str, Finding]] = []
    for f in findings:
        if args.area and f.area == args.area:
            hits.append(("same area", f))
            continue
        shared = f.paths() & wanted
        if shared:
            hits.append((f"shares {sorted(shared)[0]}", f))
    if not hits:
        print("(no related findings — this looks new)")
        return 0
    print(
        "Check these before filing; reuse a Root only for an evidenced shared cause, "
        "not merely a shared area or file. Name the related finding in the report."
    )
    print(
        "If its Root is `-`, the slug cannot carry the relation; name that finding "
        "in the new entry body instead."
    )
    print("Handled ones matter too: they carry the decision already made.\n")
    for why, f in hits:
        print(f"[{why}] {f.summary()}")
    return 0


# Guarantees the suffix below differs on every call within this process. The
# clock cannot: `time.time_ns()` is wall-clock, so it can repeat on a coarse
# source and step backwards under NTP. That is not merely untidy -- the spool
# publisher retries on a name collision, so a clock that repeats would spin.
_SUFFIX_SEQUENCE = itertools.count()


def _publish_stamp() -> str:
    """The `YYYYMMDD-HHMMSS` half of a published spool name.

    Split out from `cmd_file` so a test can freeze it. The published name is
    `<stamp>-<suffix>`, and pinning only the suffix leaves the STAMP free: two
    filings a second apart then get different names and no collision, so a test
    written to prove that a taken name is refused quietly proves nothing instead.
    That is not hypothetical -- it passed for months and first went red inside a
    271-second full-gate run, where the two filings straddled a second boundary.
    """
    return f"{datetime.now().astimezone():%Y%m%d-%H%M%S}"


def _unique_suffix() -> str:
    """A per-process, per-call token for a filename that must not collide.

    PID separates processes, the counter separates calls within one, and the
    timestamp is there to keep the name readable and roughly ordered rather than
    to carry uniqueness. Every filename that must not collide is built from this,
    so the rule lives here once rather than in four places.
    """
    return f"{os.getpid()}-{time.time_ns()}-{next(_SUFFIX_SEQUENCE)}"


def _fsync_directory(directory: Path) -> None:
    """Make directory entries in ``directory`` durable."""
    directory_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
    synced = False
    try:
        os.fsync(directory_fd)
        synced = True
    finally:
        try:
            os.close(directory_fd)
        except OSError as exc:
            # Never re-raise here. A ``raise`` inside ``finally`` replaces the
            # fsync exception already in flight, so report the cleanup failure
            # and let the durability error propagate.
            detail = (
                "after directory fsync" if synced else "after a failed directory fsync"
            )
            print(
                f"WARN could not clean up directory file descriptor {directory_fd} "
                f"{detail}: {exc}",
                file=sys.stderr,
            )


def _atomic_write(path: Path, text: str, *, durable_directory: bool = False) -> None:
    """Replace ``path`` atomically and apply the requested durability policy.

    The temp-file fsync is always fatal: no write is committed until it succeeds.
    The containing-directory fsync is fatal only for replayable writes whose
    surviving receipt or intent would otherwise make a false promise. Ordinary
    ledger mutations warn after ``os.replace`` because their retry is a blind
    append and the mutation is already visible.
    """
    tmp = path.with_name(f"{path.name}.tmp-{_unique_suffix()}")
    committed = False
    try:
        with tmp.open("w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
        _note_ledger_replacement(path, text)
        committed = True
        try:
            _fsync_directory(path.parent)
        except OSError as exc:
            if durable_directory:
                raise
            print(
                f"WARN could not durably sync directory {path.parent} after "
                f"replacing {path}: {exc}",
                file=sys.stderr,
            )
    finally:
        try:
            tmp.unlink(missing_ok=True)
        except OSError as exc:
            # Never re-raise here. A ``raise`` inside ``finally`` replaces the
            # exception already in flight, so a failed write followed by a failed
            # cleanup would reach ``main`` as "could not remove /tmp/...tmp-x" and
            # the reason the ledger could not be written would be gone. For a tool
            # whose whole purpose is not losing findings, that is the wrong half to
            # keep. Report the orphaned temporary file instead, so both diagnostics
            # survive, and let the primary error propagate.
            detail = (
                "after atomic write" if committed else "after a failed atomic write"
            )
            print(
                f"WARN could not clean up temporary file {tmp} {detail}: {exc}",
                file=sys.stderr,
            )


@contextmanager
def _candidate_scratch(candidate: str, near: Path) -> Iterator[Path]:
    """Expose candidate text through a unique scratch path for one parse."""
    scratch = near.with_name(f"{near.name}.candidate-{_unique_suffix()}")
    candidate_succeeded = False
    try:
        scratch.write_text(candidate, encoding="utf-8")
        yield scratch
        candidate_succeeded = True
    finally:
        try:
            scratch.unlink(missing_ok=True)
        except OSError as exc:
            # Never re-raise here. A ``raise`` inside ``finally`` replaces the
            # candidate error already in flight, so report the cleanup failure
            # and let the parse or validation error propagate.
            detail = (
                "after candidate processing"
                if candidate_succeeded
                else "after a failed candidate processing"
            )
            print(
                f"WARN could not clean up candidate scratch file {scratch} "
                f"{detail}: {exc}",
                file=sys.stderr,
            )


def publish_lock_path(spool: Path) -> Path:
    """Return the persistent publish fence beside ``spool``."""
    return spool.with_name(f"{spool.name}.publish.lock")


def receipt_directory(inbox: Path) -> Path:
    """Return the durable filing-receipt directory beside ``inbox``."""
    return inbox.with_name(f"{inbox.name}.receipts")


def _receipt_path(inbox: Path, entry: str, *, filing_token: str | None = None) -> Path:
    digest = hashlib.sha256(entry.encode("utf-8")).hexdigest()
    suffix = f"-{filing_token}" if filing_token is not None else ""
    return receipt_directory(inbox) / f"{digest}{suffix}.json"


def _write_receipt(path: Path, record: dict[str, str]) -> None:
    """Atomically persist a receipt and its directory entry to stable storage."""
    try:
        receipt_directory_existed = path.parent.exists()
        path.parent.mkdir(parents=True, exist_ok=True)
        if not receipt_directory_existed:
            _fsync_directory(path.parent.parent)
        serialized = json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n"
        _atomic_write(path, serialized, durable_directory=True)
    except LedgerError:
        raise
    except OSError as exc:
        raise LedgerError(f"could not write filing receipt {path}: {exc}") from exc


def _published_receipt_record(
    published: str, receipt: dict[str, str] | None = None
) -> dict[str, str]:
    """Build a published receipt while preserving its part identity."""
    record = {"state": "published", "published": published}
    if receipt is not None and "part" in receipt:
        record["part"] = receipt["part"]
    return record


def _read_receipt(path: Path) -> dict[str, str] | None:
    """Read one receipt, refusing every shape whose recovery is ambiguous."""
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    except (OSError, UnicodeError) as exc:
        raise LedgerError(f"could not read filing receipt {path}: {exc}") from exc
    try:
        record = json.loads(raw)
    except ValueError as exc:
        raise LedgerError(f"could not read filing receipt {path}: {exc}") from exc
    if not isinstance(record, dict):
        raise LedgerError(f"malformed filing receipt {path}: expected a JSON object")
    state = record.get("state")
    published = record.get("published")
    if state not in {"publishing", "published", "merged"}:
        raise LedgerError(f"malformed filing receipt {path}: invalid state {state!r}")
    if (
        not isinstance(published, str)
        or not published
        or Path(published).name != published
    ):
        raise LedgerError(
            f"malformed filing receipt {path}: invalid published filename"
        )
    identifier = record.get("id")
    part = record.get("part")
    if part is not None and (
        not isinstance(part, str) or not part or Path(part).name != part
    ):
        raise LedgerError(f"malformed filing receipt {path}: invalid part filename")
    if state == "merged":
        if not isinstance(identifier, str) or ID_RE.fullmatch(identifier) is None:
            raise LedgerError(f"malformed filing receipt {path}: invalid merged id")
    elif identifier is not None and (
        not isinstance(identifier, str) or ID_RE.fullmatch(identifier) is None
    ):
        raise LedgerError(f"malformed filing receipt {path}: invalid recorded id")
    return {
        key: value
        for key, value in record.items()
        if key in {"state", "published", "id", "part"} and isinstance(value, str)
    }


@dataclass
class ReceiptIndex:
    """Relevant receipts indexed once for one publish-locked merge."""

    by_name: dict[str, tuple[Path, dict[str, str]]] = field(default_factory=dict)
    by_filing: dict[tuple[str, str], list[tuple[Path, dict[str, str]]]] = field(
        default_factory=dict
    )
    by_part: dict[str, tuple[Path, dict[str, str]]] = field(default_factory=dict)


def _receipt_index(inbox: Path, digests: set[str]) -> ReceiptIndex:
    """Index only receipts relevant to this batch with one directory scan."""
    index = ReceiptIndex()
    directory = receipt_directory(inbox)
    try:
        entries = os.scandir(directory)
    except FileNotFoundError:
        return index
    except OSError as exc:
        raise LedgerError(
            f"could not enumerate filing receipts {directory}: {exc}"
        ) from exc
    with entries:
        for entry in entries:
            digest = entry.name[:RECEIPT_DIGEST_HEX_LENGTH]
            if digest not in digests or not entry.name.endswith(".json"):
                continue
            path = Path(entry.path)
            record = _read_receipt(path)
            if record is None:
                continue
            index.by_name[path.name] = (path, record)
            index.by_filing.setdefault((digest, record["published"]), []).append(
                (path, record)
            )
            part = record.get("part")
            if part is not None:
                existing = index.by_part.get(part)
                if existing is not None and existing[0] != path:
                    raise LedgerError(
                        f"filing receipts {existing[0]} and {path} both name part {part}"
                    )
                index.by_part[part] = (path, record)
    return index


def _record_publishing(
    receipt_path: Path, receipt: dict[str, str] | None, candidate: Path
) -> None:
    """Persist one publishing-name transition while preserving its part."""
    if receipt is None or receipt["state"] != "publishing":
        return
    receipt["published"] = candidate.name
    record = {"state": "publishing", "published": candidate.name}
    if "part" in receipt:
        record["part"] = receipt["part"]
    _write_receipt(receipt_path, record)


def _link_with_retries(
    part: Path,
    candidate_for: Callable[[int], Path],
    before_link: Callable[[Path], None] | None = None,
) -> Path:
    """Link ``part`` under a collision-safe candidate name."""
    for attempt in range(PUBLISH_NAME_ATTEMPTS):
        candidate = candidate_for(attempt)
        if before_link is not None:
            before_link(candidate)
        try:
            os.link(part, candidate)
        except FileExistsError:
            continue
        return candidate
    raise LedgerError(
        f"could not find a free name in {part.parent} after "
        f"{PUBLISH_NAME_ATTEMPTS} attempts; the entry was NOT filed"
    )


@contextmanager
def _publish_lock(
    lock: Path, wait_window_seconds: float | None = None
) -> Iterator[None]:
    """Hold a bounded exclusive fence for one spool's publish window."""
    if wait_window_seconds is None:
        wait_window_seconds = PUBLISH_LOCK_TIMEOUT_SECONDS
    try:
        fd = os.open(lock, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o644)
    except OSError as exc:
        raise LedgerError(f"could not open publish lock {lock}: {exc}") from exc
    try:
        started = time.monotonic()
        deadline = started + wait_window_seconds
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except OSError as exc:
                if exc.errno not in (errno.EWOULDBLOCK, errno.EAGAIN, errno.EACCES):
                    raise LedgerError(
                        f"could not acquire publish lock {lock}: {exc}"
                    ) from exc
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise PublishLockBusyError(
                        f"publish lock busy: {lock} remained busy for "
                        f"{time.monotonic() - started:.2f}s"
                    ) from exc
                time.sleep(min(LEDGER_LOCK_RETRY_INTERVAL_SECONDS, remaining))
        yield
    finally:
        with suppress(OSError):
            fcntl.flock(fd, fcntl.LOCK_UN)
        with suppress(OSError):
            os.close(fd)


def _enumerate_orphan_parts(spool: Path) -> tuple[list[Path], bool]:
    """Return old dot-prefixed ``.part`` files, and whether the scan was complete.

    The flag exists because a part whose ``stat`` raises is DROPPED from the
    list, and a caller cannot tell that apart from a spool that legitimately
    had nothing old in it. Warning and returning the survivors alone would make
    `merge-inbox` exit 0 while a published finding sat stranded -- the same
    "unreadable read as empty" failure the `iterdir` branch below already
    refuses, one level further in. `_adopt_orphan_parts` treats every other
    per-part `OSError` exactly this way (warn, skip that part, fail the sweep),
    so this keeps the batch working on the parts it can still adopt instead of
    refusing all of them for one bad entry.
    """
    try:
        entries = sorted(spool.iterdir())
    except FileNotFoundError:
        return [], True
    except OSError as exc:
        errno_name = _errno_name(exc)
        raise LedgerError(
            f"could not enumerate findings spool {spool} ({errno_name}): {exc}"
        ) from exc
    cutoff = time.time() - ORPHAN_PART_GRACE_SECONDS
    orphans: list[Path] = []
    complete = True
    for path in entries:
        if not path.name.startswith(".") or not path.name.endswith(".part"):
            continue
        try:
            if path.stat().st_mtime <= cutoff:
                orphans.append(path)
        except OSError as exc:
            print(
                f"WARN could not stat orphan part {path}: {exc}",
                file=sys.stderr,
            )
            complete = False
            continue
    return orphans, complete


def _adopt_orphan_parts(spool: Path, receipt_index: ReceiptIndex | None = None) -> bool:
    """Publish old completed parts without deleting an entry on failure."""
    success = True
    try:
        orphan_parts, enumerated_completely = _enumerate_orphan_parts(spool)
    except LedgerError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return False
    success = enumerated_completely
    if receipt_index is None:
        digests: set[str] = set()
        for part in orphan_parts:
            try:
                entry = part.read_text(encoding="utf-8")
            except _READ_ERRORS:
                continue
            digests.add(hashlib.sha256(entry.encode("utf-8")).hexdigest())
        try:
            receipt_index = _receipt_index(spool, digests)
        except LedgerError as exc:
            print(f"FAIL {exc}", file=sys.stderr)
            return False
    for part in orphan_parts:
        try:
            if part.stat().st_nlink > 1:
                part.unlink()
                print(
                    f"NOTE cleaned published twin {part}",
                    file=sys.stderr,
                )
                continue
        except FileNotFoundError:
            continue
        except OSError as exc:
            print(f"WARN could not inspect orphan {part}: {exc}", file=sys.stderr)
            success = False
            continue

        try:
            entry = part.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            print(f"FAIL could not read orphan {part}: {exc}", file=sys.stderr)
            success = False
            continue
        digest = hashlib.sha256(entry.encode("utf-8")).hexdigest()
        stem = part.name[1 : -len(".part")]
        indexed_receipt = receipt_index.by_part.get(part.name)
        if indexed_receipt is None:
            bare_name = f"{digest}.json"
            bare_receipt = receipt_index.by_name.get(bare_name)
            if bare_receipt is None or bare_receipt[1]["published"] == f"{stem}.md":
                indexed_receipt = bare_receipt
        if indexed_receipt is None:
            receipt_path = _receipt_path(spool, entry)
            receipt = None
        else:
            receipt_path, receipt = indexed_receipt
        if receipt is not None and receipt["state"] in {"published", "merged"}:
            accounted_as = receipt.get("id", receipt["published"])
            try:
                part.unlink()
            except OSError as exc:
                print(
                    f"FAIL receipt {receipt_path} accounts for orphan {part} as "
                    f"{accounted_as}, but the part could not be removed: {exc}",
                    file=sys.stderr,
                )
                success = False
                continue
            print(
                f"NOTE removed accounted orphan {part}; receipt {receipt_path} "
                f"records {accounted_as}",
                file=sys.stderr,
            )
            continue

        def candidate_for(attempt: int, *, part_stem: str = stem) -> Path:
            suffix = "" if attempt == 0 else f"-{_unique_suffix()}"
            return spool / f"{part_stem}{suffix}.md"

        def record_publishing(
            candidate: Path,
            *,
            publishing_receipt: dict[str, str] | None = receipt,
            publishing_receipt_path: Path = receipt_path,
        ) -> None:
            _record_publishing(publishing_receipt_path, publishing_receipt, candidate)

        try:
            adopted = _link_with_retries(part, candidate_for, record_publishing)
            _fsync_directory(spool)
            if receipt is not None and receipt["state"] == "publishing":
                receipt["state"] = "published"
                receipt["published"] = adopted.name
                _write_receipt(
                    receipt_path, _published_receipt_record(adopted.name, receipt)
                )
            if receipt is not None:
                receipt_index.by_filing.setdefault((digest, adopted.name), []).append(
                    (receipt_path, receipt)
                )
        except (LedgerError, OSError) as exc:
            print(f"FAIL could not adopt orphan {part}: {exc}", file=sys.stderr)
            success = False
            continue
        try:
            part.unlink()
        except OSError as exc:
            print(
                f"FAIL adopted orphan {part} as {adopted}, but could not remove the "
                f"part name: {exc}",
                file=sys.stderr,
            )
            success = False
        print(f"NOTE adopted orphan {part} as {adopted}", file=sys.stderr)
    return success


def _remove_consumed_published_twin(spool: Path, published: Path) -> None:
    """Remove a part hard-linked to a published file as that file is claimed."""
    twin = spool / f".{published.stem}.part"
    try:
        if twin.stat().st_nlink > 1:
            twin.unlink()
    except FileNotFoundError:
        return
    except OSError as exc:
        raise LedgerError(
            f"could not remove consumed published twin {twin}: {exc}"
        ) from exc


def _sweep_scratch(
    directory: Path, owns_target: Callable[[str], bool]
) -> None:
    """Remove expired generated scratch for targets owned by the caller."""
    try:
        entries = list(directory.iterdir())
    except OSError:
        return
    cutoff = time.time() - SCRATCH_GRACE_SECONDS
    for path in entries:
        match = _GENERATED_SCRATCH_RE.fullmatch(path.name)
        if match is None or not owns_target(match.group("target")):
            continue
        try:
            if path.stat().st_mtime > cutoff:
                continue
            path.unlink()
        except OSError:
            continue


def _validate_text(candidate: str, near: Path) -> list[str]:
    """Validate ledger text without a scratch path two runs could collide on."""
    metadata, metadata_issues = _scan_ledger_metadata(candidate, near)
    metadata_issues += _receipt_effect_issues(candidate, near, metadata)
    try:
        with _candidate_scratch(candidate, near) as scratch:
            if "**Area vocabulary:**" not in candidate.split("### ", 1)[0]:
                return metadata_issues + (
                    malformed_decision_headings(scratch)
                    + malformed_superseded_trailers(scratch)
                    + duplicate_decision_ids(scratch)
                )
            findings, problems, vocabulary = parse(scratch)
            return metadata_issues + validate(findings, problems, vocabulary)
    except LedgerError as exc:
        return [*metadata_issues, str(exc)]


def _parse_text(
    candidate: str, near: Path
) -> tuple[list[Finding], list[str], frozenset[str]]:
    """Parse text through the normal parser using a temporary path."""
    with _candidate_scratch(candidate, near) as scratch:
        return parse(scratch)


def _entry_candidate_text(entry: str, ledger_text: str) -> str:
    """Put one standalone entry under the ledger's real vocabulary header."""
    lines = ledger_text.splitlines()
    fence_states = _fence_mask(lines)
    prefix: list[str] = []
    for line, fence_state in zip(lines, fence_states, strict=True):
        if fence_state is FenceState.OUTSIDE and line.startswith(ENTRY_MARKER):
            break
        prefix.append(line)
    return "\n".join(prefix) + "\n\n## filed entry\n\n" + entry


def _normalise_sentry_origin_entry(entry: str, ledger: Path) -> str:
    """Canonicalise the verification blocker on a Sentry-origin entry.

    Filing and merging both use this content-driven, idempotent normalisation
    before validation. The validator remains the authority: this only makes the
    conventional ``Blocked: none`` form conform before the first validation pass.
    """
    try:
        ledger_text = ledger.read_text(encoding="utf-8")
        candidate = _entry_candidate_text(entry, ledger_text)
        findings, problems, _vocabulary = _parse_text(candidate, ledger)
    except _READ_ERRORS_LEDGER:
        return entry
    if len(findings) != 1 or problems:
        return entry

    finding = findings[0]
    body = _unfenced_body(finding)
    if not _body_is_sentry_origin(body):
        return entry
    if finding.blocked == SENTRY_UNVERIFIED:
        return entry
    if finding.blocked == FELIX_SENTRY_ORIGIN or (
        finding.status == "open" and APPROVED_RE.search(body) is None
    ):
        replacement = SENTRY_UNVERIFIED
    else:
        return entry

    lines = entry.splitlines()
    fence_states = _fence_mask(lines)
    for index, (line, fence_state) in enumerate(zip(lines, fence_states, strict=True)):
        if fence_state is not FenceState.OUTSIDE:
            continue
        if HEADER_RE.match(line) is None:
            continue
        lines[index] = re.sub(
            r"(\*\*Blocked:\*\* )\S+",
            rf"\g<1>{replacement}",
            line,
            count=1,
        )
        break
    return "\n".join(lines) + ("\n" if entry.endswith("\n") else "")


def _read_and_validate_entry(
    entry_path: Path, ledger: Path
) -> tuple[str | None, list[str]]:
    """Read, normalise and validate exactly one pending entry before creating the spool.

    Normalisation happens here rather than in the caller because validation is the very
    next step: `cmd_file` validates before it publishes, so an entry carrying the
    conventional `Blocked: none` with a Sentry-origin marker would be rejected outright
    and the manual intake path would stop filing.
    """
    try:
        entry = _normalise_sentry_origin_entry(
            entry_path.read_text(encoding="utf-8"), ledger
        )
        ledger_text = ledger.read_text(encoding="utf-8")
        candidate = _entry_candidate_text(entry, ledger_text)
        findings, problems, vocabulary = _parse_text(candidate, ledger)
    except (OSError, UnicodeError, LedgerError) as exc:
        return None, [f"could not read or parse {entry_path}: {exc}"]

    issues = validate(findings, problems, vocabulary, allow_pending=True)
    if not findings:
        issues.append(f"{entry_path} has no readable `###` finding entry")
    elif len(findings) != 1:
        issues.append(
            f"{entry_path} must contain exactly one `###` finding entry; "
            f"found {len(findings)}"
        )
    elif findings[0].id != PENDING_ID:
        issues.append(
            f"{entry_path} must carry **ID:** {PENDING_ID}; the merge allocates "
            "the real finding id"
        )
    if len(findings) == 1:
        if (
            _body_is_sentry_origin(_unfenced_body(findings[0]))
            and findings[0].status != "open"
        ):
            issues.append(
                f"{entry_path} is Sentry-origin but carries status "
                f"{findings[0].status!r}; new Sentry-origin entries must be filed open"
            )
        body = _unfenced_body(findings[0])
        if findings[0].entry == "build" and not OPEN_QUESTION_RE.search(body):
            issues.append(OPEN_QUESTION_REFUSAL.format(where=entry_path))
        marker = _answer_evidence_marker(
            body, sentry_origin=_body_is_sentry_origin(body)
        )
        if marker == "**Why rejected:**":
            issues.append(
                f"{entry_path} carries **Why rejected:** on a Sentry-origin entry; "
                "only the answer route may write that evidence"
            )
        elif marker is not None:
            issues.append(
                f"{entry_path} carries answer evidence; only the answer route may "
                "write **Approved:** or **Decision made:**"
            )
    return entry, issues


def drain_lock_path() -> Path:
    """Return the configured drain lock path.

    The default hashes the cwd's git toplevel at call time so the same bytes
    running from a kit path with cwd inside another checkout key that checkout,
    not ``__file__``.
    """
    configured = os.environ.get(DRAIN_LOCK_ENV)
    if configured:
        return Path(configured)
    root, _err = _probe_git_toplevel()
    if root is not None:
        return _lock_for_root(root)
    if REPO_ROOT is not None:
        return _lock_for_root(REPO_ROOT)
    return DEFAULT_DRAIN_LOCK


def cmd_drain_status(args: argparse.Namespace) -> int:
    """Answer "is a drain running here" with a probe-and-release query.

    `file` and `/decide` agree that the consumer lock's kernel flock is the
    answer. Only `file` makes that answer durable by retaining its shared lock
    through a merge; this pure status query releases its probe immediately. The
    recorded PID is only a human diagnostic, and an unreadable diagnostic fails
    open with an explicit warning.
    """
    lock = drain_lock_path()
    held, reason, unreadable = _drain_lock_state(lock)
    if held:
        print(f"drain running (lock {lock})")
        return 0
    if unreadable:
        assert reason is not None
        print(f"no drain running — {reason}")
        return 1
    if reason is not None:
        print(f"no drain running — STALE lock {lock}: {reason}")
        return 1
    print("no drain running")
    return 1


@dataclass
class MergeResult:
    returncode: int
    assigned_by_file: dict[Path, list[str]] = field(default_factory=dict)


def _spool_file_date(path: Path, legacy: Path | None) -> str:
    """Return the `YYYYMMDD` a spool file was filed on, from its own name.

    The `ID` field records the date a finding was *filed*, not the date a drain
    got round to merging it, and the contract already makes every spool file
    LEAD with its filing timestamp, `<YYYYMMDD-HHMMSS>-` followed by whatever
    `_unique_suffix` appends. So the name is the record. Only the leading date is
    read here; the rest exists to keep two publishers from colliding.

    **A name that does not carry one is refused, not quietly dated today.** The
    id is stable forever, so a wrong date is a permanent wrong record — and the
    silent version of that is the worst shape it can take, because the merge
    exits 0 and nothing ever contradicts it. The single exception is the legacy
    single-file inbox, which predates the naming contract and genuinely has no
    timestamp to read.
    """
    if legacy is not None and path.name == legacy.name:
        return f"{datetime.now().astimezone():%Y%m%d}"
    prefix = path.name.split("-", 1)[0]
    if len(prefix) == ID_DATE_LEN and prefix.isdigit():
        return prefix
    raise LedgerError(
        f"spool file {path.name} does not start with a YYYYMMDD- filing date, so "
        "the finding's id would silently record the wrong day. Rename it to "
        "<YYYYMMDD-HHMMSS>-<pid>.md"
    )


def header_ids(text: str) -> set[str]:
    """Every finding id `text` declares in a real, unfenced header line.

    **Deliberately not a bare `f-\\d{8}-\\d{2}` scan of the raw text.** Ids also
    appear in prose that cross-references them, in longer tokens that merely
    start like one, and in fenced examples that exist precisely to show the
    header format — none of which allocates anything. Counting those as taken
    lets a quoted `f-20260317-99` push the sequence past its ceiling and refuse
    a batch that is entirely valid. `parse` already decides what an id is by
    reading headers outside fences; this reads them the same way, so allocation
    and validation cannot drift apart.
    """
    _lines, headers, _orphans = _unfenced_header_matches(text)
    found: set[str] = set()
    for _heading_idx, _idx, match in headers:
        if ID_RE.match(match.group("id")):
            found.add(match.group("id"))
    return found


def _unfenced_header_matches(
    text: str, fence_states: list[FenceState] | None = None
) -> tuple[
    list[str],
    list[tuple[int, int, re.Match[str]]],
    list[tuple[int, re.Match[str]]],
]:
    """Return real headers, orphaned headers, and their source line indexes.

    A real header is found with the parser's forward lookahead: for an unfenced
    ``### `` heading, skip blank lines and inspect only the next line. A header
    that is not consumed by that lookahead is an orphan. Keeping this rule in one
    helper prevents allocation and merge accounting from accepting a header that
    the parser cannot turn into a finding.
    """
    lines = text.splitlines()
    if fence_states is None:
        fence_states = _fence_mask(lines)
    headers: list[tuple[int, int, re.Match[str]]] = []
    real_indexes: set[int] = set()
    heading_by_header: dict[int, int] = {}
    for idx, line in enumerate(lines):
        if fence_states[idx] is not FenceState.OUTSIDE or not line.startswith("### "):
            continue
        probe = idx + 1
        while probe < len(lines) and not lines[probe].strip():
            probe += 1
        if probe < len(lines) and (match := HEADER_RE.match(lines[probe])) is not None:
            real_indexes.add(probe)
            heading_by_header[probe] = idx

    orphans: list[tuple[int, re.Match[str]]] = []
    for idx, line in enumerate(lines):
        if fence_states[idx] is FenceState.CONTENT:
            continue
        match = HEADER_RE.match(line)
        if match is not None:
            if idx in real_indexes:
                headers.append((heading_by_header[idx], idx, match))
            else:
                orphans.append((idx, match))
    return lines, headers, orphans


def assign_pending_ids(text: str, date: str, taken: set[str]) -> tuple[str, list[str]]:
    """Replace every `f-PENDING` header id in `text` with a free sequential id.

    **The merger allocates, because it is the only writer that can.** A filing
    session cannot read the ledger and pick `max + 1` without racing every other
    filing session doing the same: both read `05`, both write `06`, and the merge
    then refuses a batch containing a third party's perfectly good finding. The
    merger holds the ledger lock and sees the whole batch at once, so allocation
    here is the only point where an id can be handed out exactly once. That is
    also why `f-PENDING` is the required form in the spool rather than merely a
    tolerated one.

    `taken` is mutated so ids stay unique across the files of one batch as well
    as against the ledger. Fenced lines are skipped: an entry quoting a header as
    an example must not have that example silently allocated a real id.

    Returns the rewritten text and the ids handed out, in order. The caller
    reports them: a filing session that published to a drain cannot learn its id,
    so the merge output is the place that mapping is recorded — and deriving it by
    re-scanning the merged text afterwards would re-list pre-assigned ids and
    fenced examples as though this run had allocated them.
    """
    return _allocate_pending(
        text,
        "f",
        date,
        taken,
        PENDING_ID,
        lambda value: _unfenced_header_matches(value)[:2],
    )


def _allocate_pending(
    text: str,
    prefix: str,
    date: str,
    taken: set[str],
    pending_token: str,
    locate: Callable[[str], tuple[list[str], list[tuple[int, int, re.Match[str]]]]],
) -> tuple[str, list[str]]:
    """Allocate high-water ids for either ledger's pending headings."""
    lines, matches = locate(text)
    assigned: list[str] = []
    for _heading_idx, idx, match in matches:
        if match.group("id") != pending_token:
            continue
        used = sorted(
            int(identifier.rsplit("-", 1)[1])
            for identifier in taken
            if identifier.startswith(f"{prefix}-{date}-")
        )
        seq = (used[-1] + 1) if used else 1
        if seq > ID_SEQ_MAX:
            kind = "finding" if prefix == "f" else "decision"
            raise LedgerError(
                f"no free {kind} id left for {date} — the sequence reached {ID_SEQ_MAX}"
            )
        candidate = f"{prefix}-{date}-{seq:0{ID_SEQ_DIGITS}d}"
        taken.add(candidate)
        assigned.append(candidate)
        lines[idx] = lines[idx].replace(pending_token, candidate, 1)
    return "\n".join(lines), assigned


def ledger_lock_path(ledger: Path) -> Path:
    """Return the lock file path associated with a ledger."""
    return ledger.with_name(f"{ledger.name}.lock")


# Open file descriptors for ledger locks this process currently holds, keyed by
# `str(lock)` as passed to `acquire_ledger_lock`. The fd IS the lock -- `flock`
# is released when it is closed or the process dies -- so it has to outlive
# `acquire_ledger_lock`. Callers that need the fd (the drain's ledger-only
# rebase) go through `held_ledger_lock_fd`, not this dict.
_HELD_LEDGER_LOCKS: dict[str, int] = {}


def acquire_ledger_lock(
    lock: Path, wait_window_seconds: float | None = None
) -> tuple[bool, float]:
    """Take the ledger-wide writer lock, retrying for the requested window.

    Uses ``flock``, so **the kernel owns liveness**. A lock is released when its
    holder closes the descriptor or dies, by any means including SIGKILL -- there
    is no such thing as a stale lock here, and therefore no PID to record, no
    grace period to tune, no staleness to detect and no reclaim path to race.

    That is the entire reason for the primitive. Two hand-rolled protocols were
    tried first and both were wrong in the same way: acquisition was two steps
    (create, then record the owner), so the lock existed for a window with no
    readable owner, and every reader inside it had to guess from age -- which
    steals the lock of a writer that is merely paused. Rewriting the reclaim to
    be atomic only moved the race: checking that an owner is dead and removing
    its lock are still two steps, so a waiter can delete a lock a third process
    has already legitimately taken. `flock` deletes the question instead of
    answering it, and it is a primitive
    this repository already uses elsewhere for the same reason.

    Nothing writes the lock file either. Recording a PID required truncating a
    file identified only by its path, which was the mechanism that destroyed a
    ledger. A human who wants the holder can ask the kernel with ``fuser`` or
    ``lsof`` on the lock file; that answer is authoritative where a self-reported
    PID was not.
    """
    if wait_window_seconds is None:
        wait_window_seconds = LEDGER_LOCK_WAIT_SECONDS
    started = time.monotonic()
    deadline = started + wait_window_seconds
    while True:
        try:
            fd = os.open(lock, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o644)
        except OSError as exc:
            if exc.errno == errno.ELOOP:
                # A symlink is not a lock this code creates. Following it would
                # take the flock on an unrelated inode, so treat this hostile
                # path as busy without cleanup or retrying; it cannot clear
                # itself during the retry window.
                return False, time.monotonic() - started
            if not isinstance(exc, IsADirectoryError):
                raise LedgerError(f"could not open ledger lock {lock}: {exc}") from exc
            # A lock left behind by the pre-flock protocol, which used a
            # directory. It can only be a corpse: nothing creates one any more.
            #
            # Reproduced 2026-08-21: `acquire_ledger_lock` on a
            # `findings.md.lock/` containing `pid` returned False after 1.00s.
            # Remove only the legacy protocol's regular, non-symlink `pid` file.
            # A symlink at the lock path is left untouched: iterating it could
            # delete files in the directory it targets. Any other child keeps
            # `rmdir` failing rather than sweeping an unrelated path.
            if not lock.is_symlink():
                pid = lock / "pid"
                with suppress(OSError):
                    if pid.is_file() and not pid.is_symlink():
                        pid.unlink()
                with suppress(OSError):
                    os.rmdir(lock)
            if time.monotonic() >= deadline:
                return False, time.monotonic() - started
            continue
        try:
            link_count = os.fstat(fd).st_nlink
        except OSError as exc:
            with suppress(OSError):
                os.close(fd)
            raise LedgerError(f"could not inspect ledger lock {lock}: {exc}") from exc
        if link_count != 1:
            # Check the inode actually opened: multiple links mean another path
            # aliases this file, so taking the flock would make an unrelated
            # process block on that inode. A hostile path gets no cleanup or
            # retry; it cannot clear itself.
            os.close(fd)
            return False, time.monotonic() - started
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            with suppress(OSError):
                os.close(fd)
            if exc.errno not in {
                errno.EWOULDBLOCK,
                errno.EAGAIN,
                errno.EACCES,
            }:
                # `OSError.errno` is Optional. A None errno is not one of the
                # contention codes above, so it already routes here — it just
                # cannot be looked up by name, which `_errno_name` handles.
                errno_name = _errno_name(exc)
                raise LedgerError(
                    f"could not acquire ledger lock {lock}: {errno_name} ({exc})"
                ) from exc
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return False, time.monotonic() - started
            time.sleep(min(LEDGER_LOCK_RETRY_INTERVAL_SECONDS, remaining))
            continue
        _HELD_LEDGER_LOCKS[str(lock)] = fd
        return True, time.monotonic() - started


def held_ledger_lock_fd(lock: Path) -> int | None:
    """Return this process's open flock descriptor for ``lock``, or ``None``.

    The descriptor *is* the lock. Handing it to a child via ``pass_fds`` keeps
    the fence after this process dies, including SIGKILL. ``None`` means this
    process does not currently hold ``lock``; the lookup key is ``str(lock)`` as
    passed to ``acquire_ledger_lock``.
    """
    return _HELD_LEDGER_LOCKS.get(str(lock))


def release_ledger_lock(lock: Path) -> None:
    """Release the ledger-wide writer lock if this process holds it.

    **The lock file is deliberately left on disk.** Removing it is the classic
    way to break a `flock`: unlink and a waiting process that already opened the
    old inode ends up holding a lock nobody else can see, while the next arrival
    creates a fresh file and locks that -- two owners, on two inodes, of one
    logical lock. Keeping the file makes the inode stable and the exclusion
    total. It costs one empty file beside the ledger, which `.gitignore` covers
    so it cannot dirty the tree a drain checks.
    """
    fd = _HELD_LEDGER_LOCKS.pop(str(lock), None)
    if fd is None:
        return
    with suppress(OSError):
        fcntl.flock(fd, fcntl.LOCK_UN)
    with suppress(OSError):
        os.close(fd)


def _write_if_unchanged(
    path: Path,
    expected: str,
    candidate: str,
    *,
    durable_directory: bool = False,
) -> None:
    """Write ``candidate`` only if ``path`` still contains ``expected``.

    An unchanged candidate still performs the compare, so a concurrent direct
    edit refuses before the caller's ``post_commit`` callback runs, but it never
    replaces the file: a replacement would register a commit attempt for a
    write that changed nothing.
    """
    current = path.read_text(encoding="utf-8")
    if current != expected:
        raise LedgerError(
            f"ledger {path} changed after it was read; refusing to overwrite it"
        )
    if candidate == expected:
        return
    _atomic_write(path, candidate, durable_directory=durable_directory)


@contextmanager
def _ledger_mutation_scope(path: Path) -> Iterator[str]:
    """Own one ledger lock and translate its read/write failures consistently."""
    lock = ledger_lock_path(path)
    try:
        acquired, waited_seconds = acquire_ledger_lock(lock)
    except OSError as exc:
        raise LedgerError(f"could not acquire ledger lock {lock}: {exc}") from exc
    if not acquired:
        raise LedgerError(
            f"ledger lock {lock}: another ledger writer still holds it after "
            f"{waited_seconds:.2f}s of retries"
        )
    try:
        _sweep_scratch(path.parent, lambda target: target == path.name)
        text = path.read_text(encoding="utf-8")
        _refuse_controller_export(path, text, "a ledger mutation")
        yield text
    except LedgerError:
        raise
    except OSError as exc:
        raise LedgerError(f"could not mutate ledger {path}: {exc}") from exc
    except UnicodeError as exc:
        raise LedgerError(f"could not read ledger {path}: {exc}") from exc
    finally:
        release_ledger_lock(lock)


def _locked_ledger_mutation(
    path: Path,
    build: Callable[[str], str],
    clear_announcement_ids: Collection[str] | None = None,
    post_commit: Callable[[], None] | None = None,
) -> None:
    """Run one validated, compare-and-swap mutation under the required locks.

    ``None`` selects a ledger-only mutation. Any supplied collection, including
    an empty one, selects announcement-first locking and a durable state prune.
    The collection is read after ``build`` returns so builders such as
    ``apply-answers`` may populate a shared mutable list while constructing the
    candidate. The post-commit callback runs only after the ledger write
    succeeds and while every selected outer lock is still held.
    """

    def mutate() -> None:
        with _ledger_mutation_scope(path) as original:
            candidate = build(original)
            issues = _validate_text(candidate, path)
            if issues:
                raise LedgerError(
                    "the mutation would leave the ledger invalid:\n"
                    + "\n".join(issues)
                )
            if clear_announcement_ids is not None:
                _prune_announcement_state_strict(path, clear_announcement_ids)
            _write_if_unchanged(path, original, candidate)
            if post_commit is not None:
                post_commit()

    if clear_announcement_ids is None:
        mutate()
        return

    # Notification readers own only the announcement lock. Taking it before
    # the ledger lock prevents a clear waiting behind notifier I/O from
    # convoying unrelated ledger writers, and keeps every two-lock operation in
    # one order.
    with _announcement_lock(path, strict=True):
        mutate()


@dataclass(frozen=True)
class MutationRequest:
    command: str
    target: str
    input_sha256: str
    section: str | None
    request_id_sha256: str | None
    operation: str


def _mutation_request(
    command: str,
    target: str,
    raw_input: bytes,
    section: str | None,
    request_id: str | None,
) -> MutationRequest:
    if request_id is not None and REQUEST_ID_RE.fullmatch(request_id) is None:
        raise LedgerError(
            "--request-id must match [A-Za-z0-9][A-Za-z0-9._-]"
            f"{{0,{REQUEST_ID_MAX_LENGTH - 1}}}"
        )
    input_sha256 = _sha256_bytes(raw_input)
    request_hash = _sha256_text(request_id) if request_id is not None else None
    identity = {
        "command": command,
        "target": target,
        "input_sha256": input_sha256,
        "section": section,
    }
    operation_source = (
        {"command": command, "request_id_sha256": request_hash}
        if request_hash is not None
        else identity
    )
    operation = _sha256_text(
        json.dumps(operation_source, sort_keys=True, separators=(",", ":"))
    )
    return MutationRequest(
        command,
        target,
        input_sha256,
        section,
        request_hash,
        operation,
    )


def _receipt_for(
    request: MutationRequest, results: list[str], effect: list[str]
) -> dict[str, object]:
    return {
        "v": LEDGER_META_VERSION,
        "kind": MUTATION_RECEIPT_KIND,
        "command": request.command,
        "operation": request.operation,
        "request_id_sha256": request.request_id_sha256,
        "target": request.target,
        "input_sha256": request.input_sha256,
        "options": {"section": request.section},
        "results": results,
        "effect_lines": len(effect),
        "effect_sha256": _sha256_text("\n".join(effect)),
    }


def _receipt_matches_request(data: dict[str, object], request: MutationRequest) -> bool:
    return (
        data.get("command") == request.command
        and data.get("target") == request.target
        and data.get("input_sha256") == request.input_sha256
        and data.get("options") == {"section": request.section}
        and data.get("request_id_sha256") == request.request_id_sha256
    )


def _place_receipt(candidate: str, receipt_line: str) -> str:
    """Replace the single unfenced receipt anchor and leave quoted examples intact."""
    lines = candidate.splitlines()
    mask = _fence_mask(lines)
    anchors = [
        index
        for index, line in enumerate(lines)
        if mask[index] is FenceState.OUTSIDE and line == RECEIPT_PLACEHOLDER
    ]
    if len(anchors) != 1:
        raise LedgerError("receipt-bearing mutation misplaced its receipt anchor")
    lines[anchors[0]] = receipt_line
    return chr(10).join(lines) + (chr(10) if candidate.endswith(chr(10)) else "")


def _validated_mutation_metadata(text: str, path: Path) -> list[LedgerMeta]:
    """Refuse corrupt receipts before an append, replay, or trailer rewrite."""
    metadata, issues = _scan_ledger_metadata(text, path)
    issues += _receipt_effect_issues(text, path, metadata)
    if issues:
        raise LedgerError("the ledger contains invalid metadata:\n" + "\n".join(issues))
    return metadata


def _locked_receipted_mutation(
    path: Path,
    request: MutationRequest,
    build: Callable[[str], tuple[str, list[str], list[str]]],
) -> list[str]:
    """Run or replay one receipt-bearing ledger mutation under its lock."""
    with _ledger_mutation_scope(path) as original:
        metadata = _validated_mutation_metadata(original, path)
        matching = [
            meta
            for meta in metadata
            if meta.data.get("kind") == MUTATION_RECEIPT_KIND
            and meta.data.get("command") == request.command
            and meta.data.get("operation") == request.operation
        ]
        if matching:
            receipt = matching[0].data
            if not _receipt_matches_request(receipt, request):
                raise LedgerError(
                    "--request-id was already used for different input, target, "
                    "or options in this ledger command"
                )
            _fsync_directory(path.parent)
            return list(cast(list[str], receipt["results"]))
        candidate, results, effect = build(original)
        if not effect:
            raise LedgerError("receipt-bearing mutation produced an empty effect")
        receipt_line = _metadata_line(_receipt_for(request, results, effect))
        candidate = _place_receipt(candidate, receipt_line)
        issues = _validate_text(candidate, path)
        if issues:
            raise LedgerError(
                "the mutation would leave the ledger invalid:\n" + "\n".join(issues)
            )
        _write_if_unchanged(
            path, original, candidate, durable_directory=True
        )
        return results


def _locate_finding_header(text: str, identifier: str) -> tuple[list[str], int]:
    """Return the lines and header index for one real finding id."""
    lines, headers, _ = _unfenced_header_matches(text)
    target = next(
        (
            (header_index, match)
            for _heading_index, header_index, match in headers
            if match.group("id") == identifier
        ),
        None,
    )
    if target is None:
        raise LedgerError(f"finding id {identifier} is not present in the ledger")
    return lines, target[0]


def claim_spool(
    spool: Path,
    claim: Path,
    legacy: Path | None = None,
    *,
    into_existing: bool = False,
) -> list[Path] | None:
    """Take exclusive ownership of a spool's published files, by rename.

    Shared by both spool consumers — the inbox of filed findings and the spool of
    answered decisions. They fold different things into the ledger, but the
    dangerous half is identical, so it lives here once.

    The fixed directory records durable ownership of one batch. ``os.mkdir``
    is atomic, so two consumers cannot both claim the same published files; the
    ledger flock provides writer exclusion across different batches and spool
    consumers. Both are needed because the drain applies answers between
    clusters while `/decide` may apply them from another terminal.

    Claiming by RENAME is what makes a refused batch survivable: it sits at a
    fixed inspectable path instead of having been consumed. A writer publishing
    between the glob and the rename simply lands in the next batch.

    Returns the claimed paths (possibly empty), or None when another consumer
    holds the claim.
    """
    # Checked BEFORE the empty-spool shortcut, never after: a refusal moves the
    # batch INTO the claim, so the spool is normally empty afterwards. Testing
    # emptiness first would hide the leftover in exactly the situation it exists
    # to signal.
    if claim.exists() and not into_existing:
        return None

    published = sorted(spool.glob("*.md"))
    if legacy is not None and legacy.exists():
        published.append(legacy)
    if not published:
        return []
    # Every member lands in the claim under its bare name, and that name is how
    # the merge tells the legacy inbox apart (it has no filing date to read).
    # A spool file carrying it would be misdated, or overwritten on rename.
    if legacy is not None and (spool / legacy.name).exists():
        raise LedgerError(
            f"{spool / legacy.name} is named like the legacy inbox {legacy}; "
            "rename it to <YYYYMMDD-HHMMSS>-<suffix>.md by hand, then retry — "
            "nothing was claimed"
        )

    if into_existing:
        for source in published:
            destination = claim / source.name
            if destination.exists():
                raise LedgerError(
                    f"cannot claim {source} into {destination}: the destination "
                    "already exists; the claim and inbox are unchanged"
                )

    if not into_existing:
        try:
            os.mkdir(claim)
        except FileExistsError:
            # Lost the race between the check above and here. That check is only the
            # cheap early report; this is the mutex.
            return None

        try:
            _write_claim_intent(claim, "claimed")
        except OSError:
            with suppress(OSError):
                claim.rmdir()
            raise

    claimed: list[Path] = []
    for source in published:
        destination = claim / source.name
        try:
            os.rename(source, destination)
        except FileNotFoundError:
            continue
        _remove_consumed_published_twin(spool, source)
        claimed.append(destination)

    if not claimed and not into_existing:
        # Everything vanished under us between the glob and the rename. Drop the
        # claim rather than leaving an empty one: `claim.exists()` means "a batch
        # is sitting outside the queue", and an empty directory asserting that
        # would refuse every later consume until someone deleted it by hand.
        _remove_claim_intent(claim)
        claim.rmdir()
    return claimed


def _claim_intent_path(claim: Path) -> Path:
    return claim / MERGE_INTENT_NAME


def _write_claim_intent(
    claim: Path,
    phase: str,
    ids: set[str] | None = None,
    receipt_ids: dict[str, dict[str, str]] | None = None,
    fixed: Collection[str] | None = None,
    *,
    files: dict[str, dict[str, object]] | None = None,
    quarantined: dict[str, str] | None = None,
) -> None:
    payload: dict[str, object] = {"phase": phase}
    if ids is not None:
        payload["ids"] = sorted(ids)
    if receipt_ids is not None:
        payload["receipt_ids"] = dict(sorted(receipt_ids.items()))
    if fixed is not None:
        payload["fixed"] = sorted(fixed)
    if files is not None:
        payload["files"] = dict(sorted(files.items()))
    if quarantined:
        payload["quarantined"] = dict(sorted(quarantined.items()))
    intent = _claim_intent_path(claim)
    serialized = json.dumps(payload, sort_keys=True)
    _atomic_write(intent, serialized, durable_directory=True)


def _remove_claim_intent(claim: Path) -> None:
    _claim_intent_path(claim).unlink(missing_ok=True)
    for scratch in claim.glob(f"{MERGE_INTENT_NAME}.tmp-*"):
        scratch.unlink(missing_ok=True)


def _quarantine_claim_files(
    claim: Path, spool: Path, intent: ClaimIntent
) -> None:
    """Move intent-recorded irregular answer files to a durable side directory.

    Quarantine is part of the claim lifecycle. The intent is written before this
    move, so a crash leaves a restartable record; a file already at its refused
    destination is the completed half of that move and is accepted on replay.
    """
    if not intent.quarantined:
        return
    refused = spool.with_name(f"{spool.name}.refused")
    try:
        if not refused.exists():
            refused.mkdir(parents=True)
            _fsync_directory(refused.parent)
        elif not refused.is_dir():
            raise LedgerError(
                f"cannot quarantine answers: {refused} exists but is not a directory"
            )
        for name, reason in sorted(intent.quarantined.items()):
            source = claim / name
            destination = refused / name
            if source.exists():
                if destination.exists():
                    raise LedgerError(
                        f"cannot quarantine {source.name}: destination "
                        f"{destination} already exists"
                    )
                os.rename(source, destination)
                print(f"quarantined {name}: {reason}")
            elif not destination.exists():
                raise LedgerError(
                    f"quarantined answer {name} is missing from both {claim} and "
                    f"{refused}; the claim is kept"
                )
        _fsync_directory(refused)
        _fsync_directory(claim)
    except OSError as exc:
        raise LedgerError(
            f"could not quarantine answers from {claim} into {refused}: {exc}"
        ) from exc


def _complete_claim(
    claim: Path,
    spool: Path,
    claimed: list[Path],
    receipt_ids: dict[str, str | dict[str, str]] | None,
    proven_ids: Collection[str],
    *,
    publish_locked: bool,
) -> None:
    """Write terminal receipts and release a claim after its entries are proven.

    ``proven_ids`` are the intent ids the caller found in the ledger. A claimed
    filing is released only if every entry it carries is among them and, unless
    ``receipt_ids`` is None (an intent written before that mapping existed), a
    receipt record names it. Anything else would be deleted with its receipt
    still ``published``; the deferred reconciliation refuses it the same way.
    """
    records = (
        _receipt_records_from_intent(claim, receipt_ids) if receipt_ids else []
    )
    recorded = {published for _receipt, published, _identifier in records}
    unrecorded: list[str] = []
    for path in claimed:
        if receipt_ids is not None and path.name not in recorded:
            unrecorded.append(path.name)
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            continue
        except (OSError, UnicodeError) as exc:
            raise LedgerError(
                f"could not read {path} while releasing {claim}: {exc}"
            ) from exc
        carried = header_ids(text)
        if not carried or not carried.issubset(proven_ids):
            unrecorded.append(path.name)
    if unrecorded:
        raise LedgerError(
            f"{', '.join(sorted(unrecorded))} in {claim} carries no recorded entry; "
            f"the claim is kept — move it back to {spool} by hand, then retry"
        )
    if records:
        _write_merged_receipts(spool, records)
    release_spool(claim, spool, claimed, publish_locked=publish_locked)


def _write_merged_receipts(inbox: Path, records: list[tuple[str, str, str]]) -> None:
    """Record the consumer outcome for each claimed filing."""
    for receipt_name, published, identifier in records:
        path = receipt_directory(inbox) / receipt_name
        existing = _read_receipt(path)
        if existing is not None and existing["state"] == "merged":
            if (
                existing.get("published") != published
                or existing.get("id") != identifier
            ):
                raise LedgerError(
                    f"merged receipt {path} does not match the claimed outcome"
                )
            continue
        _write_receipt(
            path,
            {"state": "merged", "published": published, "id": identifier},
        )


def _receipt_records_from_intent(
    claim: Path,
    receipt_ids: dict[str, str | dict[str, str]],
    *,
    keys: Collection[str] | None = None,
) -> list[tuple[str, str, str]]:
    """Reconstruct merged receipts from the durable claim intent."""
    claimed = sorted(claim.glob("*.md"))
    selected = set(keys) if keys is not None else set(receipt_ids)
    records: list[tuple[str, str, str]] = []
    for filing_key, receipt in receipt_ids.items():
        if filing_key not in selected:
            continue
        if isinstance(receipt, dict):
            receipt_name = receipt.get("receipt", f"{filing_key}.json")
            records.append((receipt_name, receipt["published"], receipt["id"]))
            continue

        # Intents written before the published name was persisted still need a
        # scan. A receipt that cannot be mapped to exactly one claimed file
        # REFUSES below and preserves the claim. Releasing it instead reports
        # success while destroying the id mapping the receipt exists to carry,
        # and a released claim cannot be retried; a preserved one can.
        identifier = receipt
        matching: list[Path] = []
        for path in claimed:
            try:
                content = path.read_text(encoding="utf-8")
            except (OSError, UnicodeError) as exc:
                raise LedgerError(
                    f"claim intent {claim} could not read {path} while mapping "
                    f"receipt {filing_key}: {exc}"
                ) from exc
            if identifier in header_ids(content):
                matching.append(path)
        if len(matching) != 1:
            raise LedgerError(
                f"claim intent {claim} cannot map receipt {filing_key} to "
                "exactly one claimed file; refusing to release the claim"
            )
        records.append((f"{filing_key}.json", matching[0].name, identifier))
    return records


def _receipt_intent_key_is_valid(key: object) -> bool:
    """Validate a receipt-intent key from either the current or legacy format."""
    if not isinstance(key, str):
        return False
    if re.fullmatch(r"[0-9a-f]{64}", key):
        return True
    path_name, separator, entry_index = key.partition("#")
    return (
        path_name.endswith(".md")
        and Path(path_name).name == path_name
        and (not separator or entry_index.isdecimal())
    )


def _validate_answers_files(
    claim: Path,
    files: object,
    ids: list[str],
    quarantined: dict[str, str] | None = None,
) -> dict[str, dict[str, object]]:
    """Validate and authenticate the recorded effect of an answers claim."""
    if not isinstance(files, dict):
        raise ValueError("files must be an object")
    if len(ids) != len(set(ids)) or set(ids) != {
        value.get("id")
        for value in files.values()
        if isinstance(value, dict) and isinstance(value.get("id"), str)
    }:
        raise ValueError("files ids do not match ids")
    result: dict[str, dict[str, object]] = {}
    for name, value in files.items():
        if (
            not isinstance(name, str)
            or not name.endswith(".md")
            or name in {".", ".."}
            or Path(name).name != name
        ):
            raise ValueError("invalid answers file name")
        if not isinstance(value, dict):
            raise ValueError("answers file records must be objects")
        identifier = value.get("id")
        is_quarantined = quarantined is not None and name in quarantined
        # A fresh unreadable answer cannot reveal its id or answer class.  The
        # caller records an explicit tombstone so the durable quarantine name is
        # still a member of ``files``; prepared claims retain their real id and
        # continue through the full schema below.
        if is_quarantined and identifier is None:
            if value.get("kind") != "quarantine":
                raise ValueError("invalid quarantined answer record")
            result[name] = value
            continue
        blocked = value.get("blocked")
        status = value.get("status")
        kind = value.get("kind")
        evidence = value.get("evidence")
        previous_occurrences = value.get("previous_occurrences")
        previous_line_occurrences = value.get("previous_line_occurrences")
        if not isinstance(identifier, str) or ID_RE.fullmatch(identifier) is None:
            raise ValueError("invalid answers file id")
        if not isinstance(blocked, str) or classify_blocker(blocked) not in {
            BLOCKER_ANSWERABLE,
            BLOCKER_VERIFIER,
        }:
            raise ValueError("answers file blocker is not answerable")
        if not isinstance(status, str) or status not in STATUSES:
            raise ValueError("invalid answers file status")
        if kind not in {"decision", "approve", "reject"}:
            raise ValueError("invalid answers file kind")
        if (kind == "decision") != (classify_blocker(blocked) == BLOCKER_ANSWERABLE):
            raise ValueError("answers file kind does not match blocker")
        if (
            not isinstance(evidence, list)
            or not evidence
            or not all(isinstance(line, str) for line in evidence)
        ):
            raise ValueError("invalid answers file evidence")
        if (
            not isinstance(previous_occurrences, int)
            or isinstance(previous_occurrences, bool)
            or previous_occurrences < 0
        ):
            raise ValueError("invalid previous evidence occurrence count")
        if not isinstance(previous_line_occurrences, dict):
            raise ValueError("invalid previous evidence line counts")
        distinct_evidence = set(evidence)
        if set(previous_line_occurrences) != distinct_evidence:
            raise ValueError("previous evidence line counts do not match evidence")
        if any(
            not isinstance(count, int)
            or isinstance(count, bool)
            or count < 0
            for count in previous_line_occurrences.values()
        ):
            raise ValueError("invalid previous evidence line count")
        result[name] = value

    record_ids = {
        cast(str, value["id"])
        for value in result.values()
        if isinstance(value.get("id"), str)
    }
    if len(record_ids) != sum(
        1 for value in result.values() if isinstance(value.get("id"), str)
    ):
        raise ValueError("duplicate answers file ids")

    for name, value in result.items():
        path = claim / name
        if not path.exists():
            continue
        if quarantined is not None and name in quarantined:
            continue
        try:
            parsed = _parse_answer_file(path)
        except (OSError, UnicodeError) as exc:
            if quarantined is None:
                raise LedgerError(f"could not read {path}: {exc}") from exc
            quarantined[name] = "unreadable"
            continue
        if parsed is None:
            raise LedgerError(f"could not read {path}: invalid answer file")
        identifier, bullet = parsed
        if identifier != value["id"]:
            raise LedgerError(
                f"could not read {path}: answer id {identifier} does not match "
                f"recorded id {value['id']}"
            )
        kind = cast(str, value["kind"])
        legacy_evidence: list[str] | None = None
        if kind != "decision":
            try:
                # A prepared intent can predate the P2 verifier actor gate.  Its
                # recorded evidence is the durable source of truth for recovery;
                # newly claimed spool answers are still parsed strictly below.
                parsed_kind = _sentry_answer_kind(bullet, allow_legacy=True)
            except LedgerError as exc:
                raise LedgerError(f"could not read {path}: {exc}") from exc
            if parsed_kind != kind:
                raise LedgerError(
                    f"could not read {path}: answer kind {parsed_kind} does not "
                    f"match recorded kind {kind}"
                )
            derived = bullet + _sentry_answer_evidence(bullet, kind)
            # Claims prepared by the pre-P2 answer consumer recorded the same
            # verifier effect without the actor prefix.  Keep those durable
            # claims recoverable while every newly applied answer uses the
            # authenticated, actor-prefixed evidence below.
            legacy_evidence = bullet + _sentry_answer_evidence(
                bullet, kind, actor_prefixed=False
            )
        else:
            derived = bullet
        if derived != value["evidence"] and legacy_evidence != value["evidence"]:
            raise LedgerError(
                f"could not read {path}: recorded evidence does not match the "
                "answer file"
            )
    return result


def _read_claim_intent(
    claim: Path, *, strict: bool = True
) -> ClaimIntent | None:
    """Read one claim intent and preserve whether it uses a legacy shape."""
    if not claim.exists():
        return None
    intent_path = _claim_intent_path(claim)
    claimed = tuple(sorted(claim.glob("*.md")))
    if not intent_path.exists():
        if not claimed:
            return None
        raise LedgerError(
            f"a claim at {claim} has no {MERGE_INTENT_NAME}; it predates durable "
            "claim recovery. Restore or inspect it before retrying."
        )
    try:
        record = json.loads(intent_path.read_text(encoding="utf-8"))
        if not isinstance(record, dict):
            raise TypeError("expected a JSON object")
        phase = record["phase"]
        if phase not in {"claimed", "prepared"}:
            raise ValueError(f"unknown phase {phase!r}")

        raw_receipts = record.get("receipt_ids")
        receipt_ids: dict[str, str | dict[str, str]] = {}
        if raw_receipts is not None:
            if not isinstance(raw_receipts, dict):
                raise TypeError("receipt_ids must be an object")
            for filing_key, receipt in raw_receipts.items():
                if not _receipt_intent_key_is_valid(filing_key):
                    raise ValueError("invalid receipt_ids key")
                if isinstance(receipt, str):
                    if ID_RE.fullmatch(receipt) is None:
                        raise ValueError("invalid receipt id")
                    receipt_ids[filing_key] = receipt
                    continue
                if not isinstance(receipt, dict):
                    raise TypeError("receipt_ids values must be objects")
                if set(receipt) not in (
                    {"id", "published"},
                    {"id", "published", "receipt"},
                ):
                    raise ValueError("invalid receipt record")
                identifier = receipt.get("id")
                published = receipt.get("published")
                receipt_name = receipt.get("receipt")
                if (
                    not isinstance(identifier, str)
                    or ID_RE.fullmatch(identifier) is None
                    or not isinstance(published, str)
                    or not published
                    or Path(published).name != published
                    or (
                        receipt_name is not None
                        and (
                            not isinstance(receipt_name, str)
                            or not receipt_name.endswith(".json")
                            or Path(receipt_name).name != receipt_name
                        )
                    )
                ):
                    raise ValueError("invalid receipt record")
                receipt_ids[filing_key] = {
                    "id": identifier,
                    "published": published,
                    **({"receipt": receipt_name} if receipt_name is not None else {}),
                }

        raw_ids = record.get("ids")
        if raw_ids is None:
            ids = [
                receipt["id"] if isinstance(receipt, dict) else receipt
                for receipt in receipt_ids.values()
            ]
        elif not strict:
            ids = (
                list(raw_ids)
                if isinstance(raw_ids, list)
                and all(isinstance(identifier, str) for identifier in raw_ids)
                else []
            )
        else:
            if not isinstance(raw_ids, list) or not all(
                isinstance(identifier, str) and ID_RE.fullmatch(identifier) is not None
                for identifier in raw_ids
            ):
                raise ValueError("invalid ids")
            ids = list(raw_ids)
            if len(ids) != len(set(ids)):
                raise ValueError("duplicate ids")

        raw_fixed = record.get("fixed")
        if raw_fixed is None:
            fixed: set[str] = set()
        elif not strict:
            fixed = set()
        else:
            if not isinstance(raw_fixed, list) or not all(
                isinstance(identifier, str)
                and ID_RE.fullmatch(identifier) is not None
                for identifier in raw_fixed
            ):
                raise ValueError("invalid fixed ids")
            fixed = set(raw_fixed)
        files = None
        quarantined: dict[str, str] = {}
        raw_quarantined = record.get("quarantined")
        if raw_quarantined is not None:
            if not isinstance(raw_quarantined, dict):
                raise TypeError("quarantined must be an object")
            for name, reason in raw_quarantined.items():
                if (
                    not isinstance(name, str)
                    or not isinstance(reason, str)
                    or not reason
                ):
                    raise ValueError("invalid quarantined record")
                quarantined[name] = reason
        if "files" in record:
            files = _validate_answers_files(
                claim, record["files"], ids, quarantined
            )
            # Prepared claims carry a complete file record for every answer,
            # including a file discovered unreadable during recovery.  A
            # direct apply may have no readable id to record at all; its
            # quarantine-only intent is the one explicit empty-files case.
            if any(name not in files for name in quarantined):
                raise ValueError("quarantined file is absent from files")
            # Persist unreadable-file discoveries before a recovery caller can
            # move or replay any member of this claim.
            if quarantined and raw_quarantined != quarantined:
                _write_claim_intent(
                    claim,
                    phase,
                    set(ids),
                    receipt_ids if raw_receipts is not None else None,
                    fixed if raw_fixed is not None else None,
                    files=files,
                    quarantined=quarantined,
                )
        elif quarantined:
            raise ValueError("quarantined requires files")
        return ClaimIntent(
            phase,
            ids,
            receipt_ids,
            raw_receipts is not None,
            fixed,
            raw_fixed is not None,
            claimed,
            files,
            quarantined,
        )
    except (OSError, UnicodeError, ValueError, KeyError, TypeError) as exc:
        raise LedgerError(f"could not read {intent_path}: {exc}") from exc


def _recover_claim(
    claim: Path,
    spool: Path,
    ledger: Path,
    *,
    answers: bool = False,
    publish_locked: bool = False,
) -> None:
    """Finish or replay a stranded claim using its durable intent record."""
    if not claim.exists():
        return

    intent = _read_claim_intent(claim, strict=False)
    if intent is None:
        _remove_claim_intent(claim)
        claim.rmdir()
        return
    _quarantine_claim_files(claim, spool, intent)
    claimed = list(intent.claimed)
    if intent.phase == "prepared" and not answers:
        ids = [
            cast(str, value["id"])
            for name, value in (intent.files or {}).items()
            if name not in intent.quarantined and isinstance(value.get("id"), str)
        ] or [identifier for identifier in intent.ids if not intent.quarantined]
        if ids:
            try:
                ledger_text = ledger.read_text(encoding="utf-8")
            except (OSError, UnicodeError) as exc:
                raise LedgerError(
                    f"could not read ledger {ledger} while recovering {claim}: {exc}"
                ) from exc
            current_ids = header_ids(ledger_text)
            complete = all(identifier in current_ids for identifier in ids)
            if complete:
                _complete_claim(
                    claim,
                    spool,
                    claimed,
                    intent.receipt_ids if intent.has_receipt_ids else None,
                    ids,
                    publish_locked=publish_locked,
                )
                print(
                    f"NOTE completed stranded batch from {claim}; the ledger already "
                    "contains every recorded id",
                    file=sys.stderr,
                )
                return

    # Replay is deliberately ordered: the work returns to the spool first, then
    # the intent and claim disappear. A crash after any one step is restartable.
    legacy = None if answers else spool.with_suffix(".md")
    spool.mkdir(parents=True, exist_ok=True)
    for path in claimed:
        _return_claimed_file(path, spool, legacy)
    _remove_claim_intent(claim)
    claim.rmdir()


def _return_claimed_file(path: Path, spool: Path, legacy: Path | None) -> None:
    """Move one claimed file back to where the next merge will claim it again.

    The legacy inbox returns to its own path: in the spool its name would read
    as a misnamed filing, which `claim_spool` refuses.
    """
    if legacy is None or path.name != legacy.name:
        os.rename(path, spool / path.name)
        return
    if legacy.exists():
        raise LedgerError(
            f"cannot return {path} to {legacy}: a new legacy inbox exists there; "
            f"merge the two by hand, then retry — {path.parent} is kept"
        )
    os.rename(path, legacy)


def _release_spool_contents(claim: Path, spool: Path, claimed: list[Path]) -> None:
    """Remove claimed files and the claim, leaving spool-directory cleanup aside."""
    for path in claimed:
        path.unlink(missing_ok=True)
    _remove_claim_intent(claim)
    claim.rmdir()


def release_spool(
    claim: Path,
    spool: Path,
    claimed: list[Path],
    *,
    publish_locked: bool = False,
) -> None:
    """Drop the claim and the spool directory once a batch is consumed.

    The spool is transient published work, not a drain-running signal, so an empty
    directory should be removed after a successful merge. ENOTEMPTY is expected
    rather than exceptional: a writer may publish between the claim and here, and
    that entry belongs to the next batch.
    """
    # Cleanup follows the ledger commit, so failures are warnings and not retries.
    try:
        _release_spool_contents(claim, spool, claimed)
    except OSError as exc:
        print(
            f"WARN ledger write committed but could not clean up claim {claim}: {exc}",
            file=sys.stderr,
        )
        return

    def remove_spool() -> None:
        try:
            spool.rmdir()
        except FileNotFoundError:
            pass
        except OSError as exc:
            if exc.errno != errno.ENOTEMPTY:
                print(
                    f"WARN ledger write committed but could not remove spool "
                    f"{spool}: {exc}",
                    file=sys.stderr,
                )

    if publish_locked:
        remove_spool()
    else:
        try:
            with _publish_lock(publish_lock_path(spool)):
                remove_spool()
        except LedgerError as exc:
            print(
                f"WARN ledger write committed but could not lock spool {spool} "
                f"for cleanup: {exc}",
                file=sys.stderr,
            )


def _report_refused_claim(
    claim: Path, *, batch: str, action: str, stranded: str
) -> int:
    """Report a refused spool batch that remains outside the ledger."""
    batch_label = f" of {batch}" if batch else ""
    print(
        f"FAIL a previously refused batch{batch_label} is still unresolved: {claim}\n"
        f"Fix or remove it before {action} again — proceeding would work the queue "
        f"while {stranded} sits outside it.\n"
        f"To retry: correct the files in place, move them back into the spool, and "
        f"remove the empty claim directory. Nothing re-reads the claim on its own — "
        f"its existence is the stop signal, so a fixed batch left there stays stranded.",
        file=sys.stderr,
    )
    return 1


def _report_ledger_lock_busy(lock: Path, waited_seconds: float) -> int:
    """Report that another ledger writer still owns the shared lock."""
    print(
        f"FAIL ledger lock {lock}: another ledger writer still holds it after "
        f"{waited_seconds:.2f}s of retries (window "
        f"{LEDGER_LOCK_WAIT_SECONDS:.2f}s).",
        file=sys.stderr,
    )
    return 1


def _merge_sources(claimed: list[Path], ledger: Path) -> list[str]:
    """Read, refuse and normalise each claimed filing before it enters the ledger."""
    sources: list[str] = []
    for path in claimed:
        try:
            text = path.read_text(encoding="utf-8").strip()
        except (OSError, UnicodeError) as exc:
            raise LedgerError(f"could not read claimed filing {path}: {exc}") from exc
        unfenced = _unfenced_text(text)
        marker = _answer_evidence_marker(
            unfenced, sentry_origin=_body_is_sentry_origin(unfenced)
        )
        if marker is not None:
            raise LedgerError(
                f"{path} carries '{marker}' answer evidence; only the answer route "
                "may write it"
            )
        normalized = _normalise_sentry_origin_entry(text, ledger)
        try:
            findings, problems, _vocabulary = _parse_text(
                _entry_candidate_text(normalized, ledger.read_text(encoding="utf-8")), ledger
            )
        except (OSError, UnicodeError, LedgerError) as exc:
            raise LedgerError(f"could not parse claimed filing {path}: {exc}") from exc
        if len(findings) == 1 and problems:
            raise LedgerError(f"claimed filing {path} is invalid: {'; '.join(problems)}")
        if (
            len(findings) == 1
            and _body_is_sentry_origin(_unfenced_body(findings[0]))
            and findings[0].status != "open"
        ):
            raise LedgerError(
                f"{path} is Sentry-origin but carries status "
                f"{findings[0].status!r}; new Sentry-origin entries must be filed open"
            )
        sources.append(normalized)
    return sources


def _receipt_entry_texts(text: str) -> list[str]:
    """Return each exact entry body used to key a filing receipt."""
    headers = _unfenced_header_matches(text)[1]
    if len(headers) == 1:
        return [text]
    lines = text.splitlines(keepends=True)
    return [
        "".join(lines[heading_index:next_heading_index])
        for index, (heading_index, _header_index, _match) in enumerate(headers)
        for next_heading_index in [
            headers[index + 1][0] if index + 1 < len(headers) else len(lines)
        ]
    ]


def _merge_receipt_digests(inbox: Path, legacy: Path) -> set[str]:
    """Collect batch and orphan digests before the receipt directory is indexed."""
    paths = list(inbox.glob("*.md")) + list(inbox.glob(".*.part"))
    if legacy.exists():
        paths.append(legacy)
    digests: set[str] = set()
    for path in paths:
        try:
            text = path.read_text(encoding="utf-8")
        except _READ_ERRORS:
            continue
        entry_texts = _receipt_entry_texts(text) or [text]
        digests.update(
            hashlib.sha256(entry_text.encode("utf-8")).hexdigest()
            for entry_text in entry_texts
        )
    return digests


def _allocate_receipt_path(
    inbox: Path,
    index: ReceiptIndex,
    entry_text: str,
    published: str,
    identifier: str,
    allocated_names: set[str],
) -> Path:
    """Allocate one existing or new receipt to exactly one claimed entry."""
    digest = hashlib.sha256(entry_text.encode("utf-8")).hexdigest()
    for path, record in index.by_filing.get((digest, published), []):
        recorded_id = record.get("id")
        if recorded_id is not None and recorded_id != identifier:
            raise LedgerError(
                f"filing receipt {path} records conflicting id {recorded_id}; "
                f"the claimed entry was allocated {identifier}"
            )
        if path.name not in allocated_names:
            return path

    bare = _receipt_path(inbox, entry_text)
    if bare.name not in index.by_name and bare.name not in allocated_names:
        return bare
    return _receipt_path(inbox, entry_text, filing_token=_unique_suffix())


def _resolved_repo_path(path: Path) -> Path:
    """Resolve a caller path before comparing it with the repository root."""
    try:
        return path.resolve()
    except (OSError, RuntimeError) as exc:
        raise LedgerError(f"could not resolve path {path}: {exc}") from exc


def _repo_relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _resolve_head(root: Path) -> str:
    result = _git_for_ledger(root, "rev-parse", "--verify", "-q", "HEAD^{commit}")
    if result.returncode != 0:
        raise LedgerError(f"could not resolve HEAD: {_git_failure_detail(result)}")
    commit = result.stdout.strip()
    if not commit:
        raise LedgerError("could not resolve HEAD: git returned an empty commit id")
    return commit


@contextmanager
def _head_ledger_snapshot(
    findings: Path, decisions: Path, *, strict_decisions: bool = True
) -> Iterator[HeadSnapshot]:
    """Materialise and validate the findings and decisions blobs in HEAD."""
    root = cast(Path, REPO_ROOT).resolve()
    findings = _resolved_repo_path(findings)
    decisions = _resolved_repo_path(decisions)
    commit = _resolve_head(root)
    with tempfile.TemporaryDirectory(prefix="findings-ledger-head-") as directory:
        tasks = Path(directory) / "tasks"
        tasks.mkdir()
        listed: dict[Path, bool] = {}
        for source in (findings, decisions):
            relative = _repo_relative(source, root)
            listed_result = _git_for_ledger(
                root, "ls-tree", "-r", "--name-only", commit, "--", relative
            )
            if listed_result.returncode != 0:
                raise LedgerError(
                    f"could not inspect HEAD for {relative}: "
                    f"{_git_failure_detail(listed_result)}"
                )
            listed[source] = relative in listed_result.stdout.splitlines()

        findings_text: str | None = None
        targets = {
            findings: tasks / "findings.md",
            decisions: tasks / "decisions.md",
        }
        for source, is_listed in listed.items():
            if not is_listed:
                continue
            relative = _repo_relative(source, root)
            shown = _git_for_ledger(root, "show", f"{commit}:{relative}")
            if shown.returncode != 0:
                if source == decisions and not strict_decisions:
                    continue
                raise LedgerError(
                    f"could not read {commit}:{relative}: "
                    f"{_git_failure_detail(shown)}"
                )
            target = targets[source]
            target.write_text(shown.stdout, encoding="utf-8")
            if source == findings:
                findings_text = shown.stdout

        if not listed[findings]:
            yield HeadSnapshot(None, False, "findings ledger is not in HEAD", tasks)
            return

        stderr = io.StringIO()
        stdout = io.StringIO()
        try:
            with redirect_stdout(stdout), redirect_stderr(stderr):
                valid = (
                    cmd_check(
                        argparse.Namespace(
                            ledger=tasks / "findings.md",
                            decisions=tasks / "decisions.md",
                        )
                    )
                    == 0
                )
        except (LedgerError, OSError, UnicodeError, ValueError) as exc:
            valid = False
            detail = str(exc)
        else:
            detail = stderr.getvalue().strip().replace("\n", "; ")
        if valid:
            detail = ""
        elif not detail:
            detail = "HEAD ledger validation failed"
        yield HeadSnapshot(findings_text, valid, detail, tasks)


def _validate_ledger_paths(findings: Path, decisions: Path) -> tuple[bool, str]:
    """Validate the working findings/decisions pair through the normal checker."""
    stdout = io.StringIO()
    stderr = io.StringIO()
    try:
        with redirect_stdout(stdout), redirect_stderr(stderr):
            result = cmd_check(
                argparse.Namespace(ledger=findings, decisions=decisions)
            )
    except (LedgerError, OSError, UnicodeError, ValueError) as exc:
        return False, str(exc)
    if result == 0:
        return True, ""
    detail = stderr.getvalue().strip().replace("\n", "; ")
    return False, detail or "ledger validation failed"


def _validate_candidate_pair(
    candidate: str, near: Path, decisions: Path
) -> tuple[bool, str]:
    """Validate a merged findings candidate against its selected decisions ledger."""
    try:
        with _candidate_scratch(candidate, near) as scratch:
            return _validate_ledger_paths(scratch, decisions)
    except (LedgerError, OSError, UnicodeError, ValueError) as exc:
        return False, str(exc)


def _candidate_citation_issues(
    candidate: str, near: Path, decisions: Path
) -> list[str]:
    """Check pending entry citations before a file can publish them."""
    try:
        with _candidate_scratch(candidate, near) as scratch:
            _resolved, issues = _citation_resolution(scratch, decisions)
            return issues
    except (LedgerError, OSError, UnicodeError, ValueError) as exc:
        return [str(exc)]


def _deferred_preconditions(ledger: Path, decisions: Path) -> None:
    """Refuse every non-ordinary deferred claim state before mutation."""
    root = cast(Path, REPO_ROOT).resolve()
    findings = _resolved_repo_path(ledger)
    decisions = _resolved_repo_path(decisions)
    try:
        _resolve_head(root)
    except LedgerError as exc:
        probe = _git_for_ledger(root, "rev-parse", "--verify", "-q", "HEAD^{commit}")
        if probe.returncode == 1:
            raise LedgerError(
                "the findings ledger is tracked but HEAD does not resolve; commit it first"
            ) from exc
        raise

    if not decisions.is_relative_to(root):
        raise LedgerError(
            f"{decisions} must be a tracked file inside the repository, or absent and "
            "untracked, while claims are finalised after the commit; commit, restore "
            "or move it"
        )
    relative_decisions = _repo_relative(decisions, root)
    tracked = _git_for_ledger(
        root, "ls-files", "--error-unmatch", "--", relative_decisions
    )
    if tracked.returncode == 0:
        if not decisions.exists():
            raise LedgerError(
                f"{decisions} must be a tracked file inside the repository, or absent "
                "and untracked, while claims are finalised after the commit; commit, "
                "restore or move it"
            )
    elif tracked.returncode == 1:
        if decisions.exists():
            raise LedgerError(
                f"{decisions} must be a tracked file inside the repository, or absent "
                "and untracked, while claims are finalised after the commit; commit, "
                "restore or move it"
            )
    else:
        raise LedgerError(f"fatal tracked-file probe: {_git_failure_detail(tracked)}")

    with _head_ledger_snapshot(findings, decisions) as snapshot:
        if snapshot.findings_text is None:
            raise LedgerError(f"{findings} is not in HEAD; commit it first")
        if not snapshot.valid:
            raise LedgerError(
                f"HEAD does not validate: {snapshot.detail}; repair and commit the "
                "ledgers first"
            )

    valid, detail = _validate_ledger_paths(findings, decisions)
    if not valid:
        raise LedgerError(
            f"the working ledgers do not validate: {detail}; repair them first"
        )


def _require_deferred_ledger_tracked(ledger: Path) -> None:
    """Refuse deferred finalisation if its ledger stopped being commit-backed."""
    root = cast(Path, REPO_ROOT).resolve()
    resolved = _resolved_repo_path(ledger)
    if not resolved.is_relative_to(root):
        raise LedgerError(
            f"{resolved} is no longer inside the repository; the deferred claim "
            "is kept"
        )
    relative = _repo_relative(resolved, root)
    tracked = _git_for_ledger(root, "ls-files", "--error-unmatch", "--", relative)
    if tracked.returncode == 1:
        raise LedgerError(
            f"{resolved} is no longer tracked; the deferred claim is kept"
        )
    if tracked.returncode != 0:
        raise LedgerError(
            f"fatal tracked-file probe: {_git_failure_detail(tracked)}"
        )


def _claim_finalisation_mode(
    ledger: Path, *, merge_without_intent: bool
) -> str:
    """Choose immediate compatibility or deferred durable claim finalisation."""
    if (
        os.environ.get(LEDGER_COMMIT_ENV) == "0"
        and os.environ.get("FINDINGS_CLAIM_FINALIZE") != "after-commit"
    ):
        return "immediate"
    if merge_without_intent:
        return "immediate"
    root = cast(Path, REPO_ROOT).resolve()
    resolved = _resolved_repo_path(ledger)
    if not resolved.is_relative_to(root):
        return "immediate"
    relative = _repo_relative(resolved, root)
    tracked = _git_for_ledger(root, "ls-files", "--error-unmatch", "--", relative)
    if tracked.returncode == 1:
        return "immediate"
    if tracked.returncode != 0:
        raise LedgerError(f"fatal tracked-file probe: {_git_failure_detail(tracked)}")
    return "deferred"


def _claim_entry_expectations(
    claim: Path, ledger: Path, intent: ClaimIntent
) -> dict[str, tuple[Path, FindingExpectation]]:
    """Parse every claimed entry and map it to exactly one intent record."""
    records_by_file: dict[str, list[str]] = {}
    for filing_key, record in intent.receipt_ids.items():
        if not isinstance(record, dict):
            raise LedgerError(
                f"claim intent {_claim_intent_path(claim)} predates deferred "
                "finalisation; finish it with env -u FINDINGS_CLAIM_FINALIZE "
                "FINDINGS_LEDGER_COMMIT=0 findings.py merge-inbox (today's recovery), "
                "or inspect it by hand"
            )
        records_by_file.setdefault(record["published"], []).append(filing_key)

    ids: set[str] = set()
    receipts: set[str] = set()
    for filing_key, record in intent.receipt_ids.items():
        identifier = record["id"]
        receipt_name = record.get("receipt", f"{filing_key}.json")
        if identifier in ids:
            raise LedgerError(
                f"claim intent {_claim_intent_path(claim)} records {identifier} twice; "
                "the claim is kept — inspect it by hand"
            )
        if receipt_name in receipts:
            raise LedgerError(
                f"claim intent {_claim_intent_path(claim)} records {receipt_name} twice; "
                "the claim is kept — inspect it by hand"
            )
        ids.add(identifier)
        receipts.add(receipt_name)

    claimed_by_name = {path.name: path for path in intent.claimed}
    for published in records_by_file:
        if published not in claimed_by_name:
            raise LedgerError(
                f"recorded filing {published} is missing from {claim}; the claim is "
                "kept — if its receipt reads merged and HEAD holds that filing, "
                "remove the record by hand, otherwise restore the file"
            )

    result: dict[str, tuple[Path, FindingExpectation]] = {}
    ledger_text = ledger.read_text(encoding="utf-8")
    for path in intent.claimed:
        if path.name not in records_by_file:
            raise LedgerError(
                f"{path} is in {claim} but not in its intent; move it back to "
                f"{claim.parent / claim.name.removesuffix('.claim')} by hand, then retry"
            )
        try:
            merged = _merge_sources([path], ledger)
            text = merged[0] if merged else ""
            entries = _receipt_entry_texts(text)
        except (OSError, UnicodeError, LedgerError) as exc:
            raise LedgerError(f"could not read {path} while reconciling {claim}: {exc}") from exc
        expected_keys = [
            path.name if len(entries) == 1 else f"{path.name}#{index}"
            for index in range(len(entries))
        ]
        actual_keys = sorted(records_by_file.get(path.name, []))
        if sorted(expected_keys) != actual_keys:
            raise LedgerError(
                f"{path} in {claim} holds entries its intent does not record; the "
                "claim is kept — inspect it by hand"
            )
        for filing_key, entry_text in zip(expected_keys, entries, strict=True):
            record = intent.receipt_ids[filing_key]
            assert isinstance(record, dict)
            parsed, problems, vocabulary = _parse_text(
                _entry_candidate_text(entry_text, ledger_text), ledger
            )
            if (
                len(parsed) != 1
                or problems
                or validate(parsed, problems, vocabulary, allow_pending=True)
            ):
                raise LedgerError(
                    f"{path} in {claim} holds entries its intent does not record; the "
                    "claim is kept — inspect it by hand"
                )
            if parsed[0].id not in {PENDING_ID, record["id"]}:
                raise LedgerError(
                    f"{path} in {claim} holds entries its intent does not record; "
                    "the claim is kept — inspect it by hand"
                )
            expected = _finding_expectation(parsed[0])
            if parsed[0].id == PENDING_ID:
                # The intent is durable before a rewritten claim file. A crash in
                # that window leaves the placeholder behind with the allocated
                # id already recorded in the intent.
                expected = replace(expected, identifier=record["id"])
            result[filing_key] = (path, expected)

    if set(result) != set(intent.receipt_ids):
        raise LedgerError(
            f"{claim} holds entries its intent does not record; the claim is kept — "
            "inspect it by hand"
        )
    return result


def _reset_nonfixed_ids(text: str, fixed: Collection[str]) -> str:
    """Return an adopted filing with provisional allocated ids pending again."""
    fixed_ids = set(fixed)
    lines, headers, _orphans = _unfenced_header_matches(text)
    for _heading_index, index, match in headers:
        identifier = match.group("id")
        if identifier != PENDING_ID and identifier not in fixed_ids:
            lines[index] = lines[index].replace(identifier, PENDING_ID, 1)
    return "\n".join(lines)


def _reconcile_prepared_claim(
    claim: Path,
    spool: Path,
    snapshot: HeadSnapshot | None,
    working_text: str,
    *,
    records: dict[str, tuple[Path, object]],
    classify: Callable[[object, str | None, str], str],
    finish_present: Callable[[Collection[str]], None],
    waiting_message: Callable[[Path, str], str],
    missing_message: Callable[[Path, str], str],
) -> Reconciliation:
    """Run the crash-safe lifecycle shared by inbox and answers claims."""
    intent = _read_claim_intent(claim)
    if intent is None:
        return Reconciliation([], {}, set(), False)
    if intent.phase != "prepared":
        raise LedgerError(
            f"claim intent {_claim_intent_path(claim)} has phase {intent.phase!r}; "
            "the claim is kept — inspect it by hand"
        )

    quarantined_names = set(intent.quarantined)
    records = {
        key: value for key, value in records.items() if key not in quarantined_names
    }
    keys_by_path: dict[Path, list[str]] = {}
    for key, (path, _record) in records.items():
        keys_by_path.setdefault(path, []).append(key)
        if path not in intent.claimed:
            raise LedgerError(missing_message(path, key))
    for path in intent.claimed:
        if path.name in quarantined_names:
            continue
        if path not in keys_by_path:
            raise LedgerError(
                f"{path} is in {claim} but not in its intent; move it back to "
                f"{spool} by hand, then retry"
            )

    head_text = snapshot.findings_text if snapshot is not None else None
    states: dict[str, str] = {}
    path_states: dict[Path, set[str]] = {}
    for key, (path, record) in records.items():
        state = classify(record, head_text, working_text)
        states[key] = state
        path_states.setdefault(path, set()).add(state)

    for path, path_state in path_states.items():
        if len(path_state) != 1:
            raise LedgerError(
                f"{path} in {claim} holds entries in different durability states; "
                "the claim is kept — inspect it by hand"
            )
        state = next(iter(path_state))
        if state == "waiting":
            raise LedgerError(waiting_message(path, keys_by_path[path][0]))

    present_keys = [key for key, state in states.items() if state == "present"]
    absent = [
        path
        for path, path_state in path_states.items()
        if path_state == {"absent"}
    ]
    receipt_names: dict[str, str] = {}
    for key in records:
        receipt = intent.receipt_ids.get(key)
        receipt_names[key] = (
            receipt.get("receipt", f"{key}.json")
            if isinstance(receipt, dict)
            else f"{key}.json"
        )

    if present_keys:
        finish_present(present_keys)
        remaining_keys = set(records) - set(present_keys)
        present_ids = {
            (
                intent.receipt_ids[key]["id"]
                if isinstance(intent.receipt_ids.get(key), dict)
                else cast(dict[str, object], records[key][1])["id"]
            )
            for key in present_keys
            if (
                isinstance(intent.receipt_ids.get(key), dict)
                or (
                    isinstance(records[key][1], dict)
                    and isinstance(records[key][1].get("id"), str)
                )
            )
        }
        remaining_ids = set(intent.ids) - cast(set[str], present_ids)
        remaining_receipts = {
            key: value
            for key, value in intent.receipt_ids.items()
            if key in remaining_keys
        }
        remaining_files = None
        if intent.files is not None:
            remaining_files = {
                name: value
                for name, value in intent.files.items()
                if name not in quarantined_names
                and any(path.name == name for path in absent)
            }
        intent_kwargs: dict[str, object] = {}
        if remaining_files is not None:
            intent_kwargs["files"] = remaining_files
        _write_claim_intent(
            claim,
            "prepared",
            cast(set[str], remaining_ids),
            cast(dict[str, dict[str, str]], remaining_receipts)
            if remaining_receipts
            else None,
            fixed=intent.fixed,
            **intent_kwargs,
        )
        for path, path_state in path_states.items():
            if path_state == {"present"}:
                path.unlink()

    present_paths = {
        path for path, path_state in path_states.items() if path_state == {"present"}
    }
    remaining_paths = [
        path for path in intent.claimed if path.exists() and path not in present_paths
    ]
    if not remaining_paths:
        release_spool(claim, spool, [], publish_locked=True)
        return Reconciliation([], receipt_names, set(intent.fixed), not claim.exists())
    return Reconciliation(absent, receipt_names, set(intent.fixed), False)


def _reconcile_inbox_claim(
    claim: Path, inbox: Path, ledger: Path, decisions: Path
) -> Reconciliation:
    """Classify and, once safe, finalise a prepared findings claim."""
    intent = _read_claim_intent(claim)
    if intent is None:
        return Reconciliation([], {}, set(), False)
    if intent.phase != "prepared":
        raise LedgerError(
            f"claim intent {_claim_intent_path(claim)} has phase {intent.phase!r}; "
            "the claim is kept — inspect it by hand"
        )
    if not intent.has_receipt_ids or not intent.has_fixed or any(
        not isinstance(record, dict) for record in intent.receipt_ids.values()
    ):
        raise LedgerError(
            f"claim intent {_claim_intent_path(claim)} predates deferred finalisation; "
            "finish it with env -u FINDINGS_CLAIM_FINALIZE "
            "FINDINGS_LEDGER_COMMIT=0 findings.py merge-inbox (today's recovery), "
            "or inspect it by hand"
        )

    entry_expectations = _claim_entry_expectations(claim, ledger, intent)
    working_text = ledger.read_text(encoding="utf-8")
    working_findings, _problems, _vocabulary = _parse_text(working_text, ledger)
    with _head_ledger_snapshot(ledger, decisions) as snapshot:
        if snapshot.findings_text is None:
            raise LedgerError(f"{ledger} is not in HEAD; commit it first")
        if not snapshot.valid:
            raise LedgerError(
                f"HEAD does not validate: {snapshot.detail}; repair and commit the "
                "ledgers first"
            )
        head_findings, _head_problems, _head_vocabulary = _parse_text(
            snapshot.findings_text, ledger
        )

    head_by_id = {finding.id: finding for finding in head_findings}
    working_by_id = {finding.id: finding for finding in working_findings}
    for filing_key, (path, _expected) in entry_expectations.items():
        if filing_key not in intent.receipt_ids:
            raise LedgerError(
                f"{path} in {claim} holds entries its intent does not record; the "
                "claim is kept — inspect it by hand"
            )

    def classify(
        expected_object: object, _head_text: str | None, _working: str
    ) -> str:
        # The parsed expectation maps above are the source of truth for this callback.
        expected = cast(FindingExpectation, expected_object)
        head = head_by_id.get(expected.identifier)
        working_finding = working_by_id.get(expected.identifier)
        path = next(
            path
            for path, candidate in entry_expectations.values()
            if candidate.identifier == expected.identifier
        )
        if head is not None:
            if not _finding_identity_preserved(expected, head):
                raise LedgerError(
                    f"entry {expected.identifier} in HEAD is not the claimed filing "
                    f"{path.name}; the claim is kept — inspect it by hand"
                )
            return "present"
        if working_finding is not None:
            if not _finding_identity_preserved(expected, working_finding):
                raise LedgerError(
                    f"entry {expected.identifier} in the working ledger is not the "
                    f"claimed filing {path.name}; the claim is kept — inspect it by hand"
                )
            return "waiting"
        return "absent"

    decisions_hint = f" [{decisions}]" if decisions.exists() else ""
    return _reconcile_prepared_claim(
        claim,
        inbox,
        snapshot,
        working_text,
        records=entry_expectations,
        classify=classify,
        finish_present=lambda keys: _write_merged_receipts(
            inbox,
            _receipt_records_from_intent(claim, intent.receipt_ids, keys=keys),
        ),
        waiting_message=lambda _path, _key: (
            f"a merged batch in {claim} is not durable yet (the entries are in "
            f"the working ledger but not in HEAD); commit it first: git commit -- "
            f"{ledger}{decisions_hint}"
        ),
        missing_message=lambda path, _key: (
            f"recorded filing {path.name} is missing from {claim}; the claim is "
            "kept — if its receipt reads merged and HEAD holds that filing, "
            "remove the record by hand, otherwise restore the file"
        ),
    )


def _ledger_bytes_postcondition(
    findings_bytes: bytes | None, decisions_bytes: bytes | None
) -> Callable[[Path, Path], bool]:
    def holds(findings_path: Path, decisions_path: Path) -> bool:
        try:
            return (
                (findings_bytes is None or findings_path.read_bytes() == findings_bytes)
                and (
                    decisions_bytes is None
                    or decisions_path.read_bytes() == decisions_bytes
                )
            )
        except OSError:
            return False

    return holds


def _settle_pending_ledger_dirt(intent: LedgerCommitIntent) -> None:
    """Commit valid pending ledger dirt before a deferred consumer mutation."""
    root = cast(Path, REPO_ROOT).resolve()
    findings = _resolved_repo_path(intent.findings)
    decisions = _resolved_repo_path(intent.decisions)
    dirty_paths: list[Path] = []
    for path in (findings, decisions):
        if path == decisions and not path.exists():
            continue
        relative = _repo_relative(path, root)
        result = _git_for_ledger(root, "diff", "--quiet", "HEAD", "--", relative)
        if result.returncode == 0:
            continue
        if result.returncode == 1:
            dirty_paths.append(path)
            continue
        raise LedgerError(
            f"pending ledger dirt could not be inspected ({_git_failure_detail(result)})"
        )
    if not dirty_paths:
        return

    valid, detail = _validate_ledger_paths(findings, decisions)
    if not valid:
        raise LedgerError(f"pending ledger dirt does not validate ({detail}); repair it before merging")

    findings_bytes = findings.read_bytes() if findings in dirty_paths else None
    decisions_bytes = decisions.read_bytes() if decisions in dirty_paths else None
    if findings_bytes is not None:
        # Judged on the exact bytes the commit carries, which its postcondition
        # verifies, so a Controller regeneration after the caller's own check
        # cannot slip in: dirt in an export is a regeneration, not a mutation.
        _refuse_controller_export(
            findings,
            _controller_export_head(findings_bytes),
            "a deferred ledger commit",
        )
    primary = findings if findings in dirty_paths else decisions
    companion = decisions if findings in dirty_paths and decisions in dirty_paths else None
    settle_intent = LedgerCommitIntent(
        command=intent.command,
        ledger=primary,
        findings=findings,
        decisions=decisions,
        subject=f"docs(findings): commit pending ledger dirt before {intent.command}",
        postcondition=_ledger_bytes_postcondition(findings_bytes, decisions_bytes),
        replaced=True,
        written_bytes=findings_bytes if findings_bytes is not None else decisions_bytes,
        companion=companion,
        companion_bytes=decisions_bytes if companion is not None else None,
    )
    result = _attempt_ledger_commit(settle_intent)
    if not result.durable:
        paths = " ".join(str(path) for path in dirty_paths)
        if result.durable_head:
            raise LedgerError(
                f"pending ledger dirt produced durable commit {result.durable_head} "
                f"but verification failed ({result.cause}); inspect git log for "
                f"{paths}"
            )
        raise LedgerError(
            f"pending ledger dirt could not be committed ({result.cause}); check git "
            f"status and git log, then commit it: git commit -- {paths}"
        )


def _answers_legacy_intent_message(
    claim: Path, answers: Path, ledger: Path, mode: str
) -> str:
    basis = (
        "as committed in HEAD, after committing any pending ledger changes"
        if mode == "deferred"
        else f"in the working {ledger}"
    )
    return (
        f"answers claim intent {_claim_intent_path(claim)} was written before answer "
        "effects were recorded, so no answer in it can be judged automatically; "
        f"for each answer file in {claim} compare its entry {basis} with the complete "
        "effect the answer grammar in references/findings-ledger-contract.md "
        "prescribes (the header transition — Status: rejected for a Sentry reject — "
        "and every evidence line: the Decision made bullet, plus Approved: or Why "
        "rejected: for a Sentry answer): delete the file only if the entry holds that "
        "complete effect exactly once; move it back to "
        f"{answers} only if the entry holds none of it (still parked on its blocker, "
        "no copy of any evidence line); repair every other state by hand first; every "
        "id in the intent's ids must be accounted for — an id with no answer file in "
        f"{claim} needs its answer restored or its entry resolved by hand; only then "
        f"remove {claim}"
    )


def _reconcile_answers_claim(
    claim: Path,
    answers: Path,
    ledger: Path,
    decisions: Path,
    mode: str,
) -> Reconciliation:
    """Classify a prepared answers claim by its recorded effect."""
    intent = _read_claim_intent(claim)
    if intent is None:
        return Reconciliation([], {}, set(), False)
    if intent.files is None:
        raise LedgerError(_answers_legacy_intent_message(claim, answers, ledger, mode))
    _quarantine_claim_files(claim, answers, intent)
    records = {
        name: (claim / name, value)
        for name, value in intent.files.items()
        if name not in intent.quarantined
    }
    working_text = ledger.read_text(encoding="utf-8")

    def missing(path: Path, name: str) -> str:
        if (answers / name).exists():
            return (
                f"recorded answer {name} is missing from {claim} but present in "
                f"{answers}: a replay was interrupted — move the remaining files of "
                f"{claim} back to {answers}, remove {claim}, then re-run apply-answers"
            )
        return (
            f"recorded answer {name} is missing from {claim}; restore it from "
            f"{answers} history or inspect {ledger} by hand"
        )

    if mode != "deferred":
        claimed_by_name = {path.name: path for path in intent.claimed}
        for name, (path, _record) in records.items():
            if path not in intent.claimed:
                raise LedgerError(missing(path, name))

        states: dict[str, str] = {}
        for name, (_path, record) in records.items():
            state = _answer_effect_state(working_text, record)
            states[name] = state
            if state not in {"complete", "untouched"}:
                identifier = cast(str, record["id"])
                raise LedgerError(
                    f"answer {name} for {identifier} is {state} in the working "
                    "ledger; the claim is kept — inspect the entry and the answer "
                    "by hand"
                )

        every_claimed_recorded = all(
            name in records for name in claimed_by_name
        )
        if every_claimed_recorded and all(
            state == "complete" for state in states.values()
        ):
            for path in intent.claimed:
                path.unlink(missing_ok=True)
            release_spool(claim, answers, [], publish_locked=True)
            return Reconciliation([], {}, set(), not claim.exists())
        return Reconciliation([], {}, set(), False, replay=True)

    def classify(record_object: object, head_text: str | None, working: str) -> str:
        record = cast(dict[str, object], record_object)
        identifier = cast(str, record["id"])
        if head_text is not None:
            head_state = _answer_effect_state(head_text, record)
            if head_state == "complete":
                return "present"
            if head_state != "untouched":
                raise LedgerError(
                    f"answer {next(name for name, value in records.items() if value[1] is record)} "
                    f"for {identifier} is {head_state} in HEAD; the claim is kept — "
                    "inspect the entry and the answer by hand"
                )
        working_state = _answer_effect_state(working, record)
        if working_state == "complete":
            return "waiting" if head_text is not None else "present"
        if working_state == "untouched":
            return "absent"
        name = next(name for name, value in records.items() if value[1] is record)
        raise LedgerError(
            f"answer {name} for {identifier} is {working_state} in the working ledger; "
            "the claim is kept — inspect the entry and the answer by hand"
        )

    def waiting(_path: Path, _name: str) -> str:
        return (
            f"an applied answer batch in {claim} is not durable yet (the answers are "
            f"in the working ledger but not in HEAD); commit it first: git commit -- "
            f"{ledger}"
        )

    def run(snapshot: HeadSnapshot | None) -> Reconciliation:
        return _reconcile_prepared_claim(
            claim,
            answers,
            snapshot,
            working_text,
            records=records,
            classify=classify,
            finish_present=lambda _keys: None,
            waiting_message=waiting,
            missing_message=missing,
        )

    if mode == "deferred":
        with _head_ledger_snapshot(ledger, decisions) as snapshot:
            if snapshot.findings_text is None:
                raise LedgerError(f"{ledger} is not in HEAD; commit it first")
            if not snapshot.valid:
                raise LedgerError(
                    f"HEAD does not validate: {snapshot.detail}; repair and commit the "
                    "ledgers first"
                )
            return run(snapshot)
    return run(None)


def _finalize_inbox_claim_locked(
    claim: Path,
    inbox: Path,
    ledger: Path,
    decisions: Path,
    mode: str,
) -> str:
    if mode == "deferred":
        _require_deferred_ledger_tracked(ledger)
    intent = _read_claim_intent(claim, strict=mode == "deferred")
    if intent is None:
        if claim.exists():
            raise LedgerError(
                f"claim {claim} has no durable intent; remove it by hand before "
                "finalizing"
            )
        return "none"
    if intent.phase == "claimed":
        return "replay"
    if mode == "deferred":
        reconciliation = _reconcile_inbox_claim(claim, inbox, ledger, decisions)
        if reconciliation.released:
            return "finalized"
        if not reconciliation.absent and not list(claim.glob("*.md")):
            return "cleanup-failed"
        return "replay"

    try:
        ledger_text = ledger.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise LedgerError(f"could not read ledger {ledger} while finalising {claim}: {exc}") from exc
    if not intent.ids or not all(identifier in header_ids(ledger_text) for identifier in intent.ids):
        return "replay"
    _complete_claim(
        claim,
        inbox,
        list(intent.claimed),
        intent.receipt_ids if intent.has_receipt_ids else None,
        intent.ids,
        publish_locked=True,
    )
    if claim.exists():
        return "cleanup-failed"
    return "finalized"


def _finalize_answers_claim_locked(
    claim: Path,
    answers: Path,
    ledger: Path,
    decisions: Path,
    mode: str,
) -> str:
    if mode == "deferred":
        _require_deferred_ledger_tracked(ledger)
    intent = _read_claim_intent(claim, strict=mode == "deferred")
    if intent is None:
        if claim.exists():
            raise LedgerError(
                f"claim {claim} has no durable intent; remove it by hand before "
                "finalizing"
            )
        return "none"
    if intent.phase == "claimed":
        return "replay"
    reconciliation = _reconcile_answers_claim(
        claim, answers, ledger, decisions, mode
    )
    if reconciliation.released:
        return "finalized"
    if reconciliation.replay:
        return "replay"
    if not reconciliation.absent and not list(claim.glob("*.md")):
        return "cleanup-failed"
    return "replay"


def _finalize_claim(
    claim: Path,
    spool: Path,
    ledger: Path,
    decisions: Path,
    mode: str,
    locked_finalizer: Callable[[Path, Path, Path, Path, str], str],
) -> str:
    """Finalise one claim while holding the canonical ledger/publish lock order."""
    lock = ledger_lock_path(ledger)
    try:
        acquired, waited_seconds = acquire_ledger_lock(lock)
    except (LedgerError, OSError) as exc:
        return f"busy: {exc}"
    if not acquired:
        return f"busy: ledger lock {lock} remained busy after {waited_seconds:.2f}s"
    try:
        with _publish_lock(publish_lock_path(spool)):
            return locked_finalizer(claim, spool, ledger, decisions, mode)
    finally:
        release_ledger_lock(lock)


def _finalize_answers_claim(
    claim: Path, answers: Path, ledger: Path, decisions: Path, mode: str
) -> str:
    """Finalise an answers claim while holding the canonical lock order."""
    return _finalize_claim(
        claim,
        answers,
        ledger,
        decisions,
        mode,
        _finalize_answers_claim_locked,
    )


def _finalize_inbox_claim(
    claim: Path, inbox: Path, ledger: Path, decisions: Path, mode: str
) -> str:
    """Finalise a durable claim while holding the merge lock order."""
    return _finalize_claim(
        claim,
        inbox,
        ledger,
        decisions,
        mode,
        _finalize_inbox_claim_locked,
    )


def cmd_finalize_claims(args: argparse.Namespace) -> int:
    """Release only claims whose entries are proven in HEAD."""
    decisions = _args_decisions(args)
    inbox_claim = args.inbox.with_name(f"{args.inbox.name}.claim")
    answers_claim = args.answers.with_name(f"{args.answers.name}.claim")
    try:
        mode = _claim_finalisation_mode(args.ledger, merge_without_intent=False)
        if mode == "deferred":
            _deferred_preconditions(args.ledger, decisions)
    except LedgerError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1

    lock = ledger_lock_path(args.ledger)
    try:
        acquired, waited_seconds = acquire_ledger_lock(lock)
    except (LedgerError, OSError) as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1
    if not acquired:
        return _report_ledger_lock_busy(lock, waited_seconds)
    outcomes: list[tuple[Path, str | None]] = []
    try:
        if mode == "immediate":
            try:
                original = args.ledger.read_text(encoding="utf-8")
                issues = _validate_text(original, args.ledger)
            except (OSError, UnicodeError) as exc:
                print(
                    f"FAIL could not read ledger {args.ledger}: {exc}",
                    file=sys.stderr,
                )
                return 1
            if issues:
                print(
                    f"FAIL the working ledger does not validate: {'; '.join(issues)}",
                    file=sys.stderr,
                )
                return 1
        for claim, spool, finalizer in (
            (
                inbox_claim,
                args.inbox,
                _finalize_inbox_claim_locked,
            ),
            (
                answers_claim,
                args.answers,
                _finalize_answers_claim_locked,
            ),
        ):
            try:
                with _publish_lock(publish_lock_path(spool)):
                    outcome = finalizer(
                        claim, spool, args.ledger, decisions, mode
                    )
            except (LedgerError, OSError, UnicodeError) as exc:
                print(f"FAIL {claim}: {exc}", file=sys.stderr)
                outcomes.append((claim, None))
                continue
            outcomes.append((claim, outcome))
    finally:
        release_ledger_lock(lock)

    return_code = 0
    for claim, outcome in outcomes:
        if outcome is None:
            return_code = 1
        elif outcome == "none":
            print(f"none {claim}")
        elif outcome == "finalized":
            print(f"finalized {claim}")
        elif outcome == "cleanup-failed":
            print(f"cleanup failed {claim}: remove it by hand")
            return_code = 1
        else:
            next_command = "apply-answers" if claim == answers_claim else "merge"
            print(f"will be replayed by the next {next_command} {claim}")
            return_code = 1
    return return_code


def merge_inbox(
    inbox: Path, ledger: Path, *, decisions: Path | None = None
) -> MergeResult:
    """Run one ledger-locked merge with one nested publication fence."""
    decisions = decisions or ledger.parent / "decisions.md"
    try:
        # First, before the deferred preconditions: those settle pending ledger
        # dirt by committing it, and dirt in an export is a regeneration.
        _refuse_controller_export_at(ledger, "merge-inbox")
        mode = _claim_finalisation_mode(
            ledger, merge_without_intent=_ACTIVE_LEDGER_COMMIT is None
        )
        if mode == "deferred":
            _deferred_preconditions(ledger, decisions)
            intent = _ACTIVE_LEDGER_COMMIT
            if intent is not None and os.environ.get(LEDGER_COMMIT_ENV) != "0":
                _settle_pending_ledger_dirt(intent)
    except LedgerError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return MergeResult(1)

    lock = ledger_lock_path(ledger)
    try:
        acquired, waited_seconds = acquire_ledger_lock(lock)
    except (LedgerError, OSError) as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return MergeResult(1)
    if not acquired:
        return MergeResult(_report_ledger_lock_busy(lock, waited_seconds))

    try:
        # Read under the lock, before anything is claimed, so a refusal leaves
        # the spool untouched. The merge re-checks the text it actually appends
        # to, because the Controller regenerates without taking this lock.
        _refuse_controller_export_at(ledger, "merge-inbox")
    except LedgerError as exc:
        release_ledger_lock(lock)
        print(f"FAIL {exc}", file=sys.stderr)
        return MergeResult(1)
    try:
        with _publish_lock(publish_lock_path(inbox)):
            try:
                return _merge_inbox_publish_locked(
                    inbox, ledger, decisions=decisions, mode=mode
                )
            except LedgerError as exc:
                print(f"FAIL {exc}", file=sys.stderr)
                return MergeResult(1)
    finally:
        release_ledger_lock(lock)


def _note_folded_legacy(legacy: Path, claimed: bool) -> None:
    if claimed:
        print(f"NOTE folded legacy findings inbox {legacy}", file=sys.stderr)


def _refuse_entryless_filings(inbox: Path, legacy: Path) -> None:
    """Refuse the merge while a published filing carries no entry.

    Such a filing gets no receipt record, so releasing its batch would delete it
    while its receipt still reads ``published``. Checked before the claim, under
    the publish lock every writer takes, so the refusal leaves the inbox as it
    was. An empty legacy single-file inbox has no receipt and is removed.
    """
    try:
        if legacy.exists() and not legacy.read_text(encoding="utf-8").strip():
            legacy.unlink()
    except (OSError, UnicodeError) as exc:
        raise LedgerError(f"could not read legacy inbox {legacy}: {exc}") from exc
    filings = sorted(inbox.glob("*.md"))
    if legacy.exists():
        filings.append(legacy)
    entryless: list[str] = []
    for path in filings:
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            continue
        except (OSError, UnicodeError) as exc:
            raise LedgerError(f"could not read filing {path}: {exc}") from exc
        if not _unfenced_header_matches(text)[1]:
            entryless.append(str(path))
    if entryless:
        raise LedgerError(
            f"published filings with no findings: {', '.join(entryless)}. The "
            "inbox and receipts are unchanged; correct or remove each filing "
            "and its receipt by hand, then merge again"
        )


def _merge_inbox_publish_locked(
    inbox: Path,
    ledger: Path,
    *,
    decisions: Path | None = None,
    mode: str | None = None,
) -> MergeResult:
    """Fold anything filed in the inbox into the ledger.

    **Each entry is published under a receipt and claimed before it is read.** A
    writer records a receipt naming its intended file, completes a ``.md.part``,
    then hard-links the part to that name with ``os.link``; the merger claims only
    files whose
    receipt says ``published``, one by one. The rename this once used is NOT the
    publication mechanism and has not been since the receipt protocol landed —
    the part's own name is removed only after the receipt is promoted. Reading a
    shared file and truncating afterwards — the obvious implementation, and the
    one this replaced — lets two filing sessions overwrite each other. Claiming
    an unpublished file would instead commit a valid-looking partial prefix while
    the writer's remaining lines disappear into an unlinked inode.

    **A refused batch is never destroyed.** A published filing with no entry is
    refused before anything is claimed, so it stays in the inbox; every later
    refusal leaves the batch in the fixed claim directory, whose path the error
    names. The directory records durable ownership of that
    batch; the ledger flock excludes concurrent ledger writers, while atomic
    ``mkdir`` prevents two consumers from claiming the same published files.

    Validation reuses the normal validator on a merged candidate rather than a
    second parser that could drift from the one deciding what gets worked on.
    """
    decisions = decisions or ledger.parent / "decisions.md"
    if mode is None:
        mode = _claim_finalisation_mode(
            ledger, merge_without_intent=_ACTIVE_LEDGER_COMMIT is None
        )
        if mode == "deferred":
            _deferred_preconditions(ledger, decisions)
    legacy = inbox.with_suffix(".md")
    claim = inbox.with_name(f"{inbox.name}.claim")

    _sweep_scratch(ledger.parent, lambda target: target == ledger.name)
    _sweep_scratch(
        inbox, lambda target: _GENERATED_INBOX_PART_RE.fullmatch(target) is not None
    )
    reconciliation: Reconciliation | None = None
    if mode == "deferred":
        existing = _read_claim_intent(claim)
        if existing is not None and existing.phase == "prepared":
            reconciliation = _reconcile_inbox_claim(claim, inbox, ledger, decisions)
        elif existing is not None:
            _recover_claim(claim, inbox, ledger, publish_locked=True)
    else:
        _recover_claim(claim, inbox, ledger, publish_locked=True)
    try:
        receipt_index = _receipt_index(inbox, _merge_receipt_digests(inbox, legacy))
    except LedgerError as exc:
        orphan_context = next(iter(inbox.glob(".*.part")), None)
        suffix = (
            f" while checking orphan {orphan_context}"
            if orphan_context is not None
            else ""
        )
        print(f"FAIL {exc}{suffix}", file=sys.stderr)
        return MergeResult(1)
    if not _adopt_orphan_parts(inbox, receipt_index):
        print(
            f"FAIL could not adopt every orphan in {inbox}; the merge "
            "is incomplete and the orphan files were preserved.",
            file=sys.stderr,
        )
        return MergeResult(1)
    _refuse_entryless_filings(inbox, legacy)
    if reconciliation is not None and claim.exists():
        adopted = list(reconciliation.absent)
        newly_claimed = claim_spool(
            inbox, claim, legacy=legacy, into_existing=True
        )
        if newly_claimed is None:
            return MergeResult(
                _report_refused_claim(
                    claim, batch="", action="merging", stranded="a filed finding"
                )
            )
        claimed = adopted + newly_claimed
        adopted_paths = set(adopted)
    else:
        claimed = claim_spool(inbox, claim, legacy=legacy)
        adopted_paths = set()
    if claimed is None:
        return MergeResult(
            _report_refused_claim(
                claim, batch="", action="merging", stranded="a filed finding"
            )
        )
    if not claimed:
        return MergeResult(0)

    # The legacy single-file inbox is claimed by name like any other member, so
    # its presence is read back from the claim rather than tracked separately.
    # Reported only on success, never before a refusal could keep it claimed.
    legacy_claimed = (claim / legacy.name).exists()

    try:
        ledger_text = ledger.read_text(encoding="utf-8")
        _refuse_controller_export(ledger, ledger_text, "merge-inbox")
        sources = _merge_sources(claimed, ledger)
        raw_sources = [
            claimed_path.read_text(encoding="utf-8") for claimed_path in claimed
        ]
        if adopted_paths:
            sources = [
                _reset_nonfixed_ids(text, reconciliation.fixed)
                if path in adopted_paths
                else text
                for path, text in zip(claimed, sources, strict=True)
            ]
    except (OSError, UnicodeDecodeError, LedgerError) as exc:
        # Admission failures are about the filed source's status, so leave the
        # published file in the inbox for correction/retry. Other parse and
        # candidate failures retain the prepared claim for crash recovery.
        if "new Sentry-origin entries must be filed open" in str(exc):
            try:
                inbox.mkdir(parents=True, exist_ok=True)
                for claimed_path in claimed:
                    _return_claimed_file(claimed_path, inbox, legacy)
                _remove_claim_intent(claim)
                claim.rmdir()
            except (OSError, LedgerError) as restore_exc:
                print(
                    f"FAIL could not restore refused filing claim {claim}: {restore_exc}",
                    file=sys.stderr,
                )
        print(
            f"FAIL could not read {claim} while merging: {exc}. The ledger is "
            f"unchanged and the batch is preserved at {claim}.",
            file=sys.stderr,
        )
        return MergeResult(1)
    # Seeded from the whole batch before a single id is handed out, not just
    # from the ledger: a file that picked its own id is still a claim on that
    # number, and allocating it a second time is the very collision the
    # PENDING form exists to remove.
    taken = header_ids(ledger_text)
    for text in sources:
        taken |= header_ids(text)

    assigned: list[str] = []
    assigned_by_file: dict[Path, list[str]] = {}
    parts: list[str] = []
    try:
        for path, text in zip(claimed, sources, strict=True):
            # The filing date is resolved only when there is actually an id to
            # mint. A file that already carries its id needs no date, and
            # refusing it over its NAME would reject a batch this command has
            # no quarrel with.
            published_path = inbox / path.name
            _lines, _headers, _orphans = _unfenced_header_matches(text)
            if not any(
                match.group("id") == PENDING_ID
                for _heading_idx, _header_idx, match in _headers
            ):
                parts.append(text)
                assigned_by_file[published_path] = []
                continue
            rewritten, minted = assign_pending_ids(
                text, _spool_file_date(path, legacy), taken
            )
            parts.append(rewritten)
            assigned += minted
            assigned_by_file[published_path] = minted
    except LedgerError as exc:
        print(
            f"FAIL {exc}. The ledger is unchanged and the batch is preserved "
            f"at {claim}.",
            file=sys.stderr,
        )
        return MergeResult(1)
    body = "\n\n".join(parts).strip()
    if not body:
        # Unreachable while _refuse_entryless_filings holds; never release here.
        raise LedgerError(
            f"{claim} contains no findings; its published filings and receipts "
            "are preserved for inspection"
        )

    # **Persist the allocation into the spool files before anything else.**
    # An id is handed out here and nowhere else, so it has to survive every
    # later step failing. Two of them can:
    #   * a refusal below leaves the batch in the claim to be corrected and
    #     replayed — and a replay that re-mints would give the same finding a
    #     different id each attempt;
    #   * the ledger write and the spool release are two filesystem steps, and
    #     a crash between them leaves the findings merged but still claimed.
    #     Replaying `f-PENDING` would then append every one of them a SECOND
    #     time, silently, because a fresh id is not a duplicate.
    # With the ids on disk, both replays re-propose the same ids and hit the
    # duplicate check — a loud, inspectable stop instead of a quiet double
    # entry.
    receipt_records: list[tuple[str, str, str]] = []
    receipt_ids: dict[str, dict[str, str]] = {}
    allocated_receipt_names: set[str] = set()
    for path, raw, rewritten in zip(claimed, raw_sources, parts, strict=True):
        rewritten_headers = _unfenced_header_matches(rewritten)[1]
        raw_entries = _receipt_entry_texts(raw)
        entry_records = [
            (entry_text, rewritten_headers[index][2].group("id"))
            for index, entry_text in enumerate(raw_entries)
        ]
        for entry_index, (entry_text, identifier) in enumerate(entry_records):
            filing_key = (
                path.name if len(entry_records) == 1 else f"{path.name}#{entry_index}"
            )
            reused_receipt = (
                reconciliation.receipt_names.get(filing_key)
                if reconciliation is not None
                else None
            )
            receipt_path = (
                receipt_directory(inbox) / reused_receipt
                if reused_receipt is not None
                else _allocate_receipt_path(
                    inbox,
                    receipt_index,
                    entry_text,
                    path.name,
                    identifier,
                    allocated_receipt_names,
                )
            )
            if receipt_path.name in allocated_receipt_names:
                raise LedgerError(
                    f"duplicate receipt name {receipt_path.name} was allocated "
                    "to more than one claimed entry"
                )
            allocated_receipt_names.add(receipt_path.name)
            receipt = {
                "id": identifier,
                "published": path.name,
                "receipt": receipt_path.name,
            }
            receipt_ids[filing_key] = receipt
            receipt_records.append((receipt_path.name, path.name, identifier))

    section = f"\n\n---\n\n## {datetime.now().astimezone():%Y-%m-%d} — filed through the inbox spool\n\n"
    candidate = ledger_text.rstrip() + section + body + "\n"

    try:
        fixed = None
        if mode == "deferred":
            fixed = set(reconciliation.fixed if reconciliation is not None else ())
            for path, raw in zip(claimed, raw_sources, strict=True):
                if path not in adopted_paths:
                    fixed.update(header_ids(raw))
        _write_claim_intent(
            claim,
            "prepared",
            header_ids(body),
            receipt_ids,
            fixed=fixed,
        )
    except (LedgerError, OSError) as exc:
        print(
            f"FAIL {exc}. The ledger is unchanged and the batch is preserved "
            f"at {claim}.",
            file=sys.stderr,
        )
        return MergeResult(1)
    if assigned:
        try:
            for path, rewritten in zip(claimed, parts, strict=True):
                _atomic_write(path, rewritten + "\n", durable_directory=True)
        except (LedgerError, OSError) as exc:
            print(
                f"FAIL {exc}. The ledger is unchanged and the batch is preserved "
                f"at {claim}.",
                file=sys.stderr,
            )
            return MergeResult(1)

    issues = _validate_text(candidate, ledger)
    if not issues and mode == "deferred":
        valid_pair, pair_detail = _validate_candidate_pair(
            candidate, ledger, decisions
        )
        if not valid_pair:
            issues.append(f"merged candidate does not validate: {pair_detail}")
    if issues:
        for issue in issues:
            print(f"FAIL {issue}", file=sys.stderr)
        print(
            "\nrefusing to merge: the result would not validate. The ledger is "
            f"unchanged and the batch is preserved at {claim}. Fix it there.",
            file=sys.stderr,
        )
        return MergeResult(1)

    # Count what the PARSER found, never `body.count(ENTRY_MARKER)`. That
    # substring also matches a `### ` inside a fenced example, so a spool file
    # holding nothing but a quoted entry used to be appended to the ledger and
    # reported as a merged finding — a success message for zero work.
    merged = len(header_ids(body))
    if not merged:
        print(
            f"FAIL {inbox} had content but no finding the parser could read, so "
            f"nothing could be merged. It is preserved at {claim}. A '### ' or a "
            "header line inside a fence is an example, not an entry.",
            file=sys.stderr,
        )
        return MergeResult(1)

    merged_ids = sorted(header_ids(body))
    candidate_findings = _parse_text(candidate, ledger)[0]
    expected_entries = [
        _finding_expectation(finding)
        for finding in candidate_findings
        if finding.id in merged_ids
    ]
    command = (
        _ACTIVE_LEDGER_COMMIT.command
        if _ACTIVE_LEDGER_COMMIT is not None
        else "merge-inbox"
    )
    _register_ledger_commit(
        f"docs(findings): {command} {' '.join(merged_ids)}",
        merged_ids,
        _finding_entries_postcondition(expected_entries),
    )

    try:
        _write_if_unchanged(ledger, ledger_text, candidate, durable_directory=True)
    except (LedgerError, OSError) as exc:
        print(
            f"FAIL {exc}. The ledger may already have changed and the batch is "
            f"preserved at {claim}.",
            file=sys.stderr,
        )
        return MergeResult(1)

    if mode == "deferred":
        active = _ACTIVE_LEDGER_COMMIT
        if active is not None:
            active.claim = claim
            active.finalize = lambda: _finalize_inbox_claim(
                claim, inbox, ledger, decisions, "deferred"
            )
            active.provisional = tuple(assigned)
        _note_folded_legacy(legacy, legacy_claimed)
        allocation = f": {' '.join(assigned)}" if assigned else ""
        print(f"merged {merged} finding(s) from the inbox{allocation}")
        return MergeResult(0, assigned_by_file)

    # Receipt finalisation and claim release are one publish transaction. A
    # concurrent `cmd_file` takes this same lock; without it, it can publish
    # after the receipt is written and then rewrite `merged` back to
    # `published` while the claim is still being released.
    _write_merged_receipts(inbox, receipt_records)
    release_spool(claim, inbox, claimed, publish_locked=True)
    _note_folded_legacy(legacy, legacy_claimed)
    # Name the allocated ids: a drain-owned filing session cannot learn them,
    # so the merge output is the place that mapping is recorded.
    allocation = f": {' '.join(assigned)}" if assigned else ""
    print(f"merged {merged} finding(s) from the inbox{allocation}")
    return MergeResult(0, assigned_by_file)


def _args_decisions(args: argparse.Namespace) -> Path:
    """Return the decisions ledger a command names, defaulting beside the findings ledger.

    Direct in-process callers pass namespaces without ``decisions``; the parser always sets it.
    """
    decisions = getattr(args, "decisions", None)
    return decisions if decisions is not None else args.ledger.parent / "decisions.md"


def cmd_merge_inbox(args: argparse.Namespace) -> int:
    """CLI entry point over the shared inbox merge implementation."""
    return merge_inbox(args.inbox, args.ledger, decisions=_args_decisions(args)).returncode


def _drain_lock_marker_reason(contents: bytes) -> str | None:
    """Classify the diagnostic marker stored in a free consumer lock."""
    marker = contents.decode("utf-8").strip()
    if not marker or marker == DRAIN_LOCK_RELEASED_MARKER:
        return None
    if marker.isdecimal():
        return f"no process holds it; the last owner recorded pid {marker}"
    return f"no process holds it and its contents are not a pid: {marker!r}"


def _drain_lock_state(lock: Path) -> tuple[bool, str | None, bool]:
    """Return kernel ownership, a leftover marker reason, and read uncertainty.

    The consumer lock is a shared flock owned by ``drain-findings.sh``. The
    recorded PID is diagnostic only: this reader never asks the kernel whether
    that process is alive. A decimal marker is therefore stale when the flock
    is free, while ``released`` and an empty marker are ordinary free states.
    The third position distinguishes a free lock whose contents could not be
    read from a confidently free lock; callers must not turn the former into a
    stale-lock claim.

    This deliberately fail-open diagnostic is the contract recorded by
    ``f-20260822-17`` and the supersession of ``d-20260819-04``: a filer may
    proceed after an unreadable diagnostic, but it must say that the lock could
    not be read.
    """
    try:
        fd = os.open(lock, os.O_RDONLY)
    except FileNotFoundError:
        return False, None, False
    except (OSError, UnicodeError) as exc:
        return False, f"could not read {lock}: {exc}", True

    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
        except OSError as exc:
            if exc.errno in (errno.EWOULDBLOCK, errno.EAGAIN):
                return True, None, False
            return False, f"could not read {lock}: {exc}", True

        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        except OSError as exc:
            return False, f"could not read {lock}: {exc}", True

        try:
            os.lseek(fd, 0, os.SEEK_SET)
            reason = _drain_lock_marker_reason(os.read(fd, DRAIN_LOCK_READ_BYTES))
        except (OSError, UnicodeError) as exc:
            return False, f"could not read {lock}: {exc}", True
    finally:
        with suppress(OSError):
            os.close(fd)

    return False, reason, False


def _try_consumer_lock() -> tuple[int | None, Path, str | None]:
    """Take the drain's shared consumer lock without waiting.

    The returned descriptor is kept by ``main`` until the exact ledger commit
    helper has finished. A busy drain is a normal retryable outcome; path and
    filesystem failures are reported separately so callers do not mistake a
    broken lock path for a live drain.
    """
    lock = drain_lock_path()
    try:
        fd = os.open(lock, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o644)
    except OSError as exc:
        return None, lock, f"could not open consumer lock {lock}: {exc}"
    try:
        fcntl.flock(fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
    except OSError as exc:
        with suppress(OSError):
            os.close(fd)
        if exc.errno in (errno.EWOULDBLOCK, errno.EAGAIN):
            return None, lock, None
        return None, lock, f"could not acquire consumer lock {lock}: {exc}"
    return fd, lock, None


def _release_consumer_lock(args: argparse.Namespace) -> None:
    fd = getattr(args, "_consumer_lock_fd", None)
    if fd is None:
        return
    with suppress(OSError):
        fcntl.flock(fd, fcntl.LOCK_UN)
    with suppress(OSError):
        os.close(fd)
    args._consumer_lock_fd = None


def cmd_file_status(args: argparse.Namespace) -> int:
    """Read the content-derived filing receipt without taking any lock."""
    try:
        _refuse_controller_export_at(args.ledger, "file --status")
    except LedgerError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1
    entry, issues = _read_and_validate_entry(args.entry, args.ledger)
    if issues:
        for issue in issues:
            print(f"FAIL {issue}", file=sys.stderr)
        return 1
    assert entry is not None
    receipt_path = _receipt_path(args.inbox, entry)
    receipt = _read_receipt(receipt_path)
    if receipt is None:
        print("none")
        return 0

    state = receipt["state"]
    if state == "publishing":
        published = args.inbox / receipt["published"]
        try:
            actual_digest = _sha256_bytes(published.read_bytes())
        except FileNotFoundError:
            print("none")
            return 0
        except OSError as exc:
            raise LedgerError(
                f"could not verify publishing receipt {receipt_path}: {exc}"
            ) from exc
        expected_digest = _sha256_text(entry)
        if actual_digest != expected_digest:
            raise LedgerError(
                f"publishing receipt {receipt_path} names {published}, "
                "but the linked inbox bytes do not match the entry digest"
            )
        print("published")
        return 0

    print(state)
    return 0


def cmd_file(args: argparse.Namespace) -> int:
    """Publish one pending finding, then merge it when no live drain owns the ledger."""
    try:
        _refuse_controller_export_at(args.ledger, "file")
    except LedgerError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1
    entry, issues = _read_and_validate_entry(args.entry, args.ledger)
    if issues:
        for issue in issues:
            print(f"FAIL {issue}", file=sys.stderr)
        return 1
    assert entry is not None

    inbox: Path = args.inbox
    deferred_preflight = False
    if not bool(getattr(args, "spool_only", False)):
        drain_held, _reason, _unreadable = _drain_lock_state(drain_lock_path())
        if not drain_held:
            decisions = _args_decisions(args)
            mode = _claim_finalisation_mode(
                args.ledger, merge_without_intent=_ACTIVE_LEDGER_COMMIT is None
            )
            if mode == "deferred":
                _deferred_preconditions(args.ledger, decisions)
                deferred_preflight = True
    if deferred_preflight:
        citation_issues = _candidate_citation_issues(
            args.ledger.read_text(encoding="utf-8").rstrip()
            + "\n\n"
            + entry
            + "\n",
            args.ledger,
            decisions,
        )
        if citation_issues:
            print(
                f"FAIL {args.entry} does not validate with {decisions}: "
                + "; ".join(citation_issues),
                file=sys.stderr,
            )
            return 1
    receipt_path = _receipt_path(inbox, entry)
    claim = inbox.with_name(f"{inbox.name}.claim")
    again = bool(getattr(args, "again", False))
    published_name: str | None = None
    # Published with `os.link`, which REFUSES to overwrite, rather than
    # `os.replace`, which does so silently. A review run deferring several
    # findings in a loop is one process publishing repeatedly, and the original
    # `<stamp>-<pid>` name collided within a second: the second filing destroyed
    # the first while both were reported as landed. The suffix makes that
    # practically impossible and the link makes it impossible -- a clock that
    # repeats or steps backwards costs a retry here instead of an entry.
    with _publish_lock(publish_lock_path(inbox)):
        if again:
            filing_token = _unique_suffix()
            published_name = f"{_publish_stamp()}-{_unique_suffix()}.md"
            receipt_path = _receipt_path(inbox, entry, filing_token=filing_token)
            receipt = None
        else:
            try:
                receipt = _read_receipt(receipt_path)
            except LedgerError as exc:
                print(
                    f"FAIL {exc}. Use --again to file deliberately.",
                    file=sys.stderr,
                )
                return 1

        if receipt is not None and receipt["state"] == "merged":
            print(
                f"FAIL this entry was already filed as {receipt['id']} according to "
                f"{receipt_path}. Use --again to file it deliberately.",
                file=sys.stderr,
            )
            return 1

        new_receipt = receipt is None
        if receipt is None:
            if published_name is None:
                published_name = f"{_publish_stamp()}-{_unique_suffix()}.md"
            receipt = {"state": "publishing", "published": published_name}
        else:
            published_name = receipt["published"]

        assert published_name is not None

        published = inbox / published_name
        claimed = claim / published_name
        in_inbox = published.exists()
        in_claim = claimed.exists()
        if not new_receipt and in_inbox and in_claim:
            print(
                f"FAIL filing receipt {receipt_path} names {published_name}, which "
                "exists in both the inbox and claim. Use --again to file "
                "deliberately.",
                file=sys.stderr,
            )
            return 1

        state = receipt["state"]
        if not new_receipt and in_inbox:
            try:
                actual_digest = hashlib.sha256(published.read_bytes()).hexdigest()
            except OSError as exc:
                print(
                    f"FAIL could not verify published filing {published}: {exc}. "
                    "Use --again to file deliberately.",
                    file=sys.stderr,
                )
                return 1
            expected_digest = hashlib.sha256(entry.encode("utf-8")).hexdigest()
            if actual_digest != expected_digest:
                print(
                    f"FAIL filing receipt {receipt_path} names {published_name}, "
                    "but the inbox content does not match this entry. Use --again "
                    "to file deliberately.",
                    file=sys.stderr,
                )
                return 1
        if not new_receipt and state == "published" and not in_inbox and not in_claim:
            recorded_id = receipt.get("id")
            if recorded_id is None:
                detail = "the allocated id was not recorded"
            else:
                detail = f"it was filed as {recorded_id}"
            print(
                f"FAIL this entry was already filed according to {receipt_path}; "
                f"{detail}. Use --again to file it deliberately.",
                file=sys.stderr,
            )
            return 1

        needs_link = new_receipt or (
            state == "publishing" and not in_inbox and not in_claim
        )
        if needs_link:
            try:
                inbox.mkdir(parents=True, exist_ok=True)
                recorded_part = receipt.get("part")
                part = inbox / recorded_part if recorded_part is not None else None
                if part is not None and part.exists():
                    if part.read_text(encoding="utf-8") != entry:
                        raise LedgerError(
                            f"filing receipt {receipt_path} names part {part.name}, "
                            "but its content does not match this entry"
                        )
                else:
                    part = inbox / f".{_publish_stamp()}-{_unique_suffix()}.part"
                    receipt["part"] = part.name
                    _write_receipt(
                        receipt_path,
                        {
                            "state": "publishing",
                            "published": published_name,
                            "part": part.name,
                        },
                    )
                    _atomic_write(part, entry)

                def candidate_for(attempt: int) -> Path:
                    if attempt == 0:
                        # `nonlocal` in record_publishing below defeats the
                        # narrowing the assert above established, so re-state it
                        # here rather than widen the annotation.
                        assert published_name is not None
                        return inbox / published_name
                    return inbox / f"{_publish_stamp()}-{_unique_suffix()}.md"

                def record_publishing(candidate: Path) -> None:
                    nonlocal published, published_name
                    published = candidate
                    published_name = candidate.name
                    _record_publishing(receipt_path, receipt, candidate)

                linked = _link_with_retries(part, candidate_for, record_publishing)
                published = linked
                published_name = linked.name
                _fsync_directory(inbox)
                _write_receipt(
                    receipt_path,
                    _published_receipt_record(published_name, receipt),
                )
                receipt["state"] = "published"
                receipt["published"] = published_name
                part.unlink(missing_ok=True)
            except OSError as exc:
                raise LedgerError(
                    f"could not publish filing to {inbox}: {exc}"
                ) from exc
        elif state == "publishing":
            try:
                _fsync_directory(inbox)
            except OSError as exc:
                raise LedgerError(
                    f"could not make published filing {published} durable: {exc}"
                ) from exc
            _write_receipt(
                receipt_path, _published_receipt_record(published_name, receipt)
            )

    if bool(getattr(args, "spool_only", False)):
        print(f"published finding entry: {published}; entry awaits a merge")
        return 0

    lock = drain_lock_path()
    lock_fd: int | None = None
    mutex_error: OSError | None = None
    try:
        lock_fd = os.open(lock, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o644)
    except OSError as exc:
        mutex_error = exc
    else:
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
        except OSError as exc:
            with suppress(OSError):
                os.close(lock_fd)
            lock_fd = None
            if exc.errno in (errno.EWOULDBLOCK, errno.EAGAIN):
                print(f"drain owns the ledger and will merge this entry: {published}")
                return 0
            mutex_error = exc
        else:
            # This is strictly better than the old probe-then-read path: the held
            # descriptor makes the diagnostic describe the state this merge
            # actually runs in, instead of a marker already obsolete when printed.
            try:
                os.lseek(lock_fd, 0, os.SEEK_SET)
                reason = _drain_lock_marker_reason(
                    os.read(lock_fd, DRAIN_LOCK_READ_BYTES)
                )
            except (OSError, UnicodeError) as exc:
                print(f"WARNING could not read {lock}: {exc}; proceeding to merge")
            else:
                if reason is not None:
                    print(
                        f"WARNING STALE drain lock {lock}: {reason}; "
                        "proceeding to merge"
                    )

    if mutex_error is not None:
        errno_name = _errno_name(mutex_error)
        print(
            f"WARNING consumer mutex {lock} unavailable "
            f"({errno_name}: {mutex_error}); falling back to diagnostic read"
        )
        drain_held, reason, unreadable = _drain_lock_state(lock)
        if drain_held:
            print(f"drain owns the ledger and will merge this entry: {published}")
            return 0
        if reason is not None:
            if unreadable:
                # `reason` already names the path and the error. The two branches
                # stay distinguishable because only the other one says STALE: an
                # unreadable lock and a leftover pid need different remedies.
                print(f"WARNING {reason}; proceeding to merge")
            else:
                print(f"WARNING STALE drain lock {lock}: {reason}; proceeding to merge")

    try:
        result = merge_inbox(inbox, args.ledger, decisions=_args_decisions(args))
    finally:
        if lock_fd is not None:
            if bool(getattr(args, "_hold_consumer_lock", False)):
                args._consumer_lock_fd = lock_fd
            else:
                with suppress(OSError):
                    fcntl.flock(lock_fd, fcntl.LOCK_UN)
                with suppress(OSError):
                    os.close(lock_fd)
    if result.returncode != 0:
        return result.returncode

    allocated = result.assigned_by_file.get(published, [])
    if allocated:
        print(f"filed finding as {allocated[0]}")
    else:
        try:
            merged_receipt = _read_receipt(receipt_path)
        except LedgerError as exc:
            print(
                f"WARNING filing completed, but could not read its final receipt "
                f"{receipt_path}: {exc}",
                file=sys.stderr,
            )
            return 0
        if merged_receipt is not None and merged_receipt["state"] == "merged":
            print(f"filed finding as {merged_receipt['id']} (concurrent merge)")
        else:
            print(
                "entry was merged by a concurrent writer; the id could not be "
                "determined"
            )
    return 0


def _read_announcement_state(state_path: Path) -> dict[str, object] | None:
    """Read announcement state, distinguishing absent from damaged state."""
    try:
        state_mode = state_path.lstat().st_mode
        if stat.S_ISLNK(state_mode) or not stat.S_ISREG(state_mode):
            raise OSError("not a regular file")
        raw = state_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    except (OSError, UnicodeError) as exc:
        raise LedgerError(
            f"could not read announcement state {state_path}: {exc}"
        ) from exc
    try:
        state = json.loads(raw)
    except ValueError as exc:
        raise LedgerError(
            f"could not read announcement state {state_path}: {exc}"
        ) from exc
    if not isinstance(state, dict):
        raise LedgerError(
            f"could not read announcement state {state_path}: expected a JSON object"
        )
    return state


def _current_waiting_ids(ledger: Path) -> set[str]:
    """Return ids currently waiting on Felix, for announcement prune/re-read."""
    findings, _problems, _vocabulary = parse(ledger)
    buckets = summary_buckets(findings)
    return {finding.id for finding in buckets.product + buckets.preconditions}


def _persist_announcement_state(state_path: Path, announced: dict[str, object]) -> None:
    """Persist fire-once state without making notification reads fail."""
    try:
        _atomic_write(
            state_path, json.dumps(announced, indent=2, sort_keys=True) + "\n"
        )
    except OSError as exc:
        print(
            f"warning: could not record the announcement state at {state_path} "
            f"({exc}); parked blockers may re-notify.",
            file=sys.stderr,
        )


def _announce_felix_blockers_unlocked(shown_ids: set[str], ledger: Path) -> None:
    """Ping Felix for a newly parked blocker; listing the queue never toasts.

    **Deliberately not routed through the Claude notification hook.** That hook
    suppresses inside a 45-second quiet window, on the premise that a Felix who
    is at the keyboard will see the prompt in his pane. The premise does not hold
    here: a drain parks its blocker into a terminal he is not reading, and
    presence detection measures input devices, not which pane he is looking at.
    So this pings even while he is typing — which is why it is its own event
    class rather than a reuse of that policy.

    A bare ``decisions`` is how he *reads* the queue, so it only prunes cleared
    ids. The drain names the ids a cluster just parked; those are the only toast.
    ``FINDINGS_NO_NOTIFY`` still prunes — it only skips the desktop post.

    Nothing here draws a notification; ``notify`` is the shared notifier used by
    the Claude hooks and Codex alike, and it is called unchanged. Its absence — a
    different machine, another developer's checkout — silently skips the
    announcement rather than failing the query.
    """
    state_path = ledger.with_name(ANNOUNCED_STATE)
    try:
        announced = _read_announcement_state(state_path) or {}
    except LedgerError as exc:
        print(f"warning: {exc}; skipping announcement.", file=sys.stderr)
        return

    try:
        waiting_ids = _current_waiting_ids(ledger)
    except (OSError, UnicodeError, LedgerError) as exc:
        print(
            f"warning: could not read waiting blockers for announcement prune "
            f"({type(exc).__name__}: {exc}); skipping announcement.",
            file=sys.stderr,
        )
        return

    # Prune against every current Felix-facing blocker, never against the
    # subset just shown — the drain shows only the ids one cluster parked, and
    # pruning to those would forget the others and re-announce them later.
    kept = {key: value for key, value in announced.items() if key in waiting_ids}
    if kept != announced:
        _persist_announcement_state(state_path, kept)

    if os.environ.get(NOTIFY_OFF_ENV):
        return
    notifier = shutil.which(NOTIFIER)
    if notifier is None:
        return

    findings, _problems, _vocabulary = parse(ledger)
    buckets = summary_buckets(findings)
    # The announcement covers the answerable class and preconditions only.
    # Automated verification is machine work and must never enter Felix's
    # announcement state, so `buckets.answerable`'s approval half is excluded
    # here by construction: only the product half is a Felix-facing answer.
    waiting = sorted(buckets.product + buckets.preconditions, key=lambda f: f.line)
    shown = [finding for finding in waiting if finding.id in shown_ids]
    fresh = [finding for finding in shown if finding.id not in kept]
    if not fresh:
        return

    product_ids = {finding.id for finding in buckets.product}
    answerable = [finding for finding in fresh if finding.id in product_ids]
    preconditions = [finding for finding in fresh if finding.id not in product_ids]
    if len(fresh) == 1:
        detail = f"{fresh[0].id} — {fresh[0].title[:NOTIFY_TITLE_CHARS]}"
    else:
        detail = f"{len(fresh)} new Felix items: " + ", ".join(
            finding.id for finding in fresh
        )
    actions: list[str] = []
    if answerable:
        actions.append("Run /decide in a terminal to answer.")
    if preconditions:
        actions.append("Clear the listed precondition; no answer is needed.")
    # Named in every failure line: this warning is the only signal that these
    # blockers did not reach Felix, so it must say which ones and through what.
    unannounced_ids = ", ".join(sorted(finding.id for finding in fresh))
    try:
        posted = subprocess.run(
            [
                notifier,
                "show",
                "--title",
                NOTIFY_APP,
                "--text",
                f"{detail}\n" + "\n".join(actions),
                "--sound",
                "attention",
                "--duration",
                str(NOTIFY_DURATION_MS),
                "--project",
                REPO_ROOT.name if REPO_ROOT is not None else "unknown",
            ],
            check=False,
            timeout=NOTIFY_POST_TIMEOUT_S,
        ).returncode
    except (OSError, subprocess.SubprocessError) as exc:
        print(
            f"warning: notifier {notifier} failed while announcing Felix blockers "
            f"({type(exc).__name__}: {exc}); blockers remain unannounced: "
            f"{unannounced_ids}.",
            file=sys.stderr,
        )
        return
    if posted != 0:
        # Left unrecorded on purpose: a failed post (no session bus, headless)
        # should be retried on the next named look, not counted as delivered.
        print(
            f"warning: notifier {notifier} exited with status {posted}; "
            f"blockers remain unannounced: {unannounced_ids}.",
            file=sys.stderr,
        )
        return

    try:
        waiting_after = _current_waiting_ids(ledger)
    except (OSError, UnicodeError, LedgerError) as exc:
        print(
            f"warning: could not re-read waiting blockers after announcing "
            f"({type(exc).__name__}: {exc}); recording delivery anyway.",
            file=sys.stderr,
        )
        waiting_after = waiting_ids
    kept = {key: value for key, value in kept.items() if key in waiting_after}
    stamp = datetime.now().astimezone().isoformat(timespec="seconds")
    kept.update({finding.id: stamp for finding in fresh if finding.id in waiting_after})
    # Non-fatal by design -- a failed state write must never stop `decisions`
    # from answering. The helper still names the failure because otherwise the
    # missing fire-once record surfaces only as repeated notifications.
    _persist_announcement_state(state_path, kept)


def _prune_announcement_state_strict(
    ledger: Path, ids: Collection[str]
) -> None:
    """Durably invalidate stamps before a protected ledger mutation commits."""
    state_path = ledger.with_name(ANNOUNCED_STATE)
    try:
        announced = _read_announcement_state(state_path) or {}
        kept = {key: value for key, value in announced.items() if key not in ids}
        # Always replace and fsync the directory, even when the ids are already
        # absent. A previous failed directory fsync can leave the visible map
        # ahead of its durable state, so equality is not proof of durability.
        _atomic_write(
            state_path,
            json.dumps(kept, indent=2, sort_keys=True) + "\n",
            durable_directory=True,
        )
    except LedgerError:
        raise
    except OSError as exc:
        raise LedgerError(
            f"could not durably prune announcement state {state_path}: {exc}"
        ) from exc


@contextmanager
def _announcement_lock(
    ledger: Path, *, strict: bool = False
) -> Iterator[bool]:
    """Own announcement state for a reader or strict ledger mutation.

    Reader acquisition failures are diagnosed and yield ``False`` so the query
    still succeeds. Strict mutations instead raise ``LedgerError`` and never
    enter the context without the state lock.
    """
    state_lock = ledger_lock_path(ledger.with_name(ANNOUNCED_STATE))
    try:
        acquired, waited_seconds = acquire_ledger_lock(
            state_lock,
            wait_window_seconds=NOTIFY_POST_TIMEOUT_S + NOTIFY_STATE_WRITE_GRACE_S,
        )
    except (LedgerError, OSError) as exc:
        message = (
            f"LOCK ACQUISITION failed for announcement state lock {state_lock} "
            f"({type(exc).__name__}: {exc})"
        )
        if strict:
            raise LedgerError(message) from exc
        print(f"warning: {message}; skipping announcement.", file=sys.stderr)
        yield False
        return
    if not acquired:
        message = (
            f"LOCK ACQUISITION could not acquire announcement state lock {state_lock} "
            f"after {waited_seconds:.2f}s"
        )
        if strict:
            raise LedgerError(message)
        print(f"warning: {message}; skipping announcement.", file=sys.stderr)
        yield False
        return
    try:
        yield True
    finally:
        release_ledger_lock(state_lock)


def _announce_felix_blockers(shown: list[Finding], ledger: Path) -> None:
    """Announce current Felix-facing blockers while holding the state lock."""
    with _announcement_lock(ledger) as acquired:
        if acquired:
            _announce_felix_blockers_unlocked({f.id for f in shown}, ledger)


def cmd_decisions(args: argparse.Namespace) -> int:
    """Print Felix-facing blockers and automated verification.

    Optionally restricted to ``args.ids``.

    The drain prints a Felix-facing blocker once, when it parks it. A six-hour run scrolls,
    and Felix reads the chat rather than the ledger, so a one-time print is a
    notification and not a place to look things up. This is the place to look.
    """
    findings, problems, vocabulary = parse(args.ledger)
    issues = validate(findings, problems, vocabulary)
    _warn_problems(issues, "decisions")
    if issues:
        # `validate` seeds `issues` with the parse problems, so they are a subset
        # of the count, never a second set beside it. They are diagnostics, not
        # entries: one entry can yield several, and a readable one can yield some.
        parse_detail = (
            f", {len(problems)} of them from parsing" if problems else ""
        )
        print(
            f"WARNING decisions found {len(issues)} validation problem(s)"
            f"{parse_detail}. Run `findings.py check`."
        )
    buckets = summary_buckets(findings)
    waiting = list(buckets.product)
    preconditions = list(buckets.preconditions)
    verification = list(buckets.approvals)
    if args.ids:
        # The drain names the ids a cluster just parked, so a park announcement
        # shows those blockers and not the whole backlog again.
        wanted = set(args.ids)
        waiting = [f for f in waiting if f.id in wanted]
        preconditions = [f for f in preconditions if f.id in wanted]
        verification = [f for f in verification if f.id in wanted]
    if not waiting and not preconditions:
        if verification:
            # Sentry verification is machine work.  It must not touch Felix's
            # announcement state, even when the state contains stale entries
            # from an earlier product decision.
            print(
                f"{len(verification)} Sentry finding(s) awaiting automated "
                "verification — nothing for you to do."
            )
            return 0
        # The announcement read also prunes cleared ids. Run it before this
        # early return so an emptied queue can self-heal before a re-park.
        # A bare review never toasts: shown_ids is empty.
        _announce_felix_blockers([], args.ledger)
        if not issues:
            print("No decisions are waiting on you.")
        return 0

    if verification:
        print(
            f"{len(verification)} Sentry finding(s) awaiting automated "
            "verification — nothing for you to do.\n"
        )
    # `waiting` is exactly the stored product bucket, so the brief list is it.
    product = waiting
    if product:
        print(f"{len(product)} product decision(s) waiting on you.\n")
    for f in product:
        print(f"{f.id} — {f.title}")
        print(f"  area={f.area}  entry={f.entry}  ledger line {f.line}")
        # The brief runs from the **Decision:** bullet to the end of the entry;
        # that placement is the contract, so everything after it is part of it.
        brief_started = False
        for line in _unfenced_body(f).splitlines():
            if not brief_started and DECISION_BRIEF_RE.search(line):
                brief_started = True
            if brief_started:
                print(f"  {line}" if line.strip() else "")
        if not brief_started:
            print("  (no **Decision:** brief — `check` will flag this)")
        print()
    if preconditions:
        print(f"{len(preconditions)} precondition(s) waiting on you.\n")
        print("WHAT MUST BECOME TRUE")
        for f in preconditions:
            print(f"{f.id} — {f.title}")
            # The slug IS the precondition -- it is the only place the entry says
            # what must become true. Printing the title and `Where` without it
            # told Felix to "clear this precondition" while naming none of them:
            # `felix-sentry-permission` read as an unexplained instruction to go
            # fix something in a file path.
            print(f"  waits on: {f.blocked}")
            where_lines = [
                line
                for line in _unfenced_body(f).splitlines()
                if line.lstrip().startswith("* **Where:**")
            ]
            for line in where_lines:
                print(f"  {line}")
            if not where_lines:
                print("  * **Where:** (not stated)")
            print("  No answer is requested; clear this precondition.")
            print()
    if waiting:
        print(
            "To answer: run the /decide skill in any terminal, during a drain or not."
        )
    if preconditions:
        print("To clear: make the listed precondition true; no answer is needed.")
    # Named ids are the drain park path and the only toast. A bare review still
    # prunes cleared stamps so a later re-park can fire.
    if args.ids:
        _announce_felix_blockers(waiting + preconditions, args.ledger)
    else:
        _announce_felix_blockers([], args.ledger)
    return 0


def _find_entry_span(
    lines: list[str], fence_states: list[FenceState], header_index: int
) -> int:
    """Index one past the last body line of the entry whose header is at `header_index`.

    Stops at the next parser boundary or thematic break that is not inside a
    fence — a fenced snippet may legitimately contain a `### ` line — then backs
    over trailing blanks so an inserted bullet lands against the body, not after a
    gap.
    """
    end = len(lines)
    for index in range(header_index + 1, len(lines)):
        if fence_states[index] is not FenceState.OUTSIDE:
            continue
        if (
            lines[index].startswith("# ")
            or lines[index].startswith("## ")
            or lines[index].startswith(ENTRY_MARKER)
            or HRULE_RE.match(lines[index])
        ):
            end = index
            break
    while end > header_index + 1 and not lines[end - 1].strip():
        end -= 1
    return end


def _answer_target_spans(
    lines: list[str],
    fence_states: list[FenceState],
    ids: Collection[str],
) -> dict[str, tuple[int, int, re.Match[str]]]:
    """Locate answer targets with the same parser boundaries as the ledger."""
    wanted = set(ids)
    text = "\n".join(lines)
    _source, headers, _orphans = _unfenced_header_matches(text, fence_states)
    spans: dict[str, tuple[int, int, re.Match[str]]] = {}
    for _heading_index, header_index, match in headers:
        identifier = match.group("id")
        if identifier in wanted and identifier not in spans:
            spans[identifier] = (
                header_index,
                _find_entry_span(lines, fence_states, header_index),
                match,
            )
    return spans


def _decision_heading_matches(
    text: str, *, include_pending: bool = False
) -> tuple[list[str], list[tuple[int, re.Match[str]]]]:
    """Return real decision headings, optionally including pending headings."""
    lines = text.splitlines()
    mask = _fence_mask(lines)
    matches: list[tuple[int, re.Match[str]]] = []
    for index, line in enumerate(lines):
        if mask[index] is not FenceState.OUTSIDE:
            continue
        match = DECISION_RE.match(line)
        if match is None and include_pending:
            match = DECISION_PENDING_RE.match(line)
        if match is not None:
            matches.append((index, match))
    return lines, matches


def _decision_heading_locations(
    text: str, *, include_pending: bool = False
) -> tuple[list[str], list[tuple[int, int, re.Match[str]]]]:
    """Adapt decision headings to the shared pending-id allocator interface."""
    lines, matches = _decision_heading_matches(text, include_pending=include_pending)
    return lines, [(index, index, match) for index, match in matches]


def _decision_clause_one_issues(entry: str) -> list[str]:
    """Report clause-1 fields missing from decisions in one recording input."""
    lines, headings = _decision_heading_matches(entry, include_pending=True)
    fence_states = _fence_mask(lines)
    issues: list[str] = []
    for position, (heading_index, match) in enumerate(headings):
        end = headings[position + 1][0] if position + 1 < len(headings) else len(lines)
        body = chr(10).join(
            line
            for index, line in enumerate(
                lines[heading_index + 1 : end], heading_index + 1
            )
            if fence_states[index] is FenceState.OUTSIDE
        )
        missing = [
            field
            for field in DECISION_CLAUSE_ONE_FIELDS
            if DECISION_FIELD_RE[field].search(body) is None
        ]
        if missing:
            issues.append(
                f"### {match.group('id')} — {match.group('question')} is missing "
                "clause 1 field(s): " + ", ".join(missing)
            )
        # The trailer is not decoration. `set-trailer` can ADD one to an entry
        # that predates the requirement, but that is a repair for history, not a
        # licence to keep writing entries without it: the added bullet records
        # the supersession without recording who decided the entry, because that
        # is no longer recoverable at supersession time. A new record can carry
        # both, so it must. `check` does not read the trailer either, so the
        # writer is the only place this can be caught. Measured 2026-09-09:
        # d-20260909-05 and -06 were recorded without it and passed every gate.
        if SUPERSEDED_BY_RE.search(body) is None:
            issues.append(
                f"### {match.group('id')} — {match.group('question')} is missing "
                "the `* **Decided by:** <session/run> · **Superseded-by:** -` "
                "trailer; `set-trailer` would have to repair this entry later, "
                "and by then the decider is unrecoverable"
            )
        if GOVERNS_RE.search(body) is None:
            issues.append(
                f"### {match.group('id')} — {match.group('question')} is missing "
                "the `* **Governs:**` bullet; write the finding ids it governs, "
                "or `-`"
            )
    return issues


def _read_mutation_input(path: Path) -> tuple[bytes, str]:
    """Read exact input bytes and decode UTF-8 without normalising newlines."""
    try:
        raw = path.read_bytes()
        return raw, raw.decode("utf-8")
    except (OSError, UnicodeError) as exc:
        raise LedgerError(f"could not read input file {path}: {exc}") from exc


def _with_final_newline(text: str, lines: list[str]) -> str:
    """Join changed lines while preserving the original file's newline policy."""
    joined = "\n".join(lines)
    return joined + ("\n" if text.endswith("\n") else "")


def _checked_header_value(header_field: str, value: str) -> str:
    """Validate a header field before embedding it into the ledger line."""
    if header_field == "Blocked":
        if value != "none" and SLUG_RE.match(value) is None:
            raise LedgerError(f"--blocked must be 'none' or a slug, not {value!r}")
    elif header_field == "Root":
        if value != "-" and SLUG_RE.match(value) is None:
            raise LedgerError(f"--root must be '-' or a slug, not {value!r}")
    elif header_field == "Status" and value not in STATUSES:
        raise LedgerError(f"--status must be one of {sorted(STATUSES)}, not {value!r}")
    elif header_field == "Entry" and value not in ENTRIES:
        raise LedgerError(f"--entry must be one of {sorted(ENTRIES)}, not {value!r}")
    return value


def _answerable_header_change_refusal(
    findings: list[Finding],
    finding_id: str,
    *,
    blocked: str | None,
    status: str | None,
) -> str | None:
    """Refuse a set-header change that would bypass an answerable blocker."""
    target = next((finding for finding in findings if finding.id == finding_id), None)
    if target is None:
        return None
    if target.blocked in SENTRY_VERIFIER_BLOCKERS:
        if status in {"handled", "rejected"}:
            return (
                f"cannot clear verifier blocker {target.blocked} with set-header; "
                "answer it through the verifier answer route"
            )
        if blocked is not None and blocked != SENTRY_UNVERIFIED:
            return (
                f"cannot clear verifier blocker {target.blocked} with set-header; "
                "only sentry-unverified is accepted"
            )
        return None
    if blocked is not None and blocked != SENTRY_UNVERIFIED:
        # The gate exists so attacker-authored Sentry event text cannot reach
        # Felix's queue unverified.  Once the origin is approved that risk is
        # discharged, and an approved entry has to be parkable like any other --
        # otherwise its question must be split into a second entry, away from
        # the evidence the brief contract exists to keep with it.
        clearance = target.sentry_origin_clearance
        if clearance is not None:
            return (
                f"cannot set a {clearance} Sentry-origin finding to blocker "
                f"{blocked}; only {SENTRY_UNVERIFIED} is accepted"
            )
    if target.blocked not in ANSWERABLE_BLOCKERS:
        return None
    blocked_change = blocked is not None and blocked not in ANSWERABLE_BLOCKERS
    status_close = status in {"handled", "rejected"}
    if not (blocked_change or status_close):
        return None
    return (
        f"cannot clear answerable blocker {target.blocked} with set-header; "
        "answer it through /decide"
    )


def _raise_to_build_refusal(
    findings: list[Finding], finding_id: str, *, entry: str | None
) -> str | None:
    """Refuse a pickup raise to `build` on an entry that names no open question.

    The same gate as filing, at the other door. `set_header` rewrites header
    fields and cannot write a body bullet, so the working order at pickup is
    `annotate` with a note carrying the `**Open question:**` bullet, then
    `set-header --entry build`. Lowering a tier is never gated by this.
    """
    if entry != "build":
        return None
    for finding in findings:
        if finding.id != finding_id:
            continue
        if finding.entry == "build":
            return None
        if OPEN_QUESTION_RE.search(_unfenced_body(finding)):
            return None
        return (
            OPEN_QUESTION_REFUSAL.format(where=finding_id)
            + " Annotate the entry with that bullet first, then set the header."
        )
    return None


def cmd_set_header(args: argparse.Namespace) -> int:
    """Update selected fields on one real finding header under the ledger lock."""
    findings, _problems, _vocabulary = parse(args.ledger)
    refusal = _answerable_header_change_refusal(
        findings,
        args.id,
        blocked=args.blocked,
        status=args.status,
    )
    if refusal is not None:
        print(refusal, file=sys.stderr)
        return 1

    raise_refusal = _raise_to_build_refusal(findings, args.id, entry=args.entry)
    if raise_refusal is not None:
        print(raise_refusal, file=sys.stderr)
        return 1

    changes = {
        "Status": args.status,
        "Blocked": args.blocked,
        "Root": args.root,
        "Entry": args.entry,
    }
    expected_header = {
        field.lower(): value
        for field, value in changes.items()
        if value is not None
    }
    _register_ledger_commit(
        f"docs(findings): set header for {args.id}",
        [args.id],
        _finding_header_postcondition(args.id, expected_header),
    )

    def build(text: str) -> str:
        current_findings, _problems, _vocabulary = _parse_text(text, args.ledger)
        current_refusal = _answerable_header_change_refusal(
            current_findings,
            args.id,
            blocked=args.blocked,
            status=args.status,
        )
        if current_refusal is not None:
            raise LedgerError(current_refusal)
        current_raise_refusal = _raise_to_build_refusal(
            current_findings, args.id, entry=args.entry
        )
        if current_raise_refusal is not None:
            raise LedgerError(current_raise_refusal)
        lines, index = _locate_finding_header(text, args.id)
        line = lines[index]
        for header_field, value in changes.items():
            if value is None:
                continue
            checked = _checked_header_value(header_field, value)
            pattern = rf"(\*\*{header_field}:\*\* )\S+"
            match = re.search(pattern, line)
            if match is None:
                raise LedgerError(
                    f"header for {args.id} carries no {header_field} field to update"
                )
            line = (
                line[: match.start()] + match.group(1) + checked + line[match.end() :]
            )
        lines[index] = line
        return _with_final_newline(text, lines)

    dropped: set[str] = set()
    if args.status in {"handled", "rejected"}:
        dropped.add(args.id)
    if args.blocked is not None and classify_blocker(args.blocked) not in {
        BLOCKER_ANSWERABLE,
        BLOCKER_PRECONDITION,
    }:
        dropped.add(args.id)
    _locked_ledger_mutation(args.ledger, build, dropped or None)
    if args.status in {"handled", "rejected"}:
        append_drain_breadcrumb(f"step 10 finding closed {args.id}", args.status)
    print(f"updated header for {args.id}")
    return 0


def _annotation_refusal(annotation: str, target: Finding, source: Path) -> str | None:
    """Describe an unfenced annotation line that must not enter the ledger."""
    lines = annotation.splitlines()
    fence_states = _fence_mask(lines)
    target_is_sentry = _body_is_sentry_origin(
        _unfenced_body(target)
    ) or _body_is_sentry_origin(_unfenced_text(annotation))

    for line, fence_state in zip(lines, fence_states, strict=True):
        if fence_state is not FenceState.OUTSIDE:
            continue

        if _has_ledger_meta_comment(line):
            return (
                f"{source} contains reserved ledger-meta syntax; refusing it "
                "because mutation inputs cannot supply ledger metadata"
            )

        if line.startswith("# "):
            boundary = "a top-level '# ' heading"
        elif line.startswith("## "):
            boundary = "a '## ' date-section heading"
        elif line.startswith(ENTRY_MARKER):
            boundary = "an '### ' finding heading"
        elif HRULE_RE.match(line):
            boundary = "a thematic break matching HRULE_RE"
        else:
            boundary = None
        if boundary is not None:
            return (
                f"{source} contains an unfenced {boundary}; refusing it because it "
                "would restructure the ledger. Put quoted structure inside a fenced "
                "block instead."
            )

        marker = _answer_evidence_marker(line, sentry_origin=target_is_sentry)
        if marker == "**Why rejected:**":
            # Named separately because this marker is refused only on a
            # Sentry-origin entry and is legal everywhere else: a message that
            # did not say so would leave the operator unable to tell why the
            # same annotation is accepted on the next finding.
            return (
                f"{source} contains unfenced '**Why rejected:**' evidence for a "
                "Sentry-origin entry; refusing it because annotate cannot forge "
                "Felix's rejection. Only apply-answers may write it."
            )
        if marker is not None:
            return (
                f"{source} contains unfenced '{marker}' answer evidence; refusing it "
                "because annotate cannot forge Felix's answer. Only apply-answers "
                "may write it."
            )
    return None


def _needs_blank_before_block(
    lines: list[str], insertion: int, block: list[str]
) -> bool:
    """Whether a block appended at `insertion` must be separated by a blank line.

    Two commands append into an entry — `annotate` and `set-trailer` — and both
    need this answer, so it is asked once. Without a blank line a block joins the
    paragraph above it and renders as part of it; every hand-written closure note
    in the ledger has the blank line, and `annotate` was silently producing a
    different shape than the file's own convention until it got one.

    The exception is one list item landing after another: a blank line there makes
    the whole list LOOSE, so every existing item grows a paragraph gap. **A wrapped
    bullet's continuation counts as being inside the list.** The decisions ledger
    holds such a bullet (`d-20260904-20`, whose `Decided by` runs to a second,
    indented line), and reading only the immediately preceding line would call it a
    paragraph and loosen the list it belongs to.
    """
    if insertion <= 0 or not block or not block[0].strip():
        return False
    previous = lines[insertion - 1]
    if not previous.strip():
        return False
    if not BULLET_LINE_RE.match(block[0]):
        return True
    index = insertion - 1
    while index > 0 and CONTINUATION_LINE_RE.match(lines[index]):
        index -= 1
    return not BULLET_LINE_RE.match(lines[index])


def cmd_annotate(args: argparse.Namespace) -> int:
    """Insert a file's lines into one finding entry under the ledger lock."""
    raw_annotation, annotation = _read_mutation_input(args.file)
    if not any(line.strip() for line in annotation.splitlines()):
        raise LedgerError(f"{args.file} contains no content to annotate")
    request = _mutation_request(
        "annotate", args.id, raw_annotation, None, getattr(args, "request_id", None)
    )

    def build(text: str) -> tuple[str, list[str], list[str]]:
        lines, index = _locate_finding_header(text, args.id)
        findings, _problems, _vocabulary = _parse_text(text, args.ledger)
        target = next((finding for finding in findings if finding.id == args.id), None)
        if target is None:
            raise LedgerError(f"finding id {args.id} is not present in the ledger")
        refusal = _annotation_refusal(annotation, target, args.file)
        if refusal is not None:
            raise LedgerError(refusal)
        fence_states = _fence_mask(lines)
        end = _find_entry_span(lines, fence_states, index)
        effect = annotation.splitlines()
        block = list(effect)
        if _needs_blank_before_block(lines, end, block):
            block.insert(0, "")
        block.append(RECEIPT_PLACEHOLDER)
        lines[end:end] = block
        _register_ledger_commit(
            f"docs(findings): annotate {args.id}",
            [args.id],
            _receipt_postcondition(
                command="annotate",
                operation=request.operation,
                results=[args.id],
                decisions=False,
            ),
        )
        return _with_final_newline(text, lines), [args.id], effect

    _locked_receipted_mutation(args.ledger, request, build)
    print(f"annotated {args.id} from {args.file}")
    return 0


def _append_decision_entry(ledger_text: str, entry: str, section: str | None) -> str:
    """Append decision text, reusing a matching tail section when requested."""
    base = ledger_text.rstrip()
    label = (
        section
        or f"{datetime.now().astimezone():%Y-%m-%d} — recorded through the decisions lock"
    )
    lines, _matches = _decision_heading_matches(base, include_pending=True)
    mask = _fence_mask(lines)
    last_section = next(
        (
            line
            for index, line in reversed(list(enumerate(lines)))
            if mask[index] is FenceState.OUTSIDE and line.startswith("## ")
        ),
        None,
    )
    if last_section == f"## {label}":
        return base + "\n\n" + entry.strip() + "\n"
    return base + "\n\n" + f"## {label}" + "\n\n" + entry.strip() + "\n"


SECTION_LINE_SEPARATOR_RE = re.compile(r"[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]")


def _check_decision_section(section: str | None) -> None:
    """Reject section labels that could inject another ledger line."""
    if section is not None and SECTION_LINE_SEPARATOR_RE.search(section) is not None:
        raise LedgerError(
            "--section must be a single-line label without control line separators"
        )


def cmd_record_decision(args: argparse.Namespace) -> int:
    """Append pending decisions through the decisions ledger's writer lock."""
    _check_decision_section(args.section)
    raw_entry, entry = _read_mutation_input(args.file)
    input_metadata, input_meta_issues = _scan_ledger_metadata(entry, args.file)
    if input_meta_issues:
        raise LedgerError("invalid ledger metadata in decision input:\n" + "\n".join(input_meta_issues))
    if any(
        meta.data.get("kind") == MUTATION_RECEIPT_KIND
        for meta in input_metadata
    ):
        raise LedgerError(
            f"{args.file} contains reserved mutation-receipt metadata; "
            "mutation inputs cannot supply replay evidence"
        )
    _lines, pending = _decision_heading_matches(entry, include_pending=True)
    if not any(match.group("id") == PENDING_DECISION_ID for _, match in pending):
        raise LedgerError(
            f"{args.file} must contain at least one ### {PENDING_DECISION_ID} heading"
        )
    clause_one_issues = _decision_clause_one_issues(entry)
    if clause_one_issues:
        raise LedgerError(
            f"{args.file} decision entries must include tasks/decisions.md clause 1 "
            "fields (Question, Chosen, Rejected, Reason):"
            + chr(10)
            + chr(10).join(clause_one_issues)
        )
    request = _mutation_request(
        "record-decision",
        "decisions-ledger",
        raw_entry,
        args.section,
        getattr(args, "request_id", None),
    )
    date = f"{datetime.now().astimezone():%Y%m%d}"

    def build(text: str) -> tuple[str, list[str], list[str]]:
        taken = {
            match.group("id")
            for _index, match in _decision_heading_matches(text)[1]
        }
        rewritten, minted = _allocate_pending(
            entry,
            "d",
            date,
            taken,
            PENDING_DECISION_ID,
            lambda value: _decision_heading_locations(value, include_pending=True),
        )
        if PENDING_DECISION_ID in rewritten:
            raise LedgerError(f"{PENDING_DECISION_ID} survived decision id allocation")
        effect = rewritten.strip().splitlines()
        candidate = _append_decision_entry(
            text, rewritten.strip() + "\n" + RECEIPT_PLACEHOLDER, args.section
        )
        _register_ledger_commit(
            f"docs(decisions): record {' '.join(minted)}",
            minted,
            _receipt_postcondition(
                command="record-decision",
                operation=request.operation,
                results=minted,
                decisions=True,
            ),
        )
        return candidate, minted, effect

    allocated = _locked_receipted_mutation(args.decisions, request, build)
    print(f"recorded decision(s) as {' '.join(allocated)}")
    return 0


def cmd_set_trailer(args: argparse.Namespace) -> int:
    """Set supersession references and refresh covering receipts atomically.

    An entry that predates the trailer requirement has the bullet ADDED rather
    than being refused; see the insertion branch for why it is added bare.
    """
    # `-` alone is the documented unsuperseded state, so a mistaken supersession
    # can be reverted through the same receipted write that made it.
    clearing = args.superseded_by in (["-"], ["`-`"])
    references = [] if clearing else args.superseded_by
    if any(re.fullmatch(DECISION_REFERENCE_PATTERN, ref) is None for ref in references):
        raise LedgerError("--superseded-by requires decision references, or `-` alone to clear")
    written = ", ".join(references) or "-"
    identities = [ref.removeprefix("local:") for ref in references]
    if len(set(identities)) != len(identities):
        raise LedgerError("--superseded-by contains duplicate references")
    with _ledger_mutation_scope(args.decisions) as original:
        metadata = _validated_mutation_metadata(original, args.decisions)
        lines, headings = _decision_heading_matches(original)
        targets = [index for index, match in headings if match.group("id") == args.id]
        if len(targets) != 1:
            raise LedgerError(f"expected exactly one decision {args.id}; found {len(targets)}")
        known = {match.group("id") for _, match in headings}
        for ref in references:
            owner, separator, identifier = ref.rpartition(":")
            if not separator or owner == "local":
                if identifier == args.id:
                    raise LedgerError("a decision cannot supersede itself")
                if identifier not in known:
                    raise LedgerError(f"replacement decision {ref} does not exist locally")
        mask = _fence_mask(lines)
        start = targets[0]
        end = min(
            _find_entry_span(lines, mask, start),
            next((index for index, _ in headings if index > start), len(lines)),
        )
        # Identity for the replace path: nothing is inserted, so `shifted` below
        # never moves an index. Set here rather than in the branch so the closure
        # cannot read an unbound name when no insertion happens.
        inserted_at, inserted_count = len(lines), 0
        trailers = []
        for index in range(start + 1, end):
            if mask[index] is not FenceState.OUTSIDE:
                continue
            masked_line = _mask_inline_code_spans(lines[index])
            for marker in SUPERSEDED_BY_MARKER_RE.finditer(masked_line):
                trailers.append((index, SUPERSEDED_BY_RE.match(masked_line, marker.start())))
        if not trailers:
            # The trailer became a requirement partway through the ledger's life,
            # so the entries written before it were unreachable by the one command
            # allowed to route a superseded decision forward — and hand-editing is
            # barred, because it takes no lock while `merge-inbox` may hold one.
            # Measured in Korrigio 2026-09-21: 598 of 707 entries, back to
            # `d-20260816-01`. Appending the bullet is inside what this command
            # already does; it holds the ledger lock and has validated both ids.
            #
            # A bare `**Superseded-by:**` bullet, not the canonical
            # `**Decided by:** … · **Superseded-by:** …` pair: who decided an entry
            # that never recorded it is not recoverable here, and inventing a
            # decider would write a false attribution into the very ledger whose
            # attributions the rules exist to protect. `load_decisions` reads the
            # trailer per line, so a standalone bullet supersedes exactly as the
            # paired form does.
            #
            # The bullet goes BEFORE the entry's trailing receipt line, not after
            # it: a `record-decision` receipt is the last line of the batch it
            # covers, and a bullet appended past it would read as belonging to
            # nothing. That puts the insertion inside a covering effect window,
            # which the loop below repairs — see `shifted`.
            insertion = end
            while insertion > start + 1 and (
                not lines[insertion - 1].strip()
                or lines[insertion - 1].startswith(LEDGER_META_PREFIX)
            ):
                insertion -= 1
            addition = [f"* **Superseded-by:** {written}"]
            if _needs_blank_before_block(lines, insertion, addition):
                addition.insert(0, "")
            lines[insertion:insertion] = addition
            inserted_at, inserted_count = insertion, len(addition)
            changed = set(range(insertion, insertion + inserted_count))
        elif len(trailers) != 1 or trailers[0][1] is None:
            raise LedgerError(f"decision {args.id} requires exactly one valid Superseded-by trailer")
        else:
            index, match = trailers[0]
            assert match is not None
            lines[index] = (
                lines[index][:match.start("refs")]
                + written
                + lines[index][match.end("refs"):]
            )
            changed = {index}
        # A record-decision receipt can cover a whole batch. Refresh its entire
        # effect, keeping operation/input identity so the original append replays.
        # Process in file order in case a covering effect contains earlier metadata.
        #
        # `metadata` was scanned from the ORIGINAL text, so every index it carries
        # has to be moved across the insertion before it means anything in `lines`.
        # A batch receipt sits after the last entry it covers, so adding a trailer
        # to any earlier entry of that batch lands inside the hashed effect and
        # widens it by exactly the inserted lines. Leaving `effect_lines` alone
        # would rehash a window sliding off the front of its own effect.
        def shifted(index: int) -> int:
            return index + inserted_count if index >= inserted_at else index

        for meta in metadata:
            if meta.data.get("kind") != MUTATION_RECEIPT_KIND:
                continue
            receipt_index = shifted(meta.line - 1)
            effect_start = shifted(meta.line - 1 - cast(int, meta.data["effect_lines"]))
            if not any(effect_start <= line < receipt_index for line in changed):
                continue
            data = dict(meta.data)
            data["effect_lines"] = receipt_index - effect_start
            data["effect_sha256"] = _sha256_text("\n".join(lines[effect_start:receipt_index]))
            lines[receipt_index] = _metadata_line(data)
            changed.add(receipt_index)
        candidate = "\n".join(lines) + ("\n" if original.endswith("\n") else "")
        issues = _validate_text(candidate, args.decisions)
        # Entry ids are unchanged, so resolution may use the on-disk id set,
        # but must inspect the candidate lines and their citation-context hashes.
        _resolved, citation_issues = _citation_resolution(
            args.ledger, args.decisions, decision_text=candidate
        )
        issues += citation_issues
        if issues:
            raise LedgerError("the mutation would leave the ledger invalid:\n" + "\n".join(issues))
        if candidate == original:
            _fsync_directory(args.decisions.parent)
        else:
            _register_ledger_commit(
                f"docs(decisions): set trailer for {args.id}",
                [args.id, *references],
                _decision_trailer_postcondition(args.id, references),
            )
            _write_if_unchanged(args.decisions, original, candidate, durable_directory=True)
    print(f"set {args.id} Superseded-by: {written}")
    return 0


def _decision_bullet(
    answer: str, fence_states: list[FenceState] | None = None
) -> list[str] | None:
    """The whole `**Decision made:**` bullet, continuation lines included.

    Deliberately not a regex capture. `.*` stops at the first newline, and the
    answering skill writes Felix's reasoning as a wrapped bullet — so a one-line
    capture keeps the letter he chose and silently drops the sentence saying
    *why*, which is the half a later session needs when the decision is
    questioned again. The spool file is unlinked immediately afterwards, so that
    loss is permanent and invisible: validation passes and the run reports
    success.
    """
    lines = answer.splitlines()
    if fence_states is None:
        fence_states = _fence_mask(lines)
    bullets = _decision_bullets(lines, fence_states)
    return bullets[0] if bullets else None


def _decision_bullets(
    lines: list[str],
    fence_states: list[FenceState],
    start: int = 0,
    end: int | None = None,
) -> list[list[str]]:
    """Reconstruct every unfenced decision bullet, including wrapped lines."""
    if end is None:
        end = len(lines)
    bullets: list[list[str]] = []
    index = start
    while index < end:
        if (
            fence_states[index] is not FenceState.OUTSIDE
            or (match := DECISION_BULLET_RE.match(lines[index])) is None
        ):
            index += 1
            continue
        bullet = ["* " + match.group("decision").rstrip()]
        continuation = index + 1
        while continuation < end:
            line = lines[continuation]
            if (
                fence_states[continuation] is not FenceState.OUTSIDE
                or not line.strip()
                or not line[:1].isspace()
            ):
                break
            bullet.append(line.rstrip())
            continuation += 1
        bullets.append(bullet)
        index = continuation
    return bullets


def _parse_answer_file(path: Path) -> tuple[str, list[str]] | None:
    """Parse one claimed answer into its id and complete decision payload."""
    answer = path.read_text(encoding="utf-8")
    answer_lines = answer.splitlines()
    answer_fence_states = _fence_mask(answer_lines)
    ids = [
        match.group("id")
        for line, fence_state in zip(answer_lines, answer_fence_states, strict=True)
        if fence_state is FenceState.OUTSIDE
        and (match := ANSWER_ID_RE.match(line)) is not None
    ]
    decision_matches = [
        match
        for line, fence_state in zip(answer_lines, answer_fence_states, strict=True)
        if fence_state is FenceState.OUTSIDE
        and (match := DECISION_BULLET_RE.match(line)) is not None
    ]
    bullet = _decision_bullet(answer, answer_fence_states)
    if len(ids) != 1 or bullet is None or len(decision_matches) != 1:
        return None
    return ids[0], bullet


def _sentry_answer_kind(
    bullet: list[str], *, allow_legacy: bool = False
) -> str:
    """Return the explicit approval decision from a Sentry answer bullet."""
    decision = bullet[0].split(DECIDED_MARKER, 1)[1].strip()
    match = VERIFIER_DECISION_RE.match(decision)
    if match is None:
        if allow_legacy:
            legacy = re.match(r"^(?P<kind>approve|reject)(?:[ \t]+|$)", decision)
            if legacy is not None:
                return legacy.group("kind")
        raise LedgerError(
            "a Sentry-origin answer must use the verifier actor and current body "
            "digest"
        )
    return match.group("kind")


def _validate_verifier_actor(
    actor: str, expected_digest: str
) -> tuple[re.Match[str] | None, str | None]:
    """Validate one verifier actor and its body digest at an answer boundary."""
    actor_match = VERIFIER_ACTOR_FULL_RE.fullmatch(actor)
    if actor_match is None:
        return None, "invalid verifier actor"
    if actor_match.group("body") != expected_digest:
        return actor_match, "verifier body digest does not match"
    return actor_match, None


def _sentry_answer_evidence(
    bullet: list[str], kind: str, *, actor_prefixed: bool = True
) -> list[str]:
    """Turn a Sentry answer into validator evidence for approval or rejection."""
    decision = bullet[0].split(DECIDED_MARKER, 1)[1].strip()
    verifier = VERIFIER_DECISION_RE.match(decision)
    if verifier is not None:
        actor = verifier.group("actor")
        reason = decision[verifier.end("actor") + 1 :].lstrip()
    else:
        actor_match = re.match(r"^(?P<actor>[^:—]+):[ \t]*(?P<reason>.*)$", decision)
        actor = actor_match.group("actor").strip() if actor_match else "answer route"
        reason = actor_match.group("reason").strip() if actor_match else decision[len(kind) :].lstrip(" \t—:,-")
    continuation = " ".join(line.strip() for line in bullet[1:] if line.strip())
    reason = " ".join(part for part in (reason, continuation) if part)
    if not reason:
        reason = (
            "Approved through the answer route."
            if kind == "approve"
            else "Rejected through the answer route."
        )
    if actor != "answer route" and actor_prefixed:
        reason = f"{actor}: {reason}"
    marker = "Approved" if kind == "approve" else "Why rejected"
    return [f"* **{marker}:** {reason}"]


def _errno_name(exc: OSError) -> str:
    """Return a stable errno label for filesystem diagnostics."""
    return (
        errno.errorcode.get(exc.errno, str(exc.errno))
        if exc.errno is not None
        else "unknown errno"
    )


def _probe_answers_spool(spool: Path) -> None:
    """Raise when an answers spool exists but cannot be consumed safely."""
    try:
        spool_mode = os.lstat(spool).st_mode
    except FileNotFoundError:
        return
    except OSError as exc:
        errno_name = _errno_name(exc)
        raise LedgerError(
            f"could not inspect answers spool {spool} ({errno_name}): {exc}"
        ) from exc
    if not stat.S_ISDIR(spool_mode):
        raise LedgerError(
            f"answers spool {spool} exists but is not a directory; an answer "
            "written there will never be read"
        )
    try:
        with os.scandir(spool) as entries:
            next(entries, None)
    except OSError as exc:
        errno_name = _errno_name(exc)
        raise LedgerError(
            f"could not enumerate answers spool {spool} ({errno_name}): {exc}"
        ) from exc


def _refuse_unapplied_answers(spool: Path) -> None:
    """Refuse answer consumption while quarantined answers need resolution."""
    unapplied = sorted(spool.glob("*.unapplied"))
    if unapplied:
        names = ", ".join(path.name for path in unapplied)
        raise LedgerError(
            f"answers spool {spool} contains unapplied answer file(s): {names}; "
            "resolve them before applying more answers"
        )


def _answer_ids_in_path(path: Path) -> set[str]:
    """Read answer ids from one spool or claim file for duplicate detection."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return set()
    lines = text.splitlines()
    states = _fence_mask(lines)
    return {
        match.group("id")
        for line, state in zip(lines, states, strict=True)
        if state is FenceState.OUTSIDE
        and (match := ANSWER_ID_RE.match(line)) is not None
    }


def _answer_target_finding(ledger: Path, identifier: str) -> Finding:
    findings, problems, vocabulary = parse(ledger)
    issues = validate(findings, problems, vocabulary)
    if issues:
        raise LedgerError(
            f"the findings ledger does not validate: {'; '.join(issues)}"
        )
    target = next((finding for finding in findings if finding.id == identifier), None)
    if target is None:
        raise LedgerError(f"finding id {identifier} is not present in the ledger")
    return target


def _cmd_answer(args: argparse.Namespace) -> int:
    """Publish one authenticated answer without touching either ledger."""
    target = _answer_target_finding(args.ledger, args.id)
    blocker_class = classify_blocker(target.blocked)
    actor = str(getattr(args, "actor", "")).strip()
    reason = str(getattr(args, "reason", "")).strip()
    verdict = getattr(args, "verdict", None)
    decision = getattr(args, "decision", None)
    if not actor:
        raise LedgerError("--actor is required")
    if blocker_class == BLOCKER_VERIFIER:
        if decision is not None:
            raise LedgerError(
                "--decision is only valid for felix-decision findings; verifier "
                "answers require --verdict"
            )
        if verdict not in {"approve", "reject"}:
            raise LedgerError("verifier answers require --verdict approve or reject")
        expected_digest = verified_body_sha256(target)
        actor_match, validation_error = _validate_verifier_actor(
            actor, expected_digest
        )
        if validation_error == "invalid verifier actor":
            raise LedgerError(
                "Sentry verifier answers require actor "
                "'automated Sentry-origin verifier (codex, run <id>, body <sha256>)'"
            )
        if validation_error is not None:
            actual_digest = actor_match.group("body") if actor_match else ""
            raise LedgerError(
                f"verifier actor body digest {actual_digest} does not "
                f"match the current body digest {expected_digest}"
            )
        choice = verdict
    elif blocker_class == BLOCKER_ANSWERABLE:
        if verdict is not None:
            raise LedgerError("--verdict is only valid for Sentry verifier findings")
        if not isinstance(decision, str) or not decision.strip():
            raise LedgerError("felix-decision answers require --decision")
        choice = decision.strip()
    else:
        raise LedgerError(
            f"finding {target.id} is not answerable (blocker={target.blocked})"
        )
    if not reason:
        reason = "Answer recorded through the findings answer route."
    answer = (
        f"* **ID:** {target.id}\n\n"
        f"* **Decision made:** {choice} — {actor}: {reason}\n"
    )
    spool: Path = args.answers
    claim = spool.with_name(f"{spool.name}.claim")
    with _publish_lock(publish_lock_path(spool)):
        spool.mkdir(parents=True, exist_ok=True)
        candidates = list(spool.glob("*.md")) + list(spool.glob(".*.part"))
        if claim.exists():
            if not claim.is_dir():
                raise LedgerError(
                    f"answers claim {claim} exists but is not a directory"
                )
            candidates += list(claim.glob("*.md"))
        for path in candidates:
            if target.id in _answer_ids_in_path(path):
                raise LedgerError(
                    f"finding {target.id} already has an answer in {path}; "
                    "refusing a duplicate verifier or decision answer"
                )
        part = spool / f".{_publish_stamp()}-{_unique_suffix()}.part"
        candidate = spool / f"{_publish_stamp()}-{_unique_suffix()}.md"
        _atomic_write(part, answer, durable_directory=True)
        try:
            os.link(part, candidate)
            _fsync_directory(spool)
        except OSError as exc:
            raise LedgerError(f"could not publish answer to {spool}: {exc}") from exc
        finally:
            part.unlink(missing_ok=True)
        _fsync_directory(spool)
    print(f"published answer for {target.id}: {candidate}")
    return 0


def cmd_answer(args: argparse.Namespace) -> int:
    """CLI answer wrapper with a typed usage/refusal status."""
    try:
        return _cmd_answer(args)
    except (LedgerError, OSError, UnicodeError) as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2


def cmd_apply_answers(args: argparse.Namespace) -> int:
    """Fold answers through the shared locked mutation pipeline."""
    hold_consumer_lock = bool(getattr(args, "hold_consumer_lock", False))
    if hold_consumer_lock:
        consumer_fd, consumer_lock, consumer_error = _try_consumer_lock()
        if consumer_error is not None:
            print(f"FAIL {consumer_error}", file=sys.stderr)
            return 2
        if consumer_fd is None:
            print(
                f"consumer lock {consumer_lock} is held by the drain; retry after it "
                "finishes",
                file=sys.stderr,
            )
            return 75
        args._consumer_lock_fd = consumer_fd
    spool: Path = args.answers
    claim = spool.with_name(f"{spool.name}.claim")
    decisions = _args_decisions(args)
    # Before the deferred preconditions, which commit pending ledger dirt.
    _refuse_controller_export_at(args.ledger, "apply-answers")
    mode = _claim_finalisation_mode(
        args.ledger, merge_without_intent=_ACTIVE_LEDGER_COMMIT is None
    )
    if mode == "deferred":
        _deferred_preconditions(args.ledger, decisions)
        if (
            not hold_consumer_lock
            and _ACTIVE_LEDGER_COMMIT is not None
            and os.environ.get(LEDGER_COMMIT_ENV) != "0"
        ):
            _settle_pending_ledger_dirt(_ACTIVE_LEDGER_COMMIT)
    # Check the leftover claim first. A refused batch normally leaves the spool
    # empty, so testing for an empty or absent spool first would hide the stop
    # signal that says answers are stranded outside the ledger.
    if not claim.exists():
        _probe_answers_spool(spool)
    claimed: list[Path] | None = None
    applied: list[str] = []
    skipped: list[str] = []
    quarantined: list[Path] = []
    unreadable_current: dict[str, str] = {}

    def build(text: str) -> str:
        nonlocal claimed
        if hold_consumer_lock:
            # This check runs inside _locked_ledger_mutation's writer lock,
            # before claiming or settling anything. It prevents foreign bytes
            # from being folded into the answer commit between a preflight
            # probe and the locked mutation.
            root = cast(Path, REPO_ROOT).resolve()
            ledger_relative = _repo_relative(_resolved_repo_path(args.ledger), root)
            dirty_probe = _git_for_ledger(
                root, "diff", "--quiet", "HEAD", "--", ledger_relative
            )
            if dirty_probe.returncode == 1:
                raise LedgerDirtyError(
                    f"ledger dirty against HEAD: {_resolved_repo_path(args.ledger)}; "
                    "commit or discard that change before applying answers"
                )
            if dirty_probe.returncode != 0:
                raise LedgerError(
                    "could not inspect ledger dirt against HEAD: "
                    + _git_failure_detail(dirty_probe)
                )
        issues = _validate_text(text, args.ledger)
        if issues:
            raise LedgerError(
                f"the working ledger does not validate: {'; '.join(issues)}; "
                f"nothing in {spool} or {claim} was touched — repair it first"
            )
        with _publish_lock(publish_lock_path(spool)):
            _refuse_unapplied_answers(spool)
            if not _adopt_orphan_parts(spool):
                raise LedgerError(
                    f"could not adopt every orphan in answers spool {spool}"
                )
            if claim.exists():
                existing_intent = _read_claim_intent(
                    claim, strict=mode == "deferred"
                )
                if (
                    existing_intent is not None
                    and existing_intent.phase == "prepared"
                ):
                    if existing_intent.files is None:
                        raise LedgerError(
                            _answers_legacy_intent_message(
                                claim.resolve(),
                                spool.resolve(),
                                args.ledger.resolve(),
                                mode,
                            )
                        )
                    reconciliation = _reconcile_answers_claim(
                        claim, spool, args.ledger, decisions, mode
                    )
                    if mode != "deferred" and reconciliation.replay:
                        _recover_claim(
                            claim,
                            spool,
                            args.ledger,
                            answers=True,
                            publish_locked=True,
                        )
                else:
                    _recover_claim(
                        claim,
                        spool,
                        args.ledger,
                        answers=True,
                        publish_locked=True,
                    )
            existing_claimed = (
                sorted(claim.glob("*.md")) if claim.exists() else []
            )
            newly_claimed = claim_spool(
                spool,
                claim,
                into_existing=claim.exists(),
            )
            claimed = (
                sorted(existing_claimed + newly_claimed)
                if newly_claimed is not None
                else None
            )
        if claimed is None:
            raise LedgerError(
                f"a previously refused answers batch is still unresolved: {claim}"
            )
        if not claimed:
            if claim.exists():
                existing_intent = _read_claim_intent(
                    claim, strict=mode == "deferred"
                )
                if (
                    existing_intent is not None
                    and existing_intent.phase == "prepared"
                    and existing_intent.quarantined
                    and not list(claim.glob("*.md"))
                ):
                    # A retry after a crash between the quarantine move and
                    # cleanup has no replayable answer left.  Finish that
                    # durable quarantine boundary before returning.
                    release_spool(claim, spool, [], publish_locked=False)
            return text
        lines = text.splitlines()
        ledger_fence_states = _fence_mask(lines)
        answer_records: list[tuple[Path, str, list[str]]] = []
        paths_by_id: dict[str, list[Path]] = {}
        for answer_path in claimed:
            try:
                record = _parse_answer_file(answer_path)
            except (OSError, UnicodeError):
                unreadable_current[answer_path.name] = "unreadable"
                continue
            if record is None:
                raise LedgerError(
                    f"{answer_path.name} needs exactly one finding id and one "
                    f"'{DECIDED_MARKER}' bullet"
                )
            finding_id, bullet = record
            answer_records.append((answer_path, finding_id, bullet))
            paths_by_id.setdefault(finding_id, []).append(answer_path)

        answer_by_id = {
            finding_id: (answer_path, bullet)
            for answer_path, finding_id, bullet in answer_records
        }
        target_spans = _answer_target_spans(
            lines, ledger_fence_states, answer_by_id
        )
        duplicate_ids = {
            finding_id: paths
            for finding_id, paths in paths_by_id.items()
            if len(paths) > 1
        }
        verifier_duplicate_ids = {
            finding_id: paths
            for finding_id, paths in duplicate_ids.items()
            if (
                finding_id in target_spans
                and classify_blocker(target_spans[finding_id][2].group("blocked"))
                == BLOCKER_VERIFIER
            )
        }
        ordinary_duplicate_ids = {
            finding_id: paths
            for finding_id, paths in duplicate_ids.items()
            if finding_id not in verifier_duplicate_ids
        }
        if ordinary_duplicate_ids:
            details = "; ".join(
                f"{finding_id}: {', '.join(path.name for path in paths)}"
                for finding_id, paths in ordinary_duplicate_ids.items()
            )
            raise LedgerError(f"duplicate answer id(s) in batch: {details}")
        verifier_to_quarantine: list[tuple[Path, str, Path]] = []
        duplicate_verifier_paths = {
            path
            for paths in verifier_duplicate_ids.values()
            for path in paths
        }
        for answer_path in duplicate_verifier_paths:
            destination = spool.with_name(f"{spool.name}.refused") / answer_path.name
            if destination.exists():
                raise LedgerError(
                    f"cannot quarantine {answer_path.name}: destination "
                    f"{destination} already exists"
                )
            verifier_to_quarantine.append(
                (answer_path, "duplicate verifier answer", destination)
            )
        answer_records = [
            record for record in answer_records if record[0] not in duplicate_verifier_paths
        ]
        answer_by_id = {
            finding_id: (answer_path, bullet)
            for answer_path, finding_id, bullet in answer_records
        }

        header_updates: dict[int, str] = {}
        insertions: dict[int, list[str]] = {}
        waiting_records: list[dict[str, object]] = []
        already_applied: list[tuple[Path, str]] = []
        to_quarantine: list[tuple[Path, str, Path]] = []
        verifier_quarantine: list[tuple[Path, str, Path]] = verifier_to_quarantine
        for answer_path, finding_id, bullet in answer_records:
            target = target_spans.get(finding_id)
            if target is None:
                raise LedgerError(
                    f"{answer_path.name} answers {finding_id}, which is not in the ledger"
                )
            header_index, end, header_match = target
            blocked = header_match.group("blocked")
            blocker_class = classify_blocker(blocked)
            if blocker_class in {BLOCKER_ANSWERABLE, BLOCKER_VERIFIER}:
                kind = "decision"
                evidence = list(bullet)
                if blocker_class == BLOCKER_VERIFIER:
                    try:
                        kind = _sentry_answer_kind(bullet)
                    except LedgerError as exc:
                        destination = spool.with_name(f"{spool.name}.refused") / answer_path.name
                        verifier_quarantine.append((answer_path, str(exc), destination))
                        continue
                    decision = bullet[0].split(DECIDED_MARKER, 1)[1].strip()
                    verifier_match = VERIFIER_DECISION_RE.match(decision)
                    target_finding = next(
                        (finding for finding in _parse_text(text, args.ledger)[0]
                         if finding.id == finding_id),
                        None,
                    )
                    expected_digest = (
                        verified_body_sha256(target_finding)
                        if target_finding is not None
                        else ""
                    )
                    if verifier_match is None:
                        destination = spool.with_name(f"{spool.name}.refused") / answer_path.name
                        verifier_quarantine.append((answer_path, "invalid verifier actor", destination))
                        continue
                    actual_actor = verifier_match.group("actor")
                    _actual_match, validation_error = _validate_verifier_actor(
                        actual_actor, expected_digest
                    )
                    if validation_error is not None:
                        destination = spool.with_name(f"{spool.name}.refused") / answer_path.name
                        verifier_quarantine.append((answer_path, validation_error, destination))
                        continue
                    evidence += _sentry_answer_evidence(bullet, kind)
                body = tuple(
                    lines[index]
                    for index in range(header_index + 1, end)
                    if ledger_fence_states[index] is FenceState.OUTSIDE
                )
                line_counts: dict[str, int] = {}
                for line in body:
                    line_counts[line] = line_counts.get(line, 0) + 1
                previous_line_occurrences = {
                    line: line_counts.get(line, 0) for line in set(evidence)
                }
                waiting_records.append(
                    {
                        "path": answer_path,
                        "id": finding_id,
                        "bullet": bullet,
                        "blocked": blocked,
                        "status": header_match.group("status"),
                        "kind": kind,
                        "evidence": evidence,
                        "previous_occurrences": _contiguous_occurrences(
                            body, tuple(evidence)
                        ),
                        "previous_line_occurrences": previous_line_occurrences,
                    }
                )
                continue
            entry_bullets = _decision_bullets(
                lines, ledger_fence_states, header_index + 1, end
            )
            if bullet in entry_bullets:
                already_applied.append((answer_path, finding_id))
                continue
            destination = spool / answer_path.with_suffix(".unapplied").name
            if destination.exists():
                raise LedgerError(
                    f"cannot quarantine {answer_path.name}: destination "
                    f"{destination} already exists"
                )
            to_quarantine.append((answer_path, finding_id, destination))

        for answer_path, finding_id in already_applied:
            answer_path.unlink()
            skipped.append(
                f"{finding_id} (already applied; consumed {answer_path.name})"
            )
        for answer_path, finding_id, destination in to_quarantine:
            os.rename(answer_path, destination)
            quarantined.append(destination)
            skipped.append(
                f"{finding_id} (not waiting on a decision; preserved "
                f"{destination.name})"
            )
        for record in waiting_records:
            finding_id = cast(str, record["id"])
            bullet = cast(list[str], record["bullet"])
            blocked = cast(str, record["blocked"])
            kind = cast(str, record["kind"])
            target = target_spans[finding_id]
            header_index, end, header_match = target
            updated_header = lines[header_index]
            if classify_blocker(blocked) == BLOCKER_VERIFIER and kind == "reject":
                updated_header = re.sub(
                    r"(\*\*Status:\*\* )\S+",
                    r"\g<1>rejected",
                    updated_header,
                    count=1,
                )
            updated_header = updated_header.replace(
                f"**Blocked:** {blocked}", "**Blocked:** none"
            )
            header_updates[header_index] = updated_header
            evidence = cast(list[str], record["evidence"])
            insertions[end] = evidence
            applied.append(finding_id)

        expected_answers: dict[str, AnswerExpectation] = {}
        answer_files: dict[str, dict[str, object]] = {}
        for record in waiting_records:
            answer_path = cast(Path, record["path"])
            finding_id = cast(str, record["id"])
            header_index, end, _header_match = target_spans[finding_id]
            updated = HEADER_RE.match(header_updates[header_index])
            assert updated is not None
            expected_evidence = tuple(insertions[end])
            expected_answers[finding_id] = AnswerExpectation(
                status=updated.group("status"),
                blocked=updated.group("blocked"),
                evidence=expected_evidence,
                previous_occurrences=cast(int, record["previous_occurrences"]),
                previous_line_occurrences=cast(
                    dict[str, int], record["previous_line_occurrences"]
                ),
                kind=cast(str, record["kind"]),
            )
            answer_files[answer_path.name] = {
                "id": finding_id,
                "blocked": record["blocked"],
                "status": record["status"],
                "kind": record["kind"],
                "evidence": record["evidence"],
                "previous_occurrences": record["previous_occurrences"],
                "previous_line_occurrences": record["previous_line_occurrences"],
            }
        if expected_answers:
            _register_ledger_commit(
                f"docs(findings): apply answers for {' '.join(expected_answers)}",
                expected_answers,
                _answers_postcondition(expected_answers),
            )

        result_lines: list[str] = []
        for index in range(len(lines) + 1):
            if index in insertions:
                result_lines.extend(insertions[index])
            if index < len(lines):
                result_lines.append(header_updates.get(index, lines[index]))

        if waiting_records or unreadable_current or verifier_quarantine:
            existing_intent = _read_claim_intent(claim, strict=mode == "deferred")
            if existing_intent is not None and existing_intent.files is not None:
                existing_files = dict(existing_intent.files)
                existing_files.update(answer_files)
                answer_files = existing_files
            existing_quarantined = (
                dict(existing_intent.quarantined)
                if existing_intent is not None
                else {}
            )
            existing_quarantined.update(unreadable_current)
            for answer_path, reason, _destination in verifier_quarantine:
                existing_quarantined[answer_path.name] = reason
            for name in existing_quarantined:
                # The unreadable file has no trustworthy bytes from which to
                # recover an id.  Keep a schema-marked tombstone in ``files``;
                # prepared claims already carry their real per-file record.
                answer_files.setdefault(
                    name,
                    {
                        "id": None,
                        "kind": "quarantine",
                    },
                )
            _write_claim_intent(
                claim,
                "prepared",
                {
                    cast(str, record["id"])
                    for record in answer_files.values()
                    if isinstance(record.get("id"), str)
                },
                files=answer_files,
                quarantined=existing_quarantined,
            )
            if existing_quarantined:
                with _publish_lock(publish_lock_path(spool)):
                    intent = _read_claim_intent(claim, strict=mode == "deferred")
                    if intent is not None:
                        _quarantine_claim_files(claim, spool, intent)
            if mode == "deferred" and _ACTIVE_LEDGER_COMMIT is not None:
                _ACTIVE_LEDGER_COMMIT.claim = claim
                _ACTIVE_LEDGER_COMMIT.finalize = lambda: _finalize_answers_claim(
                    claim, spool, args.ledger, decisions, "deferred"
                )
        return _with_final_newline(text, result_lines)

    def clean_committed_claim() -> None:
        if claimed and (mode != "deferred" or not applied):
            release_spool(claim, spool, claimed)

    _locked_ledger_mutation(
        args.ledger,
        build,
        applied,
        post_commit=clean_committed_claim,
    )
    if applied:
        print(f"applied {len(applied)} decision(s): {', '.join(applied)}")
    for note in skipped:
        print(f"skipped {note}")
    return 1 if quarantined else 0


def _bind_repo_root(root: Path) -> None:
    """Point module-level ledger paths at a git toplevel. Verb-time only."""
    global REPO_ROOT, LEDGER, DECISIONS, INBOX, LEGACY_INBOX, CLAIM, ANSWERS
    global DEFAULT_DRAIN_LOCK
    REPO_ROOT = root
    LEDGER = root / "tasks" / "findings.md"
    DECISIONS = root / "tasks" / "decisions.md"
    INBOX = root / "tasks" / "findings-inbox"
    LEGACY_INBOX = root / "tasks" / "findings-inbox.md"
    CLAIM = root / "tasks" / "findings-inbox.claim"
    ANSWERS = root / "tasks" / "findings-answers"
    DEFAULT_DRAIN_LOCK = _lock_for_root(root)


def _plan_only_file_exception(args: argparse.Namespace) -> bool:
    """Allow only the exact planner spool filing or read-only status form."""
    if args.command != "file":
        return False
    if bool(getattr(args, "status", False)):
        return True
    inbox = os.environ.get(PLAN_INBOX_ENV)
    return bool(
        getattr(args, "spool_only", False)
        and getattr(args, "inbox", None) is not None
        and inbox
        and args.inbox == Path(inbox)
    )


def _plan_only_refuses(args: argparse.Namespace) -> bool:
    """Refuse guarded verbs before any command-owned lock or write is touched."""
    if os.environ.get(PLAN_ONLY_ENV) != "1":
        return False
    if COMMAND_CLASSIFICATION.get(args.command) != "guarded":
        return False
    if _plan_only_file_exception(args):
        return False
    print(
        f"REFUSING: {PLAN_ONLY_ENV}=1 forbids {args.command}",
        file=sys.stderr,
    )
    return True


LEDGER_COMMIT_ENV = "FINDINGS_LEDGER_COMMIT"
LEDGER_COMMIT_COMMANDS = frozenset(
    {
        "file",
        "merge-inbox",
        "apply-answers",
        "set-header",
        "annotate",
        "record-decision",
        "set-trailer",
    }
)
LEDGER_COMMIT_RETRY_SECONDS = 0.1
LEDGER_INDEX_REFRESH_ATTEMPTS = 2
LEDGER_HOOK_TIMEOUT_SECONDS = 600.0
LEDGER_HOOK_TERM_GRACE_SECONDS = 30.0
LEDGER_INDEX_FILE_MODE = 0o600
LEDGER_INDEX_NAME_PREFIX = "findings-ledger-index-"
LEDGER_BLOB_READ_FAILURE_CAUSE = "stored-blob-read-failed"
LEDGER_BLOB_BYTES_MISMATCH_CAUSE = "exact-byte-mismatch"


def _git_for_ledger(
    root: Path, *arguments: str, stdin: str | None = None
) -> subprocess.CompletedProcess[str]:
    """Run one non-interactive git operation for the commit helper."""
    git = shutil.which("git") or "/usr/bin/git"
    return subprocess.run(
        [git, *arguments],
        cwd=root,
        input=stdin,
        capture_output=True,
        text=True,
        check=False,
    )


def _git_for_ledger_bytes(
    root: Path, *arguments: str
) -> subprocess.CompletedProcess[bytes]:
    """Run one git operation while preserving binary stdout and stderr."""
    git = shutil.which("git") or "/usr/bin/git"
    return subprocess.run(
        [git, *arguments],
        cwd=root,
        capture_output=True,
        text=False,
        check=False,
    )


def _git_for_ledger_env(
    root: Path,
    environment: dict[str, str],
    *arguments: str,
    stdin: bytes | str | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run git with a private index without changing this process's environment."""
    git = shutil.which("git") or "/usr/bin/git"
    text_input = isinstance(stdin, str) or stdin is None
    return subprocess.run(
        [git, *arguments],
        cwd=root,
        env=environment,
        input=stdin,
        capture_output=True,
        text=text_input,
        check=False,
    )


def _git_failure_detail(result: subprocess.CompletedProcess[str]) -> str:
    detail = (result.stderr or result.stdout).strip().replace("\n", "; ")
    return detail or f"git exited {result.returncode} without a diagnostic"


def _save_ledger_commit_scratch(
    intent: LedgerCommitIntent,
    *,
    path: Path | None = None,
    content: bytes | None = None,
    suffix: str = "",
) -> Path | None:
    """Save ledger bytes outside the checkout; never gate the commit."""
    path = path or intent.ledger
    content = intent.written_bytes if content is None else content
    try:
        directory = Path(tempfile.gettempdir()).resolve()
        root = cast(Path, REPO_ROOT).resolve()
        if directory == root or root in directory.parents:
            directory = Path("/tmp")
        fd, name = tempfile.mkstemp(
            prefix=f"findings-ledger-{intent.command}-",
            suffix=f"-{suffix}{path.name}",
            dir=directory,
        )
        with os.fdopen(fd, "wb") as handle:
            handle.write(content or b"")
            handle.flush()
            os.fsync(handle.fileno())
        return Path(name)
    except (OSError, UnicodeError):
        return None


def _discard_scratch(path: Path | None) -> None:
    if path is not None:
        with suppress(OSError):
            path.unlink()


def _safe_discard_scratch(path: Path | None) -> None:
    with suppress(OSError):
        _discard_scratch(path)


def _create_temporary_git_index() -> Path:
    """Reserve a private index path without sharing scratch-file allocation."""
    directory = Path(tempfile.gettempdir()).resolve()
    root = cast(Path, REPO_ROOT).resolve()
    if directory == root or root in directory.parents:
        directory = Path("/tmp")
    for _attempt in range(PUBLISH_NAME_ATTEMPTS):
        candidate = directory / f"{LEDGER_INDEX_NAME_PREFIX}{_unique_suffix()}"
        try:
            descriptor = os.open(
                candidate,
                os.O_CREAT | os.O_EXCL | os.O_WRONLY,
                LEDGER_INDEX_FILE_MODE,
            )
        except FileExistsError:
            continue
        try:
            os.close(descriptor)
            candidate.unlink()
        except OSError:
            with suppress(OSError):
                os.close(descriptor)
            with suppress(OSError):
                candidate.unlink()
            raise
        return candidate
    raise OSError(f"could not reserve a unique temporary index path in {directory}")


def _head_postcondition(intent: LedgerCommitIntent) -> tuple[bool, str]:
    """Validate HEAD and prove this command's semantic postcondition there."""
    try:
        with _head_ledger_snapshot(
            intent.findings, intent.decisions, strict_decisions=False
        ) as snapshot:
            if snapshot.findings_text is None:
                return False, "the findings ledger is not in HEAD"
            if not snapshot.valid:
                return False, f"HEAD ledger validation failed: {snapshot.detail}"
            if intent.postcondition is None:
                return False, "no semantic postcondition was registered"
            if not intent.postcondition(
                snapshot.tasks_dir / "findings.md",
                snapshot.tasks_dir / "decisions.md",
            ):
                return False, "the command's write is not in HEAD"
            return True, ""
    except (LedgerError, OSError, UnicodeError, ValueError) as exc:
        return False, f"could not verify HEAD: {exc}"


def _warn_ledger_commit(
    intent: LedgerCommitIntent,
    cause: str,
    scratch: Path | None,
    companion_scratch: Path | None = None,
    *,
    durable_head: str = "",
) -> None:
    identifiers = " ".join(intent.identifiers) or "(unknown ids)"
    recovery = f"; written bytes: {scratch}" if scratch is not None else ""
    if companion_scratch is not None:
        recovery += f"; companion bytes: {companion_scratch}"
    if intent.claim is not None:
        if intent.command == "apply-answers":
            recovery += (
                f"; the claim at {intent.claim} keeps the answers for the next "
                "apply-answers or finalize-claims"
            )
        else:
            recovery += (
                f"; the claim at {intent.claim} keeps the batch for the next merge "
                "or finalize-claims"
            )
        writer = Path(__file__).resolve()
        answers = intent.claim.parent / intent.claim.name.removesuffix(".claim")
        inbox = INBOX if intent.command == "apply-answers" else answers
        answers_option = (
            f" --answers {_resolved_repo_path(answers)}"
            if intent.command == "apply-answers"
            else ""
        )
        recovery += (
            f"; run {writer} --ledger {_resolved_repo_path(intent.ledger)} "
            f"--decisions {_resolved_repo_path(intent.decisions)} finalize-claims "
            f"--inbox {_resolved_repo_path(inbox)}{answers_option}"
        )
    if intent.provisional:
        recovery += (
            "; the id(s) "
            + " ".join(intent.provisional)
            + " printed above are provisional — a replay re-mints any that were used meanwhile"
        )
    if durable_head:
        prefix = (
            f"WARNING ledger commit for {intent.ledger} after {intent.command} "
            f"({identifiers}) is durable as {durable_head} but was not fully verified: "
        )
    else:
        prefix = (
            f"WARNING ledger commit for {intent.ledger} after {intent.command} "
            f"({identifiers}) did not preserve the write in HEAD: "
        )
    print(prefix + f"{cause}{recovery}", file=sys.stderr)


def _validate_worktree_for_commit(intent: LedgerCommitIntent) -> tuple[bool, str]:
    return _validate_ledger_paths(intent.findings, intent.decisions)


def _run_ledger_hook(
    root: Path, environment: dict[str, str]
) -> tuple[bool, bool, str]:
    """Run the repository pre-commit hook on the private index."""
    git = shutil.which("git") or "/usr/bin/git"
    process = subprocess.Popen(
        [git, "hook", "run", "--ignore-missing", "pre-commit"],
        cwd=root,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    term_sent = False
    kill_sent = False
    stdout = ""
    stderr = ""

    def stream_text(value: object) -> str:
        if isinstance(value, bytes):
            return value.decode("utf-8", errors="replace")
        return value if isinstance(value, str) else ""

    def group_alive() -> bool:
        try:
            os.killpg(process.pid, 0)
        except ProcessLookupError:
            return False
        except OSError:
            # Permission errors and an indeterminate group state fail closed:
            # never assume a descendant is gone before releasing the ledger lock.
            return True
        return True

    def terminate_group() -> None:
        nonlocal term_sent
        if term_sent:
            return
        term_sent = True
        with suppress(OSError):
            os.killpg(process.pid, signal.SIGTERM)

    def remember_partial(exc: subprocess.TimeoutExpired) -> None:
        nonlocal stdout, stderr
        partial_stdout = getattr(exc, "output", None)
        partial_stderr = getattr(exc, "stderr", None)
        if partial_stdout is not None:
            stdout = stream_text(partial_stdout)
        if partial_stderr is not None:
            stderr = stream_text(partial_stderr)

    def wait_for_group_grace() -> None:
        """Wait until the group exits or the full TERM grace has elapsed."""
        nonlocal stdout, stderr
        deadline = time.monotonic() + LEDGER_HOOK_TERM_GRACE_SECONDS
        while group_alive():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            try:
                stdout, stderr = process.communicate(
                    timeout=min(remaining, LEDGER_LOCK_RETRY_INTERVAL_SECONDS)
                )
            except subprocess.TimeoutExpired as exc:
                remember_partial(exc)
            remaining = deadline - time.monotonic()
            if remaining > 0:
                time.sleep(min(LEDGER_LOCK_RETRY_INTERVAL_SECONDS, remaining))
        if not group_alive() and process.poll() is not None:
            stdout, stderr = process.communicate()

    try:
        stdout, stderr = process.communicate(timeout=LEDGER_HOOK_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired as exc:
        remember_partial(exc)
        terminate_group()
    else:
        if group_alive():
            # The direct hook exited before the normal timeout, but a descendant
            # still owns the session. Give the group the same TERM/grace/KILL
            # treatment before considering the hook complete.
            terminate_group()
    if term_sent:
        # communicate() can return as soon as the direct process exits while a
        # detached descendant still owns the group. The grace is therefore
        # measured from the TERM signal and checked independently of pipes.
        wait_for_group_grace()
        if group_alive():
            kill_sent = True
            with suppress(OSError):
                os.killpg(process.pid, signal.SIGKILL)
            stdout, stderr = process.communicate()
    if term_sent:
        detail = "\n".join(
            part.strip()
            for part in (stream_text(stderr), stream_text(stdout))
            if part.strip()
        )
        if detail:
            sys.stderr.write(detail + "\n")
        return False, kill_sent, (
            "pre-commit hook refused the ledger commit: timeout"
            + (f"; {detail}" if detail else "")
        )
    output = "\n".join(
        part for part in (stream_text(stdout), stream_text(stderr)) if part
    )
    if output:
        sys.stderr.write(output)
        if not output.endswith("\n"):
            sys.stderr.write("\n")
    if process.returncode != 0:
        return False, kill_sent, "pre-commit hook refused the ledger commit"
    return True, kill_sent, ""


def _commit_blob(
    root: Path,
    relative: str,
    scratch: Path | None,
    content: bytes | None,
) -> tuple[str | None, str | None]:
    """Hash one exact ledger byte string into the object store."""
    try:
        saved_bytes = scratch.read_bytes() if scratch is not None else content or b""
    except (OSError, UnicodeError) as exc:
        return None, f"could not read saved bytes for {relative}: {exc}"
    if scratch is not None:
        result = _git_for_ledger(
            root, "hash-object", "-w", "--path", relative, str(scratch)
        )
    else:
        result = _git_for_ledger_env(
            root,
            os.environ.copy(),
            "hash-object",
            "-w",
            "--path",
            relative,
            "--stdin",
            stdin=content or b"",
        )
    if result.returncode != 0:
        return None, _git_failure_detail(result)
    blob = result.stdout.strip()
    if isinstance(blob, bytes):
        blob = blob.decode("ascii", errors="replace")
    if SHA256_RE.fullmatch(blob) is None and not re.fullmatch(r"[0-9a-f]{40,64}", blob):
        return None, "git hash-object returned an invalid object id"
    stored = _git_for_ledger_bytes(root, "cat-file", "blob", blob)
    if stored.returncode != 0:
        detail = (stored.stderr or stored.stdout).decode("utf-8", errors="replace")
        detail = detail.strip().replace("\n", "; ")
        return None, (
            f"{LEDGER_BLOB_READ_FAILURE_CAUSE}:{relative}: "
            f"{detail or f'git exited {stored.returncode} without a diagnostic'}"
        )
    if stored.stdout != saved_bytes:
        return None, (
            f"{LEDGER_BLOB_BYTES_MISMATCH_CAUSE}:{relative}: "
            "stored blob differs from saved bytes"
        )
    return blob, None


def _head_file_mode(root: Path, commit: str, relative: str) -> str:
    result = _git_for_ledger(root, "ls-tree", commit, "--", relative)
    if result.returncode != 0:
        raise LedgerError(f"could not inspect HEAD tree: {_git_failure_detail(result)}")
    fields = result.stdout.rstrip("\n").split(None, 2)
    actual_path = fields[2].split("\t", 1)[1] if len(fields) >= 3 and "\t" in fields[2] else ""
    if len(fields) < 3 or actual_path != relative:
        raise LedgerError(f"ledger path {relative} is not tracked in HEAD")
    return fields[0]


def _head_file_blob(root: Path, commit: str, relative: str) -> str | None:
    """Return one tracked ledger blob from a named commit, if present."""
    result = _git_for_ledger(root, "ls-tree", commit, "--", relative)
    if result.returncode != 0:
        raise LedgerError(f"could not inspect HEAD tree: {_git_failure_detail(result)}")
    for line in result.stdout.splitlines():
        fields = line.split(None, 2)
        if len(fields) < 3 or "\t" not in fields[2]:
            continue
        blob, actual_path = fields[2].split("\t", 1)
        if actual_path == relative:
            return blob
    return None


def _ledger_superseded_error(
    root: Path, intent: LedgerCommitIntent, current_head: str
) -> LedgerSupersededError | None:
    """Detect a foreign ledger replacement since this command's write."""
    if intent.head_at_write is None or intent.head_at_write == current_head:
        return None
    paths = [intent.ledger]
    if intent.companion is not None:
        paths.append(intent.companion)
    changed: list[str] = []
    for path in paths:
        relative = _repo_relative(_resolved_repo_path(path), root)
        before = _head_file_blob(root, intent.head_at_write, relative)
        after = _head_file_blob(root, current_head, relative)
        if before != after:
            changed.append(relative)
    if not changed:
        return None
    return LedgerSupersededError(
        f"ledger superseded: HEAD moved from {intent.head_at_write} to "
        f"{current_head}; ledger blob changed for {', '.join(changed)}"
    )


def _refresh_ledger_index(
    root: Path, relative_modes_blobs: list[tuple[str, str, str]]
) -> tuple[bool, str]:
    """Refresh only ledger index entries, preserving unrelated staged work."""
    last = "index refresh not attempted"
    for attempt in range(LEDGER_INDEX_REFRESH_ATTEMPTS):
        last_result: subprocess.CompletedProcess[str] | None = None
        for relative, mode, blob in relative_modes_blobs:
            last_result = _git_for_ledger(
                root,
                "update-index",
                "--add",
                "--cacheinfo",
                f"{mode},{blob},{relative}",
            )
            if last_result.returncode != 0:
                break
        if last_result is None or last_result.returncode == 0:
            return True, ""
        last = _git_failure_detail(last_result)
        if "index.lock" not in last and "index.lock" not in (last_result.stderr or ""):
            break
        if attempt < LEDGER_INDEX_REFRESH_ATTEMPTS - 1:
            time.sleep(LEDGER_COMMIT_RETRY_SECONDS)
    return False, last


def _attempt_ledger_commit(
    intent: LedgerCommitIntent,
    *,
    lock_held: bool = False,
    warn: bool = True,
    require_worktree_match: bool = False,
) -> LedgerCommitResult:
    """Commit exactly the command's bytes through a hooked temporary index."""
    if not intent.replaced or os.environ.get(LEDGER_COMMIT_ENV) == "0":
        return LedgerCommitResult(False)
    scratch = _save_ledger_commit_scratch(intent)
    companion_scratch = (
        _save_ledger_commit_scratch(
            intent,
            path=intent.companion,
            content=intent.companion_bytes,
            suffix="companion-",
        )
        if intent.companion is not None
        else None
    )

    installed_head = ""

    def failed(cause: str, *, durable_head: str = "",
               phase: str = "before-update-ref") -> LedgerCommitResult:
        # An unborn repository has no HEAD to preserve yet.  The mutation
        # remains successful and the untracked ledger is intentionally skipped;
        # emitting the normal recovery warning would turn that supported setup
        # into a false durability alarm.
        unborn_head = (intent.head_at_write is None
                       and cause.startswith("commit helper failed: could not resolve HEAD:"))
        if warn and not unborn_head:
            _warn_ledger_commit(
                intent, cause, scratch, companion_scratch, durable_head=durable_head)
        return LedgerCommitResult(False, cause, durable_head, phase)

    root = cast(Path, REPO_ROOT).resolve()
    lock = ledger_lock_path(_resolved_repo_path(intent.ledger))
    acquired_here = False
    temp_index: Path | None = None
    try:
        if not lock_held:
            acquired, waited = acquire_ledger_lock(lock, LEDGER_LOCK_WAIT_SECONDS)
            if not acquired:
                return failed(
                    f"ledger lock {lock}: another ledger writer still holds it after "
                    f"{waited:.2f}s of retries"
                )
            acquired_here = True
        paths = [intent.ledger]
        if intent.companion is not None:
            paths.append(intent.companion)
        relatives = [_repo_relative(_resolved_repo_path(path), root) for path in paths]
        tracked = _git_for_ledger(root, "ls-files", "--error-unmatch", "--", relatives[0])
        if tracked.returncode == 1:
            _safe_discard_scratch(scratch)
            _safe_discard_scratch(companion_scratch)
            try:
                durable_head = _resolve_head(root)
            except LedgerError:
                durable_head = ""
            return LedgerCommitResult(True, durable_head=durable_head)
        if tracked.returncode != 0:
            return failed(f"fatal tracked-file probe: {_git_failure_detail(tracked)}")
        if intent.companion is not None:
            companion_tracked = _git_for_ledger(
                root, "ls-files", "--error-unmatch", "--", relatives[1]
            )
            if companion_tracked.returncode != 0:
                if companion_tracked.returncode == 1:
                    return failed(f"companion ledger is untracked: {relatives[1]}")
                return failed(
                    f"fatal tracked-file probe: {_git_failure_detail(companion_tracked)}"
                )

        dirty = _git_for_ledger(root, "diff", "--quiet", "HEAD", "--", *relatives)
        if dirty.returncode not in {0, 1}:
            return failed(f"fatal HEAD dirtiness probe: {_git_failure_detail(dirty)}")

        expected_bytes = [intent.written_bytes]
        scratch_paths = [scratch]
        if intent.companion is not None:
            expected_bytes.append(intent.companion_bytes)
            scratch_paths.append(companion_scratch)
        for path, expected, saved in zip(paths, expected_bytes, scratch_paths, strict=True):
            if expected is None and saved is None:
                return failed(f"no exact bytes were recorded for {path}")
            if require_worktree_match:
                try:
                    actual = _resolved_repo_path(path).read_bytes()
                    saved_bytes = saved.read_bytes() if saved is not None else expected or b""
                except (OSError, UnicodeError) as exc:
                    return failed(f"could not read exact ledger bytes for {path}: {exc}")
                if actual != saved_bytes:
                    return failed(
                        f"worktree ledger differs from the exact bytes written by {intent.command}"
                    )

        if require_worktree_match:
            valid, validation_detail = _validate_worktree_for_commit(intent)
            if not valid:
                return failed(f"ledger validation refused the commit: {validation_detail}")

        current_head = _resolve_head(root)
        old_head = intent.expected_head or current_head
        if intent.expected_head is not None and current_head != intent.expected_head:
            return failed(f"HEAD is {current_head}, not {intent.expected_head}")

        # A no-op consumer mutation has no semantic postcondition to evaluate.
        # If its exact saved bytes already occupy HEAD, that is durable and must
        # not turn into an empty commit merely because the write was observed.
        if intent.postcondition is None:
            exact_head = True
            for relative, saved, expected in zip(
                relatives, scratch_paths, expected_bytes, strict=True
            ):
                try:
                    expected_content = (
                        saved.read_bytes() if saved is not None else expected or b""
                    )
                except (OSError, UnicodeError) as exc:
                    return failed(f"could not read exact ledger bytes for {relative}: {exc}")
                shown = _git_for_ledger(root, "show", f"{old_head}:{relative}")
                if (
                    shown.returncode != 0
                    or shown.stdout.encode("utf-8") != expected_content
                ):
                    exact_head = False
                    break
            if exact_head:
                _safe_discard_scratch(scratch)
                _safe_discard_scratch(companion_scratch)
                return LedgerCommitResult(True, durable_head=old_head)

        # The worktree may have returned to its old HEAD bytes after this
        # command's replacement, or may have moved independently while the
        # command's exact bytes are already represented in HEAD. Semantic
        # durability is checked independently of the dirtiness probe: foreign
        # worktree contents never suppress a saved commit, and an effect already
        # proven in HEAD never receives an empty commit.
        holds, detail = _head_postcondition(intent)
        if holds:
            _safe_discard_scratch(scratch)
            _safe_discard_scratch(companion_scratch)
            return LedgerCommitResult(True, durable_head=old_head)
        superseded = _ledger_superseded_error(root, intent, current_head)
        if superseded is not None:
            return failed(str(superseded))

        try:
            temp_index = _create_temporary_git_index()
        except OSError as exc:
            return failed(f"could not create temporary git index: {exc}")
        environment = os.environ.copy()
        environment["GIT_INDEX_FILE"] = str(temp_index)
        read_tree = _git_for_ledger_env(root, environment, "read-tree", old_head)
        if read_tree.returncode != 0:
            return failed(f"temporary index read-tree failed: {_git_failure_detail(read_tree)}")
        modes_blobs: list[tuple[str, str, str]] = []
        for relative, saved, expected in zip(relatives, scratch_paths, expected_bytes, strict=True):
            blob, error = _commit_blob(root, relative, saved, expected)
            if blob is None:
                return failed(f"hash-object failed for {relative}: {error}")
            mode = _head_file_mode(root, old_head, relative)
            update = _git_for_ledger_env(
                root,
                environment,
                "update-index",
                "--add",
                "--cacheinfo",
                f"{mode},{blob},{relative}",
            )
            if update.returncode != 0:
                return failed(f"temporary index update failed: {_git_failure_detail(update)}")
            modes_blobs.append((relative, mode, blob))
        hooked, killed, hook_detail = _run_ledger_hook(root, environment)
        if not hooked:
            if killed:
                hook_output = hook_detail
                stash_match = re.search(
                    r"Stashing unstaged files to (?P<path>[^\n]+?)(?:\.\s|\.$|\n|$)",
                    hook_output,
                )
                if stash_match is not None:
                    stash_path = stash_match.group("path").rstrip(".")
                    if f"Restored changes from {stash_path}" not in hook_output:
                        hook_detail += (
                            f"; unstaged changes left in {stash_path}; restore with: "
                            f"git apply {stash_path}"
                        )
            return failed(hook_detail)
        for relative, _mode, blob in modes_blobs:
            observed = _git_for_ledger_env(root, environment, "rev-parse", f":{relative}")
            if observed.returncode != 0 or observed.stdout.strip() != blob:
                return failed(
                    f"pre-commit hook changed exact ledger bytes for {relative}"
                )
        tree = _git_for_ledger_env(root, environment, "write-tree")
        if tree.returncode != 0:
            return failed(f"temporary index write-tree failed: {_git_failure_detail(tree)}")
        commit = _git_for_ledger(
            root,
            "commit-tree",
            tree.stdout.strip(),
            "-p",
            old_head,
            stdin=(intent.subject or "docs(findings): commit the verified ledger bytes") + "\n",
        )
        if commit.returncode != 0:
            return failed(f"commit-tree failed: {_git_failure_detail(commit)}")
        new_head = commit.stdout.strip()
        head_ref = _git_for_ledger(root, "symbolic-ref", "-q", "HEAD")
        if head_ref.returncode != 0 or not head_ref.stdout.strip():
            return failed("detached HEAD cannot receive an exact ledger commit")
        update_ref = _git_for_ledger(
            root, "update-ref", head_ref.stdout.strip(), new_head, old_head
        )
        if update_ref.returncode != 0:
            holds, detail = _head_postcondition(intent)
            if holds:
                durable_head = _resolve_head(root)
                _safe_discard_scratch(scratch)
                _safe_discard_scratch(companion_scratch)
                return LedgerCommitResult(
                    True, durable_head=durable_head, phase="before-update-ref")
            return failed(
                f"HEAD moved during commit: {_git_failure_detail(update_ref)}",
                phase="before-update-ref")
        installed_head = new_head
        refreshed, refresh_detail = _refresh_ledger_index(root, modes_blobs)
        if not refreshed:
            return failed(
                f"ledger commit is durable but index refresh failed: {refresh_detail}",
                durable_head=new_head, phase="after-update-ref")
        holds, detail = _head_postcondition(intent)
        if not holds:
            return failed(detail, durable_head=new_head, phase="after-update-ref")
        _safe_discard_scratch(scratch)
        _safe_discard_scratch(companion_scratch)
        return LedgerCommitResult(True, durable_head=new_head, phase="after-update-ref")
    except (LedgerError, OSError, UnicodeError, ValueError) as exc:
        return failed(
            f"commit helper failed: {exc}",
            durable_head=installed_head,
            phase="after-update-ref" if installed_head else "before-update-ref",
        )
    finally:
        if temp_index is not None:
            with suppress(OSError):
                temp_index.unlink()
        if acquired_here:
            release_ledger_lock(lock)


def _print_commit_metadata(result: LedgerCommitResult | None = None,
                           *, phase: str = "before-update-ref", sha: str = "",
                           stream: object | None = None) -> None:
    """State the writer phase and durable head on every commit-ledger exit."""
    if result is not None:
        phase = result.phase
        sha = result.durable_head
    output = sys.stdout if stream is None else stream
    print(f"phase={phase}", file=output)
    if sha:
        print(f"sha={sha}", file=output)


def cmd_commit_ledger(args: argparse.Namespace) -> int:
    """Commit an expected ledger snapshot while holding the writer lock."""
    ledger = _resolved_repo_path(args.ledger)
    expected_path = _resolved_repo_path(args.expected)
    lock = ledger_lock_path(ledger)
    try:
        acquired, waited = acquire_ledger_lock(lock, LEDGER_LOCK_WAIT_SECONDS)
        if not acquired:
            _print_commit_metadata(phase="before-update-ref")
            print(
                f"FAIL ledger lock {lock}: another ledger writer still holds it "
                f"after {waited:.2f}s of retries",
                file=sys.stderr,
            )
            return 1
        try:
            actual_head = _resolve_head(cast(Path, REPO_ROOT).resolve())
            if actual_head != args.expected_head:
                _print_commit_metadata(phase="before-update-ref")
                print(
                    f"FAIL HEAD is {actual_head}, not --expected-head {args.expected_head}",
                    file=sys.stderr,
                )
                return 1
            expected_bytes = expected_path.read_bytes()
            if ledger.read_bytes() != expected_bytes:
                _print_commit_metadata(phase="before-update-ref")
                print(
                    f"FAIL worktree ledger differs from --expected {expected_path}",
                    file=sys.stderr,
                )
                return 1
            is_decisions = ledger == _resolved_repo_path(args.decisions)
            intent = LedgerCommitIntent(
                command="commit-ledger",
                ledger=ledger,
                findings=_resolved_repo_path(args.ledger),
                decisions=_resolved_repo_path(args.decisions),
                subject=args.subject
                or "docs(findings): commit the verified ledger bytes",
                expected_head=args.expected_head,
                postcondition=_ledger_bytes_postcondition(
                    None if is_decisions else expected_bytes,
                    expected_bytes if is_decisions else None,
                ),
                replaced=True,
                written_bytes=expected_bytes,
            )
            result = _attempt_ledger_commit(
                intent, lock_held=True, require_worktree_match=True
            )
            if not result.durable:
                _print_commit_metadata(result)
                print(f"FAIL {result.cause or 'ledger commit failed'}", file=sys.stderr)
                return 1
            _print_commit_metadata(result)
            return 0
        finally:
            release_ledger_lock(lock)
    except (LedgerError, OSError, UnicodeError, ValueError) as exc:
        _print_commit_metadata(phase="before-update-ref")
        print(f"FAIL {exc}", file=sys.stderr)
        return 1


def build_parser() -> argparse.ArgumentParser:
    """The complete CLI; a test walks its subcommand table."""
    parser = argparse.ArgumentParser(
        description="Query and validate the findings ledger (tasks/findings.md)."
    )
    parser.add_argument("--ledger", type=Path, default=None, help=argparse.SUPPRESS)
    parser.add_argument("--decisions", type=Path, default=None, help=argparse.SUPPRESS)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser(
        "check", help="validate every header and the decisions ledger's ids"
    ).set_defaults(func=cmd_check)
    sub.add_parser(
        "drain-status",
        help="exit 0 if a drain holds this repo's lock, 1 otherwise",
    ).set_defaults(func=cmd_drain_status)

    p_list = sub.add_parser("list", help="print findings")
    p_list.add_argument("--open", action="store_true", help="only status=open")
    p_list.add_argument("--area")
    p_list.add_argument("--root")
    p_list.add_argument(
        "--json",
        action="store_true",
        help="print a JSON array of findings on stdout; warnings stay on stderr",
    )
    p_list.add_argument(
        "--body",
        action="store_true",
        help="include unfenced body text and verified body digest in JSON",
    )
    p_list.add_argument(
        "--strict",
        action="store_true",
        help="exit 1 without output when validation finds a problem",
    )
    p_list.add_argument(
        "--raw",
        action="store_true",
        help="include exact source-byte entry digests and section headings in JSON",
    )
    p_list.set_defaults(func=cmd_list)

    p_summary = sub.add_parser(
        "summary", help="print counts, who is waiting, and what is drainable"
    )
    p_summary.add_argument(
        "--json",
        action="store_true",
        help="print the versioned summary object on stdout; warnings stay on stderr",
    )
    p_summary.add_argument("--inbox", type=Path, default=None, help=argparse.SUPPRESS)
    p_summary.set_defaults(func=cmd_summary)

    p_next = sub.add_parser("next", help="print the highest-ranked pickable cluster")
    p_next.add_argument("--pin", help="force this finding's cluster")
    p_next.add_argument(
        "--json",
        action="store_true",
        help="print a JSON object for the pick on stdout; warnings stay on stderr",
    )
    p_next.add_argument(
        "--exclude",
        action="append",
        default=[],
        metavar="root:<slug>|finding:<id>",
        help="exclude a cluster by its root slug or singleton finding id; repeatable",
    )
    p_next.add_argument(
        "--entry",
        choices=("build",),
        help="select the first remaining cluster at the effective build tier",
    )
    p_next.set_defaults(func=cmd_next)

    p_rel = sub.add_parser("related", help="findings sharing an area or a file")
    p_rel.add_argument("--area")
    p_rel.add_argument("--file", action="append", help="repeatable")
    p_rel.add_argument("--inbox", type=Path, default=None, help=argparse.SUPPRESS)
    p_rel.set_defaults(func=cmd_related)

    p_file = sub.add_parser(
        "file", help="publish one pending finding entry through the inbox spool"
    )
    p_file.add_argument(
        "entry", type=Path, help="path to one complete ### finding entry"
    )
    p_file.add_argument("--inbox", type=Path, default=None, help=argparse.SUPPRESS)
    p_file.add_argument(
        "--again",
        action="store_true",
        help="deliberately file byte-identical entry content again",
    )
    p_file.add_argument(
        "--spool-only",
        action="store_true",
        help="publish the entry without consulting the drain lock or merging",
    )
    p_file.add_argument(
        "--status",
        action="store_true",
        help="print the content-derived filing receipt state without writing",
    )
    p_file.set_defaults(func=cmd_file)

    p_merge = sub.add_parser("merge-inbox", help="fold the inbox into the ledger")
    p_merge.add_argument("--inbox", type=Path, default=None, help=argparse.SUPPRESS)
    p_merge.set_defaults(func=cmd_merge_inbox)

    p_finalize = sub.add_parser(
        "finalize-claims", help="release prepared claims proven durable in HEAD"
    )
    p_finalize.add_argument("--inbox", type=Path, default=None, help=argparse.SUPPRESS)
    p_finalize.add_argument("--answers", type=Path, default=None, help=argparse.SUPPRESS)
    p_finalize.set_defaults(func=cmd_finalize_claims)

    p_dec = sub.add_parser(
        "decisions", help="print Felix-facing blockers waiting on Felix"
    )
    p_dec.add_argument("ids", nargs="*", help="only these findings (default: all)")
    p_dec.set_defaults(func=cmd_decisions)

    p_answers = sub.add_parser(
        "apply-answers", help="fold answered decisions in and unblock them"
    )
    p_answers.add_argument("--answers", type=Path, default=None, help=argparse.SUPPRESS)
    p_answers.add_argument("--hold-consumer-lock", action="store_true", help=argparse.SUPPRESS)
    p_answers.set_defaults(func=cmd_apply_answers)

    p_answer = sub.add_parser(
        "answer", help="publish one answer atomically through the answers spool"
    )
    p_answer.add_argument("id")
    p_answer.add_argument("--actor", required=True)
    p_answer.add_argument("--verdict", choices=("approve", "reject"))
    p_answer.add_argument("--reason", default="")
    p_answer.add_argument("--decision")
    p_answer.add_argument("--answers", type=Path, default=None, help=argparse.SUPPRESS)
    p_answer.set_defaults(func=cmd_answer)

    p_commit = sub.add_parser(
        "commit-ledger", help=argparse.SUPPRESS
    )
    p_commit.add_argument("--expected", type=Path, required=True, help=argparse.SUPPRESS)
    p_commit.add_argument("--expected-head", required=True, help=argparse.SUPPRESS)
    p_commit.add_argument("--subject", default=None, help=argparse.SUPPRESS)
    p_commit.set_defaults(func=cmd_commit_ledger)

    p_header = sub.add_parser(
        "set-header", help="update selected finding header fields"
    )
    p_header.add_argument("id")
    p_header.add_argument("--status", choices=sorted(STATUSES))
    p_header.add_argument("--blocked")
    p_header.add_argument("--root")
    p_header.add_argument("--entry", choices=sorted(ENTRIES))
    p_header.set_defaults(func=cmd_set_header)

    p_annotate = sub.add_parser("annotate", help="append file contents to a finding")
    p_annotate.add_argument("id")
    p_annotate.add_argument("file", type=Path)
    p_annotate.add_argument(
        "--request-id", help="stable caller identity for one intentional repeat"
    )
    p_annotate.set_defaults(func=cmd_annotate)

    p_record = sub.add_parser(
        "record-decision", help="append decisions through the decisions ledger lock"
    )
    p_record.add_argument("file", type=Path)
    p_record.add_argument("--section")
    p_record.add_argument(
        "--request-id", help="stable caller identity for one intentional repeat"
    )
    p_record.set_defaults(func=cmd_record_decision)

    p_trailer = sub.add_parser(
        "set-trailer",
        help="set decision supersession references under the ledger lock, "
        "adding the trailer to an entry that has none",
    )
    p_trailer.add_argument("id")
    p_trailer.add_argument("--superseded-by", nargs="+", required=True)
    p_trailer.set_defaults(func=cmd_set_trailer)

    p_driver = sub.add_parser(
        "merge-driver",
        help="git merge driver for the append-only ledgers (%%O %%A %%B %%P)",
    )
    p_driver.add_argument("base", type=Path)
    p_driver.add_argument("ours", type=Path)
    p_driver.add_argument("theirs", type=Path)
    p_driver.add_argument("path")
    p_driver.set_defaults(func=cmd_merge_driver)

    return parser


def main(argv: list[str] | None = None) -> int:
    global _ACTIVE_LEDGER_COMMIT
    parser = build_parser()
    args = parser.parse_args(argv)
    root = _require_git_toplevel()
    if _plan_only_refuses(args):
        return 3
    _bind_repo_root(root)
    if args.ledger is None:
        args.ledger = LEDGER
    if args.decisions is None:
        # The two ledgers are a pair: an explicit ``--ledger`` pairs with the
        # decisions file beside it, never with the repository's own. Mixing a
        # fixture findings ledger with the real decisions ledger made every
        # cross-ledger citation check report the real ledger's ids as missing.
        args.decisions = args.ledger.parent / "decisions.md"
    if getattr(args, "inbox", None) is None and hasattr(args, "inbox"):
        args.inbox = INBOX
    if getattr(args, "answers", None) is None and hasattr(args, "answers"):
        args.answers = ANSWERS
    if args.command == "file" and bool(getattr(args, "status", False)):
        try:
            return cmd_file_status(args)
        except (LedgerError, OSError, UnicodeDecodeError) as exc:
            print(f"FAIL {exc}", file=sys.stderr)
            return 1
    if args.command == "set-header" and not any(
        value is not None
        for value in (args.status, args.blocked, args.root, args.entry)
    ):
        parser.error("set-header requires at least one field option")
    intent: LedgerCommitIntent | None = None
    if args.command in LEDGER_COMMIT_COMMANDS:
        target = (
            args.decisions
            if args.command in {"record-decision", "set-trailer"}
            else args.ledger
        )
        intent = LedgerCommitIntent(
            command=args.command,
            ledger=target,
            findings=args.ledger,
            decisions=args.decisions,
        )
        _ACTIVE_LEDGER_COMMIT = intent
    # Filing and answer consumers keep their shared lock until the automatic
    # exact-byte commit attempt finishes in the outer ``finally`` block.
    args._hold_consumer_lock = args.command == "file" or (
        args.command == "apply-answers"
        and bool(getattr(args, "hold_consumer_lock", False))
    )
    command_result: int = 1
    try:
        try:
            command_result = args.func(args)
        except (LedgerError, OSError, UnicodeDecodeError) as exc:
            print(f"FAIL {exc}", file=sys.stderr)
            command_result = (
                2
                if isinstance(exc, (PublishLockBusyError, LedgerDirtyError))
                else 1
            )
    finally:
        _ACTIVE_LEDGER_COMMIT = None
        if intent is not None:
            try:
                commit_result = _attempt_ledger_commit(
                    intent,
                    warn=not (
                        args.command == "apply-answers"
                        and bool(getattr(args, "hold_consumer_lock", False))
                    ),
                )
                if (
                    args.command == "apply-answers"
                    and bool(getattr(args, "hold_consumer_lock", False))
                    and intent.replaced
                    and not commit_result.durable
                    and os.environ.get(LEDGER_COMMIT_ENV) != "0"
                ):
                    if commit_result.durable_head:
                        _warn_ledger_commit(
                            intent,
                            commit_result.cause,
                            _save_ledger_commit_scratch(intent),
                            durable_head=commit_result.durable_head,
                        )
                        command_result = 3
                    else:
                        retry = _attempt_ledger_commit(intent, warn=False)
                        if retry.durable:
                            commit_result = retry
                        else:
                            _warn_ledger_commit(
                                intent,
                                retry.cause or commit_result.cause,
                                _save_ledger_commit_scratch(intent),
                                durable_head=retry.durable_head,
                            )
                            if "worktree ledger differs" in (retry.cause or ""):
                                command_result = 2
                            else:
                                print("ledger applied, commit failed", file=sys.stderr)
                                command_result = 3
                if (
                    commit_result.durable
                    and intent.finalize is not None
                ):
                    try:
                        finalization = intent.finalize()
                    except Exception as exc:  # noqa: BLE001
                        finalization = f"exception: {exc}"
                    if finalization not in {"finalized", "none"}:
                        claim = _resolved_repo_path(intent.claim) if intent.claim else "(unknown claim)"
                        ledger = _resolved_repo_path(intent.ledger)
                        decisions = _resolved_repo_path(intent.decisions)
                        spool = (
                            claim.parent / intent.claim.name.removesuffix(".claim")
                            if intent.claim
                            else "(unknown spool)"
                        )
                        inbox = INBOX if intent.command == "apply-answers" else spool
                        writer = Path(__file__).resolve()
                        answers_option = (
                            f" --answers {_resolved_repo_path(spool)}"
                            if intent.command == "apply-answers"
                            else ""
                        )
                        print(
                            f"WARNING the ledger write for {ledger} after {intent.command} "
                            f"is durable, but the claim at {claim} was not finalised: "
                            f"{finalization}; run {writer} --ledger {ledger} "
                            f"--decisions {decisions} finalize-claims --inbox {inbox}"
                            f"{answers_option}",
                            file=sys.stderr,
                        )
            except Exception as exc:  # noqa: BLE001
                # This is the final status-transparency boundary: arbitrary
                # consumer hooks and diagnostics must never replace the command's
                # return value, SystemExit, or unexpected exception.
                with suppress(OSError, UnicodeError):
                    _warn_ledger_commit(
                        intent, f"unexpected commit helper failure: {exc}", None
                    )
        _release_consumer_lock(args)
    return command_result


if __name__ == "__main__":
    raise SystemExit(main())
