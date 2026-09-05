#!/usr/bin/env python3
# agent-kit-sha256: 14d4d541219265d27fa7d0132165d8548279d01852f7aeb23a8b9a8338c87d75
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
identical across projects.** Everything project-specific is read from the ledger:
the area vocabulary from its header, the governing decisions from the sibling
``decisions.md``. Nothing project-specific may be added below.

Subcommands
-----------
``check``        validate every header and the sibling decisions ledger's ids;
                 exit 1 on any violation
``list``         print findings, optionally filtered
``next``         print the highest-ranked pickable cluster, the decisions governing it,
                 and separately the ones merely touching its files
``related``      print findings sharing an area or naming the same files
``file``         publish one new finding entry through the inbox spool
``merge-inbox``  fold findings filed during a drain into the ledger
``decisions``    print Felix-facing blockers waiting on Felix
``apply-answers`` fold his answers back in and unblock what he decided
``drain-status`` exit 0 if a drain holds this repo's lock, 1 otherwise
``set-header``  mutate selected fields of one finding header
``annotate``    append file contents to one finding entry
``record-decision`` append decisions through the decisions ledger lock
"""

from __future__ import annotations

import argparse
import errno
import fcntl
import hashlib
import itertools
import json
import os
import re
import shlex
import shutil
import stat
import subprocess
import sys
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager, suppress
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from pathlib import Path, PurePosixPath

# Named so the formatter cannot rewrite them. `ruff format` at target-version py314
# strips redundant parentheses from an explicit `except (A, B):` tuple literal, which
# is what made the parenthesized form unkeepable here (`d-20260830-26`). A name is a
# single expression with nothing to strip, so it survives the formatter AND parses on
# pre-3.14 interpreters -- both halves are required for the version guard below.
_READ_ERRORS = (OSError, UnicodeError)


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


def _discover_ledger_header() -> tuple[str | None, Path | None, Path | None]:
    """Locate a findings ledger header without using it for ledger paths.

    Cwd git toplevel first (read-only); else this script's ``parents[1]`` for
    HEADER LOOKUP ONLY, so ``--help`` preflights still fail closed on a too-old
    interpreter inside a checkout whose header names a floor.

    An absent file is not a header. A file that exists but cannot be read is
    a malformed header and fails closed (exit 2); it must not fall through to
    a later candidate.
    """
    candidates: list[tuple[Path, Path]] = []
    cwd_root, _err = _probe_git_toplevel()
    if cwd_root is not None:
        candidates.append((cwd_root / "tasks" / "findings.md", cwd_root))
    script_root = Path(__file__).resolve().parents[1]
    script_header = script_root / "tasks" / "findings.md"
    if all(path != script_header for path, _root in candidates):
        candidates.append((script_header, script_root))
    for path, root in candidates:
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            continue
        except _READ_ERRORS as exc:
            sys.stderr.write(
                f"findings.py cannot read the ledger header at {path}: {exc}\n"
            )
            raise SystemExit(2) from exc
        if "**Area vocabulary:**" in text or "**Python floor:**" in text:
            return text, root, path
    return None, None, None


_PYTHON_FLOOR_RE = re.compile(r"\*\*Python floor:\*\*\s*(?P<version>\S+)")
_PYTHON_INTERPRETER_RE = re.compile(r"\*\*Python interpreter:\*\*\s*(?P<path>\S+)")


def _enforce_python_floor() -> None:
    """Exit 2 on a too-old interpreter when a ledger header names a floor.

    Prints Korrigio's exact remedy strings. Never writes. Repos without the
    header lines run on any python3. A header that exists but cannot be read,
    or a ``**Python floor:**`` value that is not MAJOR.MINOR, fails closed
    (exit 2) — including for ``--help``. Runs at startup, before argparse.
    """
    header, header_root, header_path = _discover_ledger_header()
    if header is None:
        return
    header_region = header.split("### ", 1)[0]
    floor_match = _PYTHON_FLOOR_RE.search(header_region)
    if floor_match is None:
        return
    version_text = floor_match.group("version")
    parts = version_text.split(".")
    try:
        floor = tuple(int(part) for part in parts[:2])
    except ValueError:
        floor = ()
    if len(floor) < 2:
        sys.stderr.write(
            f"findings.py cannot parse **Python floor:** {version_text} in "
            f"{header_path}\n"
        )
        raise SystemExit(2)
    if sys.version_info[:2] >= floor:
        return
    _script = Path(__file__).resolve()
    interpreter_match = _PYTHON_INTERPRETER_RE.search(header_region)
    # The interpreter comes from the header only; nothing project-specific
    # (no `backend/.venv` default) is compiled in here.
    _venv_python: Path | None = None
    if interpreter_match is not None:
        named = Path(interpreter_match.group("path"))
        _venv_python = named if named.is_absolute() else (header_root or Path()) / named
    rerun_any = shlex.join([str(_script), *sys.argv[1:]])
    if _venv_python is not None and _venv_python.exists():
        _remedy = "Re-run it with the repository interpreter:\n  " + shlex.join(
            [str(_venv_python), str(_script), *sys.argv[1:]]
        )
    elif _venv_python is not None:
        _remedy = (
            "No interpreter was found at %s.\n"
            "Build it as the repository documents, "
            "or re-run the command below with any Python %s+:\n"
            "  %s" % (_venv_python, version_text, rerun_any)
        )
    else:
        _remedy = "Re-run the command below with any Python %s+:\n  %s" % (
            version_text,
            rerun_any,
        )
    sys.stderr.write(
        "findings.py requires Python %s+ and is running on Python %d.%d (%s).\n"
        "This is this repository's requires-python floor, not a broken file.\n"
        "%s\n"
        % (
            version_text,
            sys.version_info[0],
            sys.version_info[1],
            sys.executable,
            _remedy,
        )
    )
    raise SystemExit(2)


_enforce_python_floor()


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
# A filer publishes first and only then checks this lock. The environment override
# keeps that branch testable without ever consulting the real drain lock.
DRAIN_LOCK_ENV = "FINDINGS_DRAIN_LOCK"
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
NOTIFY_TIMEOUT_S = 10
# Overlay copies on other screens keep `notify show` alive for the duration.
# The subprocess timeout must outlast that wait, or a successful post is killed
# and left unrecorded, so the next named `decisions` toasts again.
NOTIFY_POST_TIMEOUT_S = (NOTIFY_DURATION_MS + 999) // 1000 + 2
# Lets the waiter outlast the overlay-length post timeout plus the state write.
NOTIFY_STATE_WRITE_GRACE_S = 5.0
NOTIFY_TITLE_CHARS = 90
LEDGER_LOCK_RETRY_WINDOW_SECONDS = 1.0
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
# `*`, `-` and `+` are all list bullets in Markdown. Detection and rendering
# must agree on the accepted bullet class or a gated entry can be reported as
# having no Sentry short-ID.
_BULLET = r"[*+-]"
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
FELIX_SENTRY_ORIGIN = "felix-sentry-origin"
ANSWERABLE_BLOCKERS = frozenset({FELIX_DECISION, FELIX_SENTRY_ORIGIN})
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
BLOCKER_CLASSES = frozenset(
    {BLOCKER_NONE, BLOCKER_ANSWERABLE, BLOCKER_PRECONDITION, BLOCKER_EXTERNAL}
)


def classify_blocker(blocked: str) -> str:
    """Classify a blocker without enumerating future Felix-only preconditions."""
    if blocked == BLOCKER_NONE:
        blocker_class = BLOCKER_NONE
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
DECISION_PENDING_RE = re.compile(r"^ {0,3}### (?P<id>d-PENDING) — (?P<question>.+)$")
# Pending headings are recognized separately until the locked allocator mints an id.
DECISION_ID_RE = re.compile(r"d-\d{8}-\d{2}")
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
SUPERSEDED_BY_RE = re.compile(
    r"\*\*Superseded-by:\*\*\s*(?P<quote>`)?"
    r"(?P<id>d-\d{8}-\d{2}|-)(?(quote)`)[.,;:!?]?(?:\s*$|\s+·)"
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
    r"(?P<ids>d-\d{8}-\d{2}(?:,\s*d-\d{8}-\d{2})*)\s*$"
)


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

    @property
    def pickable(self) -> bool:
        return self.status == "open" and classify_blocker(self.blocked) == BLOCKER_NONE

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


@dataclass
class Decision:
    id: str
    question: str
    governs: set[str]
    # The replacement decision named by the trailer, empty while still current.
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


class LedgerError(Exception):
    pass


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
    A span containing only a decision id stays visible because that id can be
    part of an otherwise visible near-miss marker. Unclosed spans remain visible
    to the caller and never consume a later line.
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
            if re.fullmatch(r"\s*d-\d{8}-\d{2}\s*", content):
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


def parse(path: Path = LEDGER) -> tuple[list[Finding], list[str], frozenset[str]]:
    text = path.read_text(encoding="utf-8")
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
                    re.findall(r"d-\d{8}-\d{2}", governed_by.group("ids"))
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
        if blocker_class != BLOCKER_NONE and not SLUG_RE.match(f.blocked):
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
                    "listing one or more d-YYYYMMDD-nn decision ids, comma-separated"
                )

        joined = _unfenced_body(f)
        sentry_origin = _body_is_sentry_origin(joined)
        if (
            f.status == "open"
            and sentry_origin
            and APPROVED_RE.search(joined) is None
            and f.blocked != FELIX_SENTRY_ORIGIN
        ):
            issues.append(
                f"{where}: Sentry-origin open finding without an '**Approved:**' "
                f"bullet must be blocked on {FELIX_SENTRY_ORIGIN}"
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
            pending.governs.update(re.findall(r"f-\d{8}-\d{2}", governs.group("ids")))
        superseded_by = SUPERSEDED_BY_RE.search(line)
        if superseded_by and superseded_by.group("id") != "-":
            pending.superseded_by = superseded_by.group("id")
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
    """Report a supersession trailer that names no parseable decision id.

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
        if (
            SUPERSEDED_BY_MARKER_RE.search(masked_line)
            # Both searches must see the same real text; inline-code examples are not trailers.
            and SUPERSEDED_BY_RE.search(masked_line) is None
        ):
            issues.append(
                f"{decisions_path}:{number}: malformed Superseded-by trailer. "
                "Expected '**Superseded-by:** d-YYYYMMDD-nn' or "
                "'**Superseded-by:** -', optionally backtick-quoted and followed "
                "by punctuation."
            )
    return issues


def _warn_missing_governing_decisions(
    findings: list[Finding], decisions_path: Path
) -> None:
    """Warn about finding-side links whose decision heading is absent.

    The decisions file is optional, so a missing heading is a warning rather than
    a validation error: a repository without decisions must still validate.
    """
    known = {decision.id for decision in load_decisions(decisions_path)}
    for finding in findings:
        for decision_id in sorted(finding.governed_by - known):
            print(
                f"WARN {finding.id} (line {finding.line}): Governed-by decision "
                f"{decision_id} has no matching '### {decision_id} —' heading in "
                f"{decisions_path}; the decisions file is optional.",
                file=sys.stderr,
            )


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


def _warn_problems(problems: list[str], command: str) -> None:
    for problem in problems:
        print(f"WARN {problem}", file=sys.stderr)
    if problems:
        print(
            f"WARN {command} ran against a ledger with {len(problems)} malformed "
            "entr(y/ies); they are missing from this answer. Run `check`.",
            file=sys.stderr,
        )


def _warn_pending_inbox(inbox: Path) -> None:
    """A duplicate check that cannot see the inbox invites the duplicate.

    Entries filed during a drain are not in the ledger yet, so `related` would
    answer "looks new" about something already filed — and the collision only
    surfaces later, as a duplicate id that refuses the whole merge.
    """
    legacy = LEGACY_INBOX if inbox == INBOX else inbox.with_suffix(".md")
    claim = CLAIM if inbox == INBOX else inbox.with_name(f"{inbox.name}.claim")
    sources = sorted(inbox.glob("*.md"))
    # The completeness flag belongs to the sweep, which reports it; here a
    # dropped part only weakens a duplicate warning that is advisory anyway.
    sources += _enumerate_orphan_parts(inbox)[0]
    # A REFUSED batch sits in the claim, outside both the ledger and the spool.
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
    if not pending:
        return
    sources = [p for p, _ in read]
    # Name the directories that actually hold something; `inbox` alone may not
    # even exist when the pending entries are in the claim or at the legacy path.
    where = ", ".join(dict.fromkeys(str(p.parent) for p in sources))
    print(
        f"NOTE {pending} finding(s) are pending in {where} and are not listed "
        "below. Read them before filing.",
        file=sys.stderr,
    )
    if any(p.parent == claim for p in sources):
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


def cmd_check(args: argparse.Namespace) -> int:
    findings, problems, vocabulary = parse(args.ledger)
    issues = validate(findings, problems, vocabulary)
    # The sibling decisions ledger is optional, so its ABSENCE is not a problem —
    # but when it exists its ids are load-bearing for this file, and nothing else
    # validated them. Counted separately so the summary names the file the reader
    # actually has to open; its messages carry their own path for the same reason.
    decision_issues = malformed_decision_headings(args.decisions)
    decision_issues += malformed_superseded_trailers(args.decisions)
    decision_issues += duplicate_decision_ids(args.decisions)
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
    _warn_missing_governing_decisions(findings, args.decisions)
    pickable = sum(1 for f in findings if f.pickable)
    blocked = sum(
        1
        for f in findings
        if f.status == "open" and classify_blocker(f.blocked) != BLOCKER_NONE
    )
    print(f"ok: {len(findings)} findings, {pickable} pickable, {blocked} blocked")
    return 0


def _list_json_records(
    rows: list[Finding], tooling_areas: frozenset[str]
) -> list[dict[str, object]]:
    """One JSON object per finding; field values are the Finding attributes."""
    return [
        {
            "id": f.id,
            "status": f.status,
            "area": f.area,
            "root": f.root,
            "entry": f.entry,
            "blocked": f.blocked,
            "heading": f.title,
            "tooling": f.area in tooling_areas,
        }
        for f in rows
    ]


def cmd_list(args: argparse.Namespace) -> int:
    findings, problems, vocabulary = parse(args.ledger)
    # Full validation, not just parse problems: an entry with an invented area
    # parses fine, so a structural-only warning would let `related` answer
    # "looks new" about a finding that is already recorded.
    _warn_problems(validate(findings, problems, vocabulary), "list")
    rows = findings
    if args.open:
        rows = [f for f in rows if f.status == "open"]
    if args.area:
        rows = [f for f in rows if f.area == args.area]
    if args.root:
        rows = [f for f in rows if f.root == args.root]
    if _json_requested(args):
        return _print_json(
            _list_json_records(rows, load_tooling_areas_from_path(args.ledger))
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


def _unfenced_text(text: str) -> str:
    """Return raw text with fenced lines removed before marker checks."""
    lines = text.splitlines()
    return chr(10).join(
        line
        for line, fence_state in zip(lines, _fence_mask(lines), strict=True)
        if fence_state is FenceState.OUTSIDE
    )


def _print_related_decisions(members: list[Finding], decisions_path: Path) -> None:
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
    governed_by = {decision_id for f in members for decision_id in f.governed_by}
    for f in members:
        governed_by.update(DECISION_ID_RE.findall(_unfenced_body(f)))

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
            f" (SUPERSEDED by {d.superseded_by} — read that one)"
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
    """Leftover blocked rows: (id, slug, title). Shared by text and JSON."""
    return [
        (f.id, f.blocked, f.title)
        for f in findings
        if f.status == "open" and classify_blocker(f.blocked) != BLOCKER_NONE
    ]


def _cluster_entry_and_ids(members: list[Finding]) -> tuple[str, list[str]]:
    """CLUSTER entry= and IDS values, computed once for both renderings."""
    entry = max(members, key=lambda f: ENTRY_RANK[f.entry]).entry
    return entry, [f.id for f in members]


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
        clusters = rank(findings)
        if not clusters:
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
        key, members = clusters[0]
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
    _print_related_decisions(members, args.decisions)
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
def _publish_lock(lock: Path) -> Iterator[None]:
    """Hold a short exclusive fence for one spool's publish window."""
    try:
        fd = os.open(lock, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o644)
    except OSError as exc:
        raise LedgerError(f"could not open publish lock {lock}: {exc}") from exc
    try:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
        except OSError as exc:
            raise LedgerError(f"could not acquire publish lock {lock}: {exc}") from exc
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


def _sweep_scratch(directory: Path) -> None:
    """Remove expired atomic-write scratch files without failing a merge."""
    try:
        entries = list(directory.iterdir())
    except OSError:
        return
    cutoff = time.time() - SCRATCH_GRACE_SECONDS
    for path in entries:
        if ".tmp-" not in path.name and ".candidate-" not in path.name:
            continue
        try:
            if path.stat().st_mtime > cutoff:
                continue
            path.unlink()
        except OSError:
            continue


def _validate_text(candidate: str, near: Path) -> list[str]:
    """Validate ledger text without a scratch path two runs could collide on."""
    try:
        with _candidate_scratch(candidate, near) as scratch:
            if "**Area vocabulary:**" not in candidate.split("### ", 1)[0]:
                return (
                    malformed_decision_headings(scratch)
                    + malformed_superseded_trailers(scratch)
                    + duplicate_decision_ids(scratch)
                )
            findings, problems, vocabulary = parse(scratch)
            return validate(findings, problems, vocabulary)
    except LedgerError as exc:
        return [str(exc)]


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
    """Stamp the approval blocker onto an unapproved Sentry-origin entry.

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
    if (
        finding.status != "open"
        or not _body_is_sentry_origin(body)
        or APPROVED_RE.search(body) is not None
        or finding.blocked == FELIX_SENTRY_ORIGIN
    ):
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
            rf"\g<1>{FELIX_SENTRY_ORIGIN}",
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
        body = _unfenced_body(findings[0])
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
# the resolved lock path. The fd IS the lock -- `flock` is released when it is
# closed or the process dies -- so it has to outlive `acquire_ledger_lock`.
_HELD_LEDGER_LOCKS: dict[str, int] = {}


def acquire_ledger_lock(
    lock: Path, wait_window_seconds: float = LEDGER_LOCK_RETRY_WINDOW_SECONDS
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
    """Write ``candidate`` only if ``path`` still contains ``expected``."""
    current = path.read_text(encoding="utf-8")
    if current != expected:
        raise LedgerError(
            f"ledger {path} changed after it was read; refusing to overwrite it"
        )
    _atomic_write(path, candidate, durable_directory=durable_directory)


def _locked_ledger_mutation(path: Path, build: Callable[[str], str]) -> None:
    """Run one validated, compare-and-swap mutation under the ledger lock."""
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
        original = path.read_text(encoding="utf-8")
        candidate = build(original)
        issues = _validate_text(candidate, path)
        if issues:
            raise LedgerError(
                "the mutation would leave the ledger invalid:\n" + "\n".join(issues)
            )
        _write_if_unchanged(path, original, candidate)
    except LedgerError:
        raise
    except OSError as exc:
        raise LedgerError(f"could not mutate ledger {path}: {exc}") from exc
    except UnicodeError as exc:
        raise LedgerError(f"could not read ledger {path}: {exc}") from exc
    finally:
        release_ledger_lock(lock)


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
    spool: Path, claim: Path, legacy: Path | None = None
) -> list[Path] | None:
    """Take exclusive ownership of a spool's published files, by rename.

    Shared by both spool consumers — the inbox of filed findings and the spool of
    answered decisions. They fold different things into the ledger, but the
    dangerous half is identical, so it lives here once.

    ``os.mkdir`` is the mutex: it is atomic, so two consumers cannot both hold
    the claim and the loser is told rather than quietly reading a batch the
    winner is already consuming. Without it each consumer reads the ledger,
    each writes back only its own mutation, and one batch disappears — and the
    two consumers really do overlap, because the drain applies answers between
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
    if claim.exists():
        return None

    published = sorted(spool.glob("*.md"))
    if legacy is not None and legacy.exists():
        published.append(legacy)
    if not published:
        return []

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

    if not claimed:
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
) -> None:
    payload: dict[str, object] = {"phase": phase}
    if ids is not None:
        payload["ids"] = sorted(ids)
    if receipt_ids is not None:
        payload["receipt_ids"] = dict(sorted(receipt_ids.items()))
    intent = _claim_intent_path(claim)
    serialized = json.dumps(payload, sort_keys=True)
    _atomic_write(intent, serialized, durable_directory=True)


def _remove_claim_intent(claim: Path) -> None:
    _claim_intent_path(claim).unlink(missing_ok=True)
    for scratch in claim.glob(f"{MERGE_INTENT_NAME}.tmp-*"):
        scratch.unlink(missing_ok=True)


def _answer_ids_are_complete(
    ledger_text: str, ids: list[str], claimed: list[Path]
) -> bool:
    """Return whether every claimed answer payload is already in its entry."""
    if len(ids) != len(claimed) or len(set(ids)) != len(ids):
        return False

    answer_bullets: dict[str, list[str]] = {}
    for answer_path in claimed:
        try:
            record = _parse_answer_file(answer_path)
        except (OSError, UnicodeError) as _exc:
            return False
        if record is None:
            return False
        identifier, bullet = record
        if identifier not in ids or identifier in answer_bullets:
            return False
        answer_bullets[identifier] = bullet
    if set(answer_bullets) != set(ids):
        return False

    lines = ledger_text.splitlines()
    fence_states = _fence_mask(lines)
    _, headers, _ = _unfenced_header_matches(ledger_text, fence_states)
    header_indexes = {
        match.group("id"): header_index
        for _heading_index, header_index, match in headers
    }
    for identifier in ids:
        header_index = header_indexes.get(identifier)
        if header_index is None:
            return False
        match = HEADER_RE.match(lines[header_index])
        if (
            match is None
            or classify_blocker(match.group("blocked")) == BLOCKER_ANSWERABLE
        ):
            return False
        end = _find_entry_span(lines, fence_states, header_index)
        entry_bullets = _decision_bullets(lines, fence_states, header_index + 1, end)
        if answer_bullets[identifier] not in entry_bullets:
            return False
    return True


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
    claim: Path, receipt_ids: dict[str, str | dict[str, str]]
) -> list[tuple[str, str, str]]:
    """Reconstruct merged receipts from the durable claim intent."""
    claimed = sorted(claim.glob("*.md"))
    records: list[tuple[str, str, str]] = []
    for filing_key, receipt in receipt_ids.items():
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

    intent_path = _claim_intent_path(claim)
    claimed = sorted(claim.glob("*.md"))
    if not intent_path.exists() and not claimed:
        _remove_claim_intent(claim)
        claim.rmdir()
        return
    if not intent_path.exists():
        raise LedgerError(
            f"a claim at {claim} has no {MERGE_INTENT_NAME}; it predates durable "
            "claim recovery. Restore or inspect it before retrying."
        )
    try:
        record = json.loads(intent_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError) as exc:
        raise LedgerError(f"could not read claim intent {intent_path}: {exc}") from exc

    phase = record.get("phase") if isinstance(record, dict) else None
    if phase not in {"claimed", "prepared"}:
        raise LedgerError(
            f"claim intent {intent_path} has unknown phase {phase!r}; refusing recovery"
        )
    if phase == "prepared":
        ids = record.get("ids") if isinstance(record, dict) else None
        receipt_ids = record.get("receipt_ids") if isinstance(record, dict) else None
        if receipt_ids is not None:
            if not isinstance(receipt_ids, dict) or not all(
                _receipt_intent_key_is_valid(filing_key)
                and (
                    (isinstance(receipt, str) and ID_RE.fullmatch(receipt) is not None)
                    or (
                        isinstance(receipt, dict)
                        and set(receipt)
                        in (
                            {"id", "published"},
                            {"id", "published", "receipt"},
                        )
                        and isinstance(receipt.get("id"), str)
                        and ID_RE.fullmatch(receipt["id"]) is not None
                        and isinstance(receipt.get("published"), str)
                        and bool(receipt["published"])
                        and Path(receipt["published"]).name == receipt["published"]
                        and (
                            "receipt" not in receipt
                            or (
                                isinstance(receipt["receipt"], str)
                                and receipt["receipt"].endswith(".json")
                                and Path(receipt["receipt"]).name == receipt["receipt"]
                            )
                        )
                    )
                )
                for filing_key, receipt in receipt_ids.items()
            ):
                raise LedgerError(
                    f"claim intent {intent_path} has an invalid receipt_ids mapping"
                )
            ids = [
                receipt["id"] if isinstance(receipt, dict) else receipt
                for receipt in receipt_ids.values()
            ]
        if (
            isinstance(ids, list)
            and ids
            and all(isinstance(identifier, str) for identifier in ids)
        ):
            try:
                ledger_text = ledger.read_text(encoding="utf-8")
            except (OSError, UnicodeError) as exc:
                raise LedgerError(
                    f"could not read ledger {ledger} while recovering {claim}: {exc}"
                ) from exc
            current_ids = header_ids(ledger_text)
            complete = all(identifier in current_ids for identifier in ids)
            if answers:
                complete = complete and _answer_ids_are_complete(
                    ledger_text, ids, claimed
                )
            if complete:
                if receipt_ids is not None:
                    _write_merged_receipts(
                        spool, _receipt_records_from_intent(claim, receipt_ids)
                    )
                release_spool(claim, spool, claimed, publish_locked=publish_locked)
                print(
                    f"NOTE completed stranded batch from {claim}; the ledger already "
                    "contains every recorded id",
                    file=sys.stderr,
                )
                return

    # Replay is deliberately ordered: the work returns to the spool first, then
    # the intent and claim disappear. A crash after any one step is restartable.
    spool.mkdir(parents=True, exist_ok=True)
    for path in claimed:
        os.rename(path, spool / path.name)
    _remove_claim_intent(claim)
    claim.rmdir()


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
        f"{LEDGER_LOCK_RETRY_WINDOW_SECONDS:.2f}s).",
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
        sources.append(_normalise_sentry_origin_entry(text, ledger))
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


def merge_inbox(inbox: Path, ledger: Path) -> MergeResult:
    """Run one ledger-locked merge with one nested publication fence."""
    lock = ledger_lock_path(ledger)
    acquired, waited_seconds = acquire_ledger_lock(lock)
    if not acquired:
        return MergeResult(_report_ledger_lock_busy(lock, waited_seconds))

    try:
        with _publish_lock(publish_lock_path(inbox)):
            try:
                return _merge_inbox_publish_locked(inbox, ledger)
            except LedgerError as exc:
                print(f"FAIL {exc}", file=sys.stderr)
                return MergeResult(1)
    finally:
        release_ledger_lock(lock)


def _merge_inbox_publish_locked(inbox: Path, ledger: Path) -> MergeResult:
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

    **A refused batch is never destroyed.** It stays in the fixed claim directory,
    whose path the error names. The directory is also the merger mutex: atomic
    ``mkdir`` prevents two mergers from reading the same ledger and then replacing
    each other's result.

    Validation reuses the normal validator on a merged candidate rather than a
    second parser that could drift from the one deciding what gets worked on.
    """
    legacy = inbox.with_suffix(".md")
    claim = inbox.with_name(f"{inbox.name}.claim")

    _sweep_scratch(ledger.parent)
    _sweep_scratch(inbox)
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
    claimed = claim_spool(inbox, claim, legacy=legacy)
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
    if (claim / legacy.name).exists():
        print(f"NOTE folded legacy findings inbox {legacy}", file=sys.stderr)

    try:
        ledger_text = ledger.read_text(encoding="utf-8")
        sources = _merge_sources(claimed, ledger)
        raw_sources = [
            claimed_path.read_text(encoding="utf-8") for claimed_path in claimed
        ]
    except (OSError, UnicodeDecodeError, LedgerError) as exc:
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
        release_spool(claim, inbox, claimed, publish_locked=True)
        return MergeResult(0)

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
            receipt_path = _allocate_receipt_path(
                inbox,
                receipt_index,
                entry_text,
                path.name,
                identifier,
                allocated_receipt_names,
            )
            if receipt_path.name in allocated_receipt_names:
                raise LedgerError(
                    f"duplicate receipt name {receipt_path.name} was allocated "
                    "to more than one claimed entry"
                )
            allocated_receipt_names.add(receipt_path.name)
            filing_key = (
                path.name if len(entry_records) == 1 else f"{path.name}#{entry_index}"
            )
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
        _write_claim_intent(
            claim,
            "prepared",
            header_ids(body),
            receipt_ids,
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

    try:
        _write_if_unchanged(ledger, ledger_text, candidate, durable_directory=True)
    except (LedgerError, OSError) as exc:
        print(
            f"FAIL {exc}. The ledger may already have changed and the batch is "
            f"preserved at {claim}.",
            file=sys.stderr,
        )
        return MergeResult(1)

    # Receipt finalisation and claim release are one publish transaction. A
    # concurrent `cmd_file` takes this same lock; without it, it can publish
    # after the receipt is written and then rewrite `merged` back to
    # `published` while the claim is still being released.
    _write_merged_receipts(inbox, receipt_records)
    release_spool(claim, inbox, claimed, publish_locked=True)
    # Name the allocated ids: a drain-owned filing session cannot learn them,
    # so the merge output is the place that mapping is recorded.
    allocation = f": {' '.join(assigned)}" if assigned else ""
    print(f"merged {merged} finding(s) from the inbox{allocation}")
    return MergeResult(0, assigned_by_file)


def cmd_merge_inbox(args: argparse.Namespace) -> int:
    """CLI entry point over the shared inbox merge implementation."""
    return merge_inbox(args.inbox, args.ledger).returncode


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


def cmd_file(args: argparse.Namespace) -> int:
    """Publish one pending finding, then merge it when no live drain owns the ledger."""
    entry, issues = _read_and_validate_entry(args.entry, args.ledger)
    if issues:
        for issue in issues:
            print(f"FAIL {issue}", file=sys.stderr)
        return 1
    assert entry is not None

    inbox: Path = args.inbox
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
        lock_fd = os.open(lock, os.O_CREAT | os.O_RDWR, 0o644)
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
        result = merge_inbox(inbox, args.ledger)
    finally:
        if lock_fd is not None:
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


def _felix_waiting(findings: list[Finding]) -> list[Finding]:
    """Return open findings blocked on a Felix-facing decision or precondition."""
    return [
        finding
        for finding in findings
        if finding.status == "open"
        and classify_blocker(finding.blocked)
        in {BLOCKER_ANSWERABLE, BLOCKER_PRECONDITION}
    ]


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
    return {finding.id for finding in _felix_waiting(findings)}


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
    shown = [finding for finding in _felix_waiting(findings) if finding.id in shown_ids]
    fresh = [finding for finding in shown if finding.id not in kept]
    if not fresh:
        return

    answerable = [
        finding
        for finding in fresh
        if classify_blocker(finding.blocked) == BLOCKER_ANSWERABLE
    ]
    preconditions = [
        finding
        for finding in fresh
        if classify_blocker(finding.blocked) == BLOCKER_PRECONDITION
    ]
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
            f"warning: notifier failed while announcing Felix blockers "
            f"({type(exc).__name__}: {exc}); blockers remain unannounced.",
            file=sys.stderr,
        )
        return
    if posted != 0:
        # Left unrecorded on purpose: a failed post (no session bus, headless)
        # should be retried on the next named look, not counted as delivered.
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


def _forget_announced_ids_unlocked(ledger: Path, ids: set[str]) -> None:
    """Drop stamps for ids that just left the waiting set, without a ledger parse."""
    if not ids:
        return
    state_path = ledger.with_name(ANNOUNCED_STATE)
    try:
        announced = _read_announcement_state(state_path) or {}
    except LedgerError as exc:
        print(f"warning: {exc}; skipping announcement prune.", file=sys.stderr)
        return
    kept = {key: value for key, value in announced.items() if key not in ids}
    if kept != announced:
        _persist_announcement_state(state_path, kept)


def _forget_announced_ids(ledger: Path, ids: set[str]) -> None:
    """Forget announcement stamps while holding the state lock."""
    if not ids:
        return
    _with_announcement_lock(ledger, lambda: _forget_announced_ids_unlocked(ledger, ids))


def _with_announcement_lock(ledger: Path, body: Callable[[], None]) -> None:
    state_lock = ledger_lock_path(ledger.with_name(ANNOUNCED_STATE))
    try:
        acquired, waited_seconds = acquire_ledger_lock(
            state_lock,
            wait_window_seconds=NOTIFY_POST_TIMEOUT_S + NOTIFY_STATE_WRITE_GRACE_S,
        )
    except (LedgerError, OSError) as exc:
        print(
            f"warning: LOCK ACQUISITION failed for announcement state lock "
            f"{state_lock} ({type(exc).__name__}: {exc}); skipping announcement.",
            file=sys.stderr,
        )
        return
    if not acquired:
        print(
            f"warning: LOCK ACQUISITION could not acquire announcement state lock "
            f"{state_lock} after {waited_seconds:.2f}s; skipping announcement.",
            file=sys.stderr,
        )
        return
    try:
        body()
    finally:
        release_ledger_lock(state_lock)


def _announce_felix_blockers(shown: list[Finding], ledger: Path) -> None:
    """Announce current Felix-facing blockers while holding the state lock."""
    _with_announcement_lock(
        ledger,
        lambda: _announce_felix_blockers_unlocked({f.id for f in shown}, ledger),
    )


def cmd_decisions(args: argparse.Namespace) -> int:
    """Print Felix-facing blockers, optionally restricted to ``args.ids``.

    The drain prints a Felix-facing blocker once, when it parks it. A six-hour run scrolls,
    and Felix reads the chat rather than the ledger, so a one-time print is a
    notification and not a place to look things up. This is the place to look.
    """
    findings, problems, vocabulary = parse(args.ledger)
    issues = validate(findings, problems, vocabulary)
    _warn_problems(issues, "decisions")
    if issues:
        entry_word = "entry" if len(problems) == 1 else "entries"
        print(
            f"WARNING decisions could not read {len(problems)} ledger {entry_word}; "
            f"{len(issues)} validation problem(s) were found. Run `findings.py check`."
        )
    all_waiting = _felix_waiting(findings)
    waiting = [
        f for f in all_waiting if classify_blocker(f.blocked) == BLOCKER_ANSWERABLE
    ]
    preconditions = [
        f for f in all_waiting if classify_blocker(f.blocked) == BLOCKER_PRECONDITION
    ]
    if args.ids:
        # The drain names the ids a cluster just parked, so a park announcement
        # shows those blockers and not the whole backlog again.
        wanted = set(args.ids)
        waiting = [f for f in waiting if f.id in wanted]
        preconditions = [f for f in preconditions if f.id in wanted]
    if not waiting and not preconditions:
        # The announcement read also prunes cleared ids. Run it before this
        # early return so an emptied queue can self-heal before a re-park.
        # A bare review never toasts: shown_ids is empty.
        _announce_felix_blockers([], args.ledger)
        if not issues:
            print("No decisions are waiting on you.")
        return 0

    # Product decisions and Sentry approvals are two different asks and were
    # printed as one list under one count, which made the queue read as "18
    # decisions waiting on you" when only a handful were product questions.
    # Felix, 2026-09-01: "I only want decisions when they are really for me and
    # change the product in an important way." Separating them costs nothing and
    # stops the security gate inflating the number he judges the queue by.
    product = [f for f in waiting if f.blocked == FELIX_DECISION]
    approvals = [f for f in waiting if f.blocked == FELIX_SENTRY_ORIGIN]
    if product:
        print(f"{len(product)} product decision(s) waiting on you.\n")
    for f in product + approvals:
        if approvals and f is approvals[0]:
            print(
                f"{len(approvals)} Sentry approval(s) waiting on you — not product\n"
                "decisions. The unattended intake reads externally-influenceable\n"
                "input while holding authority, so a human confirms each defect it\n"
                "files before it becomes work (d-20260825-19).\n"
            )
        print(f"{f.id} — {f.title}")
        print(f"  area={f.area}  entry={f.entry}  ledger line {f.line}")
        if f.blocked == FELIX_SENTRY_ORIGIN:
            sentry_ids: list[str] = []
            for line in _unfenced_body(f).splitlines():
                if SENTRY_CONTEXT_RE.match(line) is not None:
                    print(f"  {line}")
                if SENTRY_RE.match(line) is not None:
                    short_id = line.split("**Sentry:**", 1)[1].strip()
                    if short_id:
                        sentry_ids.append(short_id)
                    print(f"  {line}")
            if sentry_ids:
                print(f"  Sentry short-ID: {', '.join(sentry_ids)}")
            else:
                print("  Sentry short-ID: none (this entry has no **Sentry:** bullet).")
            print("  Approval question: approve or reject this finding.")
            print()
            continue
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
    return issues


def _read_mutation_input(path: Path) -> str:
    """Read a command input file and turn filesystem failures into ledger errors."""
    try:
        return path.read_text(encoding="utf-8")
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


def cmd_set_header(args: argparse.Namespace) -> int:
    """Update selected fields on one real finding header under the ledger lock."""
    findings, _problems, _vocabulary = parse(args.ledger)
    target = next((finding for finding in findings if finding.id == args.id), None)
    if target is not None and target.blocked in ANSWERABLE_BLOCKERS:
        blocked_change = (
            args.blocked is not None and args.blocked not in ANSWERABLE_BLOCKERS
        )
        status_close = args.status in {"handled", "rejected"}
        if blocked_change or status_close:
            print(
                f"cannot clear answerable blocker {target.blocked} with set-header; "
                "answer it through /decide",
                file=sys.stderr,
            )
            return 1

    changes = {
        "Status": args.status,
        "Blocked": args.blocked,
        "Root": args.root,
        "Entry": args.entry,
    }

    def build(text: str) -> str:
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

    _locked_ledger_mutation(args.ledger, build)
    dropped: set[str] = set()
    if args.status in {"handled", "rejected"}:
        dropped.add(args.id)
    if args.blocked is not None and classify_blocker(args.blocked) not in {
        BLOCKER_ANSWERABLE,
        BLOCKER_PRECONDITION,
    }:
        dropped.add(args.id)
    _forget_announced_ids(args.ledger, dropped)
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


def cmd_annotate(args: argparse.Namespace) -> int:
    """Insert a file's lines into one finding entry under the ledger lock."""
    annotation = _read_mutation_input(args.file)
    if not any(line.strip() for line in annotation.splitlines()):
        raise LedgerError(f"{args.file} contains no content to annotate")

    def build(text: str) -> str:
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
        block = annotation.splitlines()
        # Separate the annotation from the entry body it lands after. Without
        # this the appended block is joined to the preceding paragraph and
        # renders as part of it -- every hand-written closure note in the
        # ledger has the blank line, so the command was silently producing a
        # different shape than the file's own convention.
        if end > 0 and lines[end - 1].strip() and block and block[0].strip():
            block.insert(0, "")
        lines[end:end] = block
        return _with_final_newline(text, lines)

    _locked_ledger_mutation(args.ledger, build)
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


def cmd_record_decision(args: argparse.Namespace) -> int:
    """Append pending decisions through the decisions ledger's writer lock."""
    entry = _read_mutation_input(args.file)
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
    allocated: list[str] = []
    date = f"{datetime.now().astimezone():%Y%m%d}"

    def build(text: str) -> str:
        candidate = _append_decision_entry(text, entry, args.section)
        taken = {
            match.group("id")
            for _index, match in _decision_heading_matches(candidate)[1]
        }
        rewritten, minted = _allocate_pending(
            candidate,
            "d",
            date,
            taken,
            PENDING_DECISION_ID,
            lambda value: _decision_heading_locations(value, include_pending=True),
        )
        if PENDING_DECISION_ID in rewritten:
            raise LedgerError(f"{PENDING_DECISION_ID} survived decision id allocation")
        allocated.extend(minted)
        # `_allocate_pending` rebuilds the text with `"\n".join(splitlines())`,
        # which drops the trailing newline. `set-header` and `annotate` already
        # go through `_with_final_newline` for exactly this reason; this path did
        # not, so every `record-decision` wrote a file with no final newline and
        # this repo's `end-of-file-fixer` rewrote it -- meaning the first commit
        # attempt after any recorded decision always failed. Measured
        # 2026-08-24, on this run's own decisions commit.
        return _with_final_newline(candidate, rewritten.splitlines())

    _locked_ledger_mutation(args.decisions, build)
    print(f"recorded decision(s) as {' '.join(allocated)}")
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


def _sentry_answer_kind(bullet: list[str]) -> str:
    """Return the explicit approval decision from a Sentry answer bullet."""
    decision = bullet[0].split(DECIDED_MARKER, 1)[1].strip()
    match = re.match(r"^(approve|reject)(?:\s|$|[—:,-])", decision)
    if match is None:
        raise LedgerError(
            "a Sentry-origin answer must start with 'approve' or 'reject'"
        )
    return match.group(1)


def _sentry_answer_evidence(bullet: list[str], kind: str) -> list[str]:
    """Turn a Sentry answer into validator evidence for approval or rejection."""
    decision = bullet[0].split(DECIDED_MARKER, 1)[1].strip()
    reason = decision[len(kind) :].lstrip(" \t—:,-")
    continuation = " ".join(line.strip() for line in bullet[1:] if line.strip())
    reason = " ".join(part for part in (reason, continuation) if part)
    if not reason:
        reason = (
            "Felix approved this Sentry-origin finding."
            if kind == "approve"
            else "Felix rejected this Sentry-origin finding."
        )
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


def cmd_apply_answers(args: argparse.Namespace) -> int:
    """Fold answers through the shared locked mutation pipeline."""
    spool: Path = args.answers
    claim = spool.with_name(f"{spool.name}.claim")
    # Check the leftover claim first. A refused batch normally leaves the spool
    # empty, so testing for an empty or absent spool first would hide the stop
    # signal that says answers are stranded outside the ledger.
    if not claim.exists():
        _probe_answers_spool(spool)
    claimed: list[Path] | None = None
    applied: list[str] = []
    skipped: list[str] = []
    quarantined: list[Path] = []

    def build(text: str) -> str:
        nonlocal claimed
        with _publish_lock(publish_lock_path(spool)):
            _refuse_unapplied_answers(spool)
            if not _adopt_orphan_parts(spool):
                raise LedgerError(
                    f"could not adopt every orphan in answers spool {spool}"
                )
            _recover_claim(claim, spool, args.ledger, answers=True, publish_locked=True)
            claimed = claim_spool(spool, claim)
        if claimed is None:
            raise LedgerError(
                f"a previously refused answers batch is still unresolved: {claim}"
            )
        if not claimed:
            return text
        lines = text.splitlines()
        ledger_fence_states = _fence_mask(lines)
        answer_records: list[tuple[Path, str, list[str]]] = []
        paths_by_id: dict[str, list[Path]] = {}
        for answer_path in claimed:
            try:
                record = _parse_answer_file(answer_path)
            except (OSError, UnicodeError) as exc:
                raise LedgerError(
                    f"could not read answer file {answer_path}: {exc}"
                ) from exc
            if record is None:
                raise LedgerError(
                    f"{answer_path.name} needs exactly one finding id and one "
                    f"'{DECIDED_MARKER}' bullet"
                )
            finding_id, bullet = record
            answer_records.append((answer_path, finding_id, bullet))
            paths_by_id.setdefault(finding_id, []).append(answer_path)

        duplicate_ids = {
            finding_id: paths
            for finding_id, paths in paths_by_id.items()
            if len(paths) > 1
        }
        if duplicate_ids:
            details = "; ".join(
                f"{finding_id}: {', '.join(path.name for path in paths)}"
                for finding_id, paths in duplicate_ids.items()
            )
            raise LedgerError(f"duplicate answer id(s) in batch: {details}")
        answer_by_id = {
            finding_id: (answer_path, bullet)
            for answer_path, finding_id, bullet in answer_records
        }
        target_spans: dict[str, tuple[int, int, re.Match[str]]] = {}
        active_header: tuple[int, re.Match[str]] | None = None
        pending_heading = False

        def record_active_entry_end(boundary: int) -> None:
            """Record a target's header and insertion point at its boundary."""
            if active_header is None:
                return
            header_index, header_match = active_header
            finding_id = header_match.group("id")
            if finding_id not in answer_by_id or finding_id in target_spans:
                return
            end = boundary
            while end > header_index + 1 and not lines[end - 1].strip():
                end -= 1
            target_spans[finding_id] = (header_index, end, header_match)

        for index, line in enumerate(lines):
            fence_state = ledger_fence_states[index]
            if fence_state is not FenceState.OUTSIDE:
                continue
            if pending_heading:
                if not line.strip():
                    continue
                pending_heading = False
                header_match = HEADER_RE.match(line)
                if header_match is not None:
                    active_header = (index, header_match)
                    continue
            if line.startswith(ENTRY_MARKER):
                record_active_entry_end(index)
                active_header = None
                pending_heading = True
            elif (
                line.startswith("# ")
                or line.startswith("## ")
                or HRULE_RE.match(line) is not None
            ):
                record_active_entry_end(index)
                active_header = None

        record_active_entry_end(len(lines))

        header_updates: dict[int, str] = {}
        insertions: dict[int, list[str]] = {}
        waiting_records: list[tuple[Path, str, list[str]]] = []
        already_applied: list[tuple[Path, str]] = []
        to_quarantine: list[tuple[Path, str, Path]] = []
        for answer_path, finding_id, bullet in answer_records:
            target = target_spans.get(finding_id)
            if target is None:
                raise LedgerError(
                    f"{answer_path.name} answers {finding_id}, which is not in the ledger"
                )
            header_index, end, header_match = target
            blocked = header_match.group("blocked")
            if classify_blocker(blocked) == BLOCKER_ANSWERABLE:
                waiting_records.append((answer_path, finding_id, bullet))
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

        for answer_path, finding_id, bullet in waiting_records:
            target = target_spans[finding_id]
            header_index, end, header_match = target
            blocked = header_match.group("blocked")
            evidence: list[str] = []
            updated_header = lines[header_index]
            if blocked == FELIX_SENTRY_ORIGIN:
                try:
                    kind = _sentry_answer_kind(bullet)
                except LedgerError as exc:
                    raise LedgerError(
                        f"{answer_path.name} answers {finding_id}: {exc}"
                    ) from exc
                evidence = _sentry_answer_evidence(bullet, kind)
                if kind == "reject":
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
            insertions[end] = bullet + evidence
            applied.append(finding_id)

        result_lines: list[str] = []
        for index in range(len(lines) + 1):
            if index in insertions:
                result_lines.extend(insertions[index])
            if index < len(lines):
                result_lines.append(header_updates.get(index, lines[index]))

        if waiting_records:
            _write_claim_intent(
                claim,
                "prepared",
                {finding_id for _path, finding_id, _bullet in waiting_records},
            )
        return _with_final_newline(text, result_lines)

    _locked_ledger_mutation(args.ledger, build)
    _forget_announced_ids(args.ledger, set(applied))
    if claimed:
        release_spool(claim, spool, claimed)
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


def main(argv: list[str] | None = None) -> int:
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
    p_list.set_defaults(func=cmd_list)

    p_next = sub.add_parser("next", help="print the highest-ranked pickable cluster")
    p_next.add_argument("--pin", help="force this finding's cluster")
    p_next.add_argument(
        "--json",
        action="store_true",
        help="print a JSON object for the pick on stdout; warnings stay on stderr",
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
    p_file.set_defaults(func=cmd_file)

    p_merge = sub.add_parser("merge-inbox", help="fold the inbox into the ledger")
    p_merge.add_argument("--inbox", type=Path, default=None, help=argparse.SUPPRESS)
    p_merge.set_defaults(func=cmd_merge_inbox)

    p_dec = sub.add_parser(
        "decisions", help="print Felix-facing blockers waiting on Felix"
    )
    p_dec.add_argument("ids", nargs="*", help="only these findings (default: all)")
    p_dec.set_defaults(func=cmd_decisions)

    p_answers = sub.add_parser(
        "apply-answers", help="fold answered decisions in and unblock them"
    )
    p_answers.add_argument("--answers", type=Path, default=None, help=argparse.SUPPRESS)
    p_answers.set_defaults(func=cmd_apply_answers)

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
    p_annotate.set_defaults(func=cmd_annotate)

    p_record = sub.add_parser(
        "record-decision", help="append decisions through the decisions ledger lock"
    )
    p_record.add_argument("file", type=Path)
    p_record.add_argument("--section")
    p_record.set_defaults(func=cmd_record_decision)

    args = parser.parse_args(argv)
    root = _require_git_toplevel()
    _bind_repo_root(root)
    if args.ledger is None:
        args.ledger = LEDGER
    if args.decisions is None:
        args.decisions = DECISIONS
    if getattr(args, "inbox", None) is None and hasattr(args, "inbox"):
        args.inbox = INBOX
    if getattr(args, "answers", None) is None and hasattr(args, "answers"):
        args.answers = ANSWERS
    if args.command == "set-header" and not any(
        value is not None
        for value in (args.status, args.blocked, args.root, args.entry)
    ):
        parser.error("set-header requires at least one field option")
    try:
        return args.func(args)
    except (LedgerError, OSError, UnicodeDecodeError) as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
