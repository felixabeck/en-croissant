#!/usr/bin/env python3
"""Executable parity record for En Croissant's copied findings checker.

The sibling source is read from a pinned commit, never from its working tree.
Every diff hunk must have exactly one live declaration, while the changed-line
cardinality and normalized digest prevent a declaration from absorbing an
adjacent or same-size unrelated edit.
"""

from __future__ import annotations

import hashlib
import subprocess
import sys
import unittest
from contextlib import redirect_stdout
from dataclasses import dataclass
from difflib import unified_diff
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER = REPO_ROOT / "scripts" / "findings.py"
SIBLING_REPO = REPO_ROOT.parent / "chess-tactics-app"
SIBLING_REF = "6f83b80d8772a2196538f94dbc7ff40b582c6988"
ALLOW_MISSING_SIBLING = "--allow-missing-sibling"


@dataclass(frozen=True)
class DeclaredDivergence:
    slug: str
    markers: tuple[str, ...]
    reason: str
    sibling_told: bool
    port_pending: bool


DECLARED_DIVERGENCES = (
    DeclaredDivergence(
        slug="atomic-write-cleanup-preserves-primary-error",
        markers=(
            "Never re-raise here. A ``raise`` inside ``finally`` replaces the",
            'detail = "after atomic write" if committed else "after a failed atomic write"',
        ),
        reason=(
            "f-20260829-14: cleanup failure must not replace the atomic write "
            "failure already in flight. The sibling port remains pending, and "
            "the sibling has been told: chess-tactics-app's own ledger carries "
            "it as f-20260830-14 (area dev-scripts, Entry inline), filed from "
            "here on 2026-08-30 with this hunk and the re-pin instruction."
        ),
        sibling_told=True,
        port_pending=True,
    ),
    DeclaredDivergence(
        slug="product-decision-gate-and-listing",
        markers=(
            "_BULLET",
            "PRODUCT_IMPACT_RE",
            "_park_brief_issues",
            "product decision(s) waiting on you",
            "waits on: {f.blocked}",
        ),
        reason=(
            "ChessRiddle is ahead: shared `_BULLET` grammar, the "
            "`**Product impact:**` park gate, split product/Sentry listing, "
            "and printing the precondition slug. Not adopted here in the "
            "announce-toast port (f-20260901-11) because the impact gate "
            "would redden three existing parks that have no such bullet. "
            "Port pending."
        ),
        sibling_told=True,
        port_pending=True,
    ),
)

# Measured from the pinned sibling blob and this tree after walking the sole
# declared hunk. Marker matching alone cannot protect an adjacent edit because
# a zero-context unified diff absorbs it into the same hunk.
EXPECTED_CHANGED_LINES = 180
EXPECTED_DELTA_DIGEST = (
    "f71e8fad2e58b28c14f81e689207d33f074f90430da6e6da8815e04176308858"
)


PARITY_PATH = "scripts/findings.py"

STALENESS_HEADING = (
    "WARN the pinned SIBLING_REF and the sibling's history disagree, so this "
    "copy was reconciled against a revision that is no longer the sibling's "
    "newest for this file:"
)

# Each item is asserted verbatim by the integration test, so that a future
# `main` cannot keep the heading while dropping the instructions that make the
# warning actionable.
STALENESS_REMEDY = (
    "re-pin SIBLING_REF to the newest sibling commit touching " + PARITY_PATH,
    "re-walk the hunks against DECLARED_DIVERGENCES",
    "re-pin BOTH EXPECTED_CHANGED_LINES and EXPECTED_DELTA_DIGEST deliberately",
    "file the outstanding port in this repository's findings ledger",
)

# Advisory on purpose, and this is a decision rather than a leniency. ChessRiddle
# made exactly this check blocking (`d-20260826-10`) and measured the result on
# 2026-08-26: the sibling committed twice to scripts/findings.py while an
# unattended drain was running, its gate went red on develop for work that
# repository could neither cause nor fix, and eight sound commits were stranded
# unpushed. Felix qualified the mechanism in chat on 2026-08-27 -- the
# pin-touches-findings half stays blocking, this half warns, and an outstanding
# port belongs in the findings queue. Both peers implement that split with
# `warnings.warn`, which under a plain runner leaves exit 0 and one line that
# scrolls past; inside an unattended drain nobody reads it. So the severity is
# theirs and the channel is not: this prints from `main` itself.
STALENESS_ADVISORY_NOTE = (
    "This is advisory and does NOT fail the gate: a commit in the sibling is "
    "work this repository can neither cause nor fix (chess-tactics-app "
    "d-20260826-10; Felix, 2026-08-27). Carry the port as a finding."
)


class ProbeFailure(Exception):
    """The staleness probe could not run.

    Never flattened into an empty result. An empty result means "checked, and
    the pin is current"; a probe that could not run must not be spelled the same
    way (`d-20260830-20`).
    """


def _run_git(repo: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    """Run git for the parity gate, decoding leniently.

    ``errors="replace"`` is deliberate: a commit subject is not required to be
    UTF-8, and under a strict decode a foreign commit message would raise
    ``UnicodeDecodeError`` — a ``ValueError``, so it would slip past every
    ``OSError`` guard here and surface as a raw traceback instead of a labelled
    gate failure.
    """
    return subprocess.run(
        ["git", "-C", str(repo), *arguments],
        capture_output=True,
        check=False,
        text=True,
        errors="replace",
    )


def _probe(repo: Path, *arguments: str) -> str:
    try:
        result = _run_git(repo, *arguments)
    except OSError as error:
        raise ProbeFailure(f"git {' '.join(arguments)}: {error}") from error
    if result.returncode != 0:
        detail = result.stderr.strip() or f"git {' '.join(arguments)} failed"
        raise ProbeFailure(detail)
    return result.stdout


def _pin_staleness(repo: Path, ref: str) -> list[str]:
    """Advisory lines describing how far the sibling has moved past the pin.

    An empty list means the pin still names the newest sibling commit touching
    ``path``. Raises ``ProbeFailure`` when the question could not be answered.
    """
    lines: list[str] = []
    pinned = _probe(repo, "rev-parse", f"{ref}^{{commit}}").strip()

    # Ancestry is asked separately rather than inferred from an empty
    # `pinned..HEAD`. That range lists what HEAD reaches and the pin does not,
    # so a pin sitting on a diverged branch produces an empty range while the
    # two copies have in fact parted -- reported as "current", which is the
    # false green this probe exists to remove.
    try:
        ancestry = _run_git(repo, "merge-base", "--is-ancestor", pinned, "HEAD")
    except OSError as error:
        raise ProbeFailure(f"git merge-base --is-ancestor: {error}") from error
    if ancestry.returncode not in (0, 1):
        detail = ancestry.stderr.strip() or "git merge-base --is-ancestor failed"
        raise ProbeFailure(detail)
    if ancestry.returncode == 1:
        lines.append(
            f"NOT-ANCESTOR the pinned SIBLING_REF {pinned} is not reachable from "
            "the sibling's HEAD, so the pin sits on a diverged branch and "
            f"`{ref}..HEAD` cannot enumerate the drift."
        )

    newest = _probe(
        repo, "log", "-1", "--format=%H", "HEAD", "--", PARITY_PATH
    ).strip()
    if not newest:
        lines.append(
            f"NO-COMMIT the sibling's HEAD has no commit touching {PARITY_PATH} "
            "at all."
        )
        return lines
    if newest == pinned and not lines:
        return lines

    # The pathspec is what keeps this a parity signal rather than a feed of the
    # sibling's every commit. Without it a warning fires on unrelated work,
    # which is how an advisory line becomes noise nobody reads.
    newer = [
        line
        for line in _probe(
            repo, "log", "--format=%H %s", f"{pinned}..HEAD", "--", PARITY_PATH
        ).splitlines()
        if line.strip()
    ]
    lines.extend(f"NEWER {line}" for line in newer)
    if not newer and newest != pinned:
        # Nothing on HEAD's side touches the file more recently than the pin,
        # yet HEAD's tip for the file is a different commit. That is the pin
        # being AHEAD of HEAD's history for this file — reached when the pin
        # sits on a branch carrying a change HEAD does not have. Calling it
        # "newer" would be backwards, and claiming it is unreachable from the
        # pin is false here: it is usually the pin's own ancestor.
        subject = _probe(repo, "log", "-1", "--format=%s", newest).strip()
        lines.append(
            f"PIN-AHEAD {newest} {subject} (HEAD's newest commit touching "
            f"{PARITY_PATH}; the pin carries a later change to this file that "
            "HEAD does not, so the pin is ahead of the sibling's own history)"
        )
    return lines


def _read_committed_sibling() -> str:
    try:
        git_dir = _run_git(SIBLING_REPO, "rev-parse", "--git-dir")
    except OSError as error:
        # git itself could not start. Without this, main() — which catches only
        # AssertionError — would print a raw traceback instead of a labelled
        # gate failure.
        raise AssertionError(
            f"git could not be run against the chess-tactics-app sibling: {error}"
        ) from error
    if git_dir.returncode != 0:
        detail = git_dir.stderr.strip() or "git rev-parse --git-dir failed"
        raise AssertionError(
            f"chess-tactics-app sibling checkout is present but unusable: {detail}"
        )
    committed = _run_git(
        SIBLING_REPO, "show", f"{SIBLING_REF}:{PARITY_PATH}"
    )
    if committed.returncode != 0:
        detail = committed.stderr.strip() or "git show failed"
        raise AssertionError(
            "chess-tactics-app sibling checkout is present but "
            f"{SIBLING_REF}:scripts/findings.py is unavailable: {detail}"
        )
    return committed.stdout


def _diff_hunks(sibling: str, local: str) -> list[str]:
    diff = unified_diff(
        sibling.splitlines(keepends=True),
        local.splitlines(keepends=True),
        fromfile=f"chess-tactics-app {SIBLING_REF}:scripts/findings.py",
        tofile="En Croissant/scripts/findings.py",
        n=0,
    )
    hunks: list[str] = []
    current: list[str] = []
    for line in diff:
        if line.startswith("@@"):
            if current:
                hunks.append("".join(current))
            current = [line]
        elif current:
            current.append(line)
    if current:
        hunks.append("".join(current))
    return hunks


def _changed_lines(hunks: list[str]) -> list[str]:
    return [
        line
        for hunk in hunks
        for line in hunk.splitlines()
        if line.startswith(("+", "-"))
    ]


def _hunk_claims(
    hunks: list[str], declarations: tuple[DeclaredDivergence, ...]
) -> list[list[DeclaredDivergence]]:
    return [
        [
            declaration
            for declaration in declarations
            if any(
                marker in line
                for line in hunk.splitlines()
                if line.startswith(("+", "-"))
                for marker in declaration.markers
            )
        ]
        for hunk in hunks
    ]


def _delta_digest(sibling: str, local: str) -> str:
    diff = unified_diff(
        sibling.splitlines(keepends=True),
        local.splitlines(keepends=True),
        fromfile=f"chess-tactics-app {SIBLING_REF}:scripts/findings.py",
        tofile="En Croissant/scripts/findings.py",
        n=3,
    )
    normalized_lines = [
        "@@ ... @@" if line.startswith("@@") else line.removesuffix("\n")
        for line in diff
    ]
    normalized = "\n".join(normalized_lines)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _parity_failures(
    sibling: str,
    local: str,
    declarations: tuple[DeclaredDivergence, ...] = DECLARED_DIVERGENCES,
    expected_changed_lines: int = EXPECTED_CHANGED_LINES,
    expected_digest: str = EXPECTED_DELTA_DIGEST,
) -> list[str]:
    hunks = _diff_hunks(sibling, local)
    changed_lines = _changed_lines(hunks)
    hunk_claims = _hunk_claims(hunks, declarations)
    matched = {declaration for claims in hunk_claims for declaration in claims}
    undeclared = [
        hunk for hunk, claims in zip(hunks, hunk_claims, strict=True) if not claims
    ]
    ambiguous = [
        (hunk, claims)
        for hunk, claims in zip(hunks, hunk_claims, strict=True)
        if len(claims) > 1
    ]
    unmatched = [
        declaration for declaration in declarations if declaration not in matched
    ]
    blank_markers = [
        f"{declaration.slug}: {marker!r}"
        for declaration in declarations
        for marker in declaration.markers
        if not marker.strip()
    ]
    marker_owners: dict[str, set[str]] = {}
    for declaration in declarations:
        for marker in declaration.markers:
            marker_owners.setdefault(marker, set()).add(declaration.slug)
    duplicate_markers = {
        marker: owners for marker, owners in marker_owners.items() if len(owners) > 1
    }

    failures: list[str] = []
    if len(changed_lines) != expected_changed_lines:
        failures.append(
            f"The declared delta changed size: {len(changed_lines)} changed lines, "
            f"expected {expected_changed_lines}. Re-walk the hunks against "
            "DECLARED_DIVERGENCES, then re-pin BOTH EXPECTED_CHANGED_LINES and "
            "EXPECTED_DELTA_DIGEST deliberately."
        )
    actual_digest = _delta_digest(sibling, local)
    if actual_digest != expected_digest:
        failures.append(
            f"The findings.py delta digest changed: {actual_digest}, expected "
            f"{expected_digest}. Re-walk the hunks against DECLARED_DIVERGENCES, "
            "then re-pin BOTH constants deliberately."
        )
    if undeclared:
        failures.append(
            "Undeclared scripts/findings.py diff hunk(s) — each one is a fork "
            "nobody chose. Declare it, or converge it away:\n"
            + "\n".join(undeclared)
        )
    if ambiguous:
        failures.append(
            "A scripts/findings.py diff hunk is claimed by multiple declarations:\n"
            + "\n".join(
                f"{hunk}\nclaims: {', '.join(item.slug for item in claims)}"
                for hunk, claims in ambiguous
            )
        )
    if blank_markers:
        failures.append(
            "A declaration carries a blank marker, which matches every changed line:\n"
            + "\n".join(blank_markers)
        )
    if duplicate_markers:
        failures.append(
            "Marker strings must be unique across declarations:\n"
            + "\n".join(
                f"- {marker}: {', '.join(sorted(owners))}"
                for marker, owners in sorted(duplicate_markers.items())
            )
        )
    untold_pending = [
        declaration
        for declaration in declarations
        if declaration.port_pending and not declaration.sibling_told
    ]
    if untold_pending:
        failures.append(
            "A declared divergence has a port pending that the sibling has NOT "
            "been told about, which is a fork nobody chose and nobody is "
            "tracking. File it in the sibling's own ledger and set "
            "sibling_told=True, or port it and delete the declaration:\n"
            + "\n".join(
                f"- {declaration.slug}: {declaration.reason}"
                for declaration in untold_pending
            )
        )
    if unmatched:
        failures.append(
            "Declared divergence(s) matched no diff hunk; DELETE each declaration "
            "whose divergence has been ported to the sibling:\n"
            + "\n".join(
                f"- {declaration.slug}: sibling_told={declaration.sibling_told}, "
                f"port_pending={declaration.port_pending}; reason={declaration.reason}"
                for declaration in unmatched
            )
        )
    return failures


def _fixture_git(repo: Path, *arguments: str) -> None:
    """Run git in a throwaway fixture repository.

    Identity and signing are forced off per invocation: this machine signs
    commits by default (`commit.gpgsign=true`, ssh format), which a temporary
    repository with no key configured cannot satisfy.
    """
    subprocess.run(
        [
            "git",
            "-C",
            str(repo),
            "-c",
            "user.name=fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "-c",
            "commit.gpgsign=false",
            *arguments,
        ],
        capture_output=True,
        check=True,
        text=True,
    )


def _fixture_commit(repo: Path, files: dict[str, str], message: str) -> None:
    for name, content in files.items():
        target = repo / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    _fixture_git(repo, "add", "--all")
    _fixture_git(repo, "commit", "--quiet", "-m", message)


def _fixture_head(repo: Path) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "HEAD"],
        capture_output=True,
        check=True,
        text=True,
    ).stdout.strip()


class FindingsParity(unittest.TestCase):
    @staticmethod
    def _run_main(sibling_repo: Path, *args: str, sibling_ref: str = SIBLING_REF) -> tuple[int, str]:
        output = StringIO()
        with (
            patch(f"{__name__}.SIBLING_REPO", sibling_repo),
            patch(f"{__name__}.SIBLING_REF", sibling_ref),
            redirect_stdout(output),
        ):
            return_code = main(list(args))
        return return_code, output.getvalue()

    def test_absent_sibling_without_flag_fails(self) -> None:
        with TemporaryDirectory() as temp:
            missing_sibling = Path(temp) / "missing-sibling"
            return_code, output = self._run_main(missing_sibling)

        self.assertEqual(return_code, 1)
        self.assertIn(str(missing_sibling), output)
        self.assertIn(ALLOW_MISSING_SIBLING, output)

    def test_absent_sibling_with_flag_passes_without_comparison(self) -> None:
        with TemporaryDirectory() as temp:
            missing_sibling = Path(temp) / "missing-sibling"
            return_code, output = self._run_main(
                missing_sibling, ALLOW_MISSING_SIBLING
            )

        self.assertEqual(return_code, 0)
        self.assertIn("NO comparison was made", output)

    def test_sibling_present_but_pinned_ref_unreadable_fails_even_with_flag(
        self,
    ) -> None:
        with TemporaryDirectory() as temp:
            sibling_repo = Path(temp)
            subprocess.run(
                ["git", "init", "--quiet", str(sibling_repo)],
                check=True,
            )
            return_code, output = self._run_main(
                sibling_repo,
                ALLOW_MISSING_SIBLING,
                sibling_ref="not-a-readable-pinned-ref",
            )

        self.assertEqual(return_code, 1)
        self.assertIn("FAIL findings parity check", output)
        self.assertIn("not-a-readable-pinned-ref", output)
        self.assertNotIn("SKIP", output)

    def test_sibling_ref_touched_findings(self) -> None:
        _read_committed_sibling()
        touched = subprocess.run(
            [
                "git",
                "-C",
                str(SIBLING_REPO),
                "diff-tree",
                "--no-commit-id",
                "--name-only",
                "-r",
                f"{SIBLING_REF}^",
                SIBLING_REF,
            ],
            capture_output=True,
            check=False,
            text=True,
        )
        self.assertEqual(touched.returncode, 0, touched.stderr.strip())
        self.assertIn("scripts/findings.py", touched.stdout.splitlines())

    def test_findings_diff_is_fully_declared(self) -> None:
        sibling = _read_committed_sibling()
        local = CHECKER.read_text(encoding="utf-8")
        failures = _parity_failures(sibling, local)
        self.assertFalse(failures, "\n\n".join(failures))

    def test_digest_rejects_same_size_substitution(self) -> None:
        sibling = "prefix\nmarker old\nsuffix\n"
        baseline = "prefix\nmarker new\nsuffix\n"
        mutant = "prefix\nmarker replacement\nsuffix\n"
        declaration = DeclaredDivergence(
            "marker", ("marker",), "test", False, True
        )
        changed_lines = len(_changed_lines(_diff_hunks(sibling, baseline)))
        failures = _parity_failures(
            sibling,
            mutant,
            (declaration,),
            changed_lines,
            _delta_digest(sibling, baseline),
        )
        self.assertTrue(any("delta digest changed" in failure for failure in failures))

    # ---- the pin-staleness probe -------------------------------------

    @staticmethod
    def _sibling_fixture(root: Path) -> None:
        """A sibling repository whose newest findings.py commit is its second."""
        _fixture_git(root, "init", "--quiet", ".")
        _fixture_commit(root, {PARITY_PATH: "one\n"}, "first findings commit")
        _fixture_commit(root, {PARITY_PATH: "two\n"}, "second findings commit")

    def test_probe_is_silent_when_the_pin_is_the_newest_findings_commit(
        self,
    ) -> None:
        """A later commit touching ANOTHER file must not read as drift.

        Without the pathspec this test goes red, which is the point: an
        unfiltered `log` would report every unrelated sibling commit as an
        outstanding port and the warning would become noise nobody reads.
        """
        with TemporaryDirectory() as temp:
            repo = Path(temp)
            self._sibling_fixture(repo)
            pin = _fixture_head(repo)
            _fixture_commit(repo, {"docs/unrelated.md": "later\n"}, "unrelated")

            self.assertEqual(_pin_staleness(repo, pin), [])

    def test_probe_names_the_offending_commit_when_the_sibling_moved(
        self,
    ) -> None:
        with TemporaryDirectory() as temp:
            repo = Path(temp)
            self._sibling_fixture(repo)
            pin = _fixture_head(repo)
            _fixture_commit(repo, {PARITY_PATH: "three\n"}, "third findings commit")
            moved = _fixture_head(repo)

            lines = _pin_staleness(repo, pin)

        self.assertTrue(any(moved in line for line in lines), lines)
        self.assertTrue(any(line.startswith("NEWER ") for line in lines), lines)

    def test_probe_reports_a_pin_on_a_diverged_branch(self) -> None:
        """`pin..HEAD` is EMPTY here while the copies have parted.

        This is the false green the ancestry half exists to remove, so the
        assertion names the NOT-ANCESTOR line specifically: a probe that kept
        only the `log` half would return an empty list and read as current.
        """
        with TemporaryDirectory() as temp:
            repo = Path(temp)
            self._sibling_fixture(repo)
            base = _fixture_head(repo)
            _fixture_git(repo, "checkout", "--quiet", "-b", "side")
            _fixture_commit(repo, {PARITY_PATH: "side\n"}, "side findings commit")
            pin = _fixture_head(repo)
            _fixture_git(repo, "checkout", "--quiet", base)
            _fixture_git(repo, "checkout", "--quiet", "-B", "trunk")
            _fixture_commit(repo, {"docs/unrelated.md": "trunk\n"}, "trunk work")

            lines = _pin_staleness(repo, pin)

        self.assertTrue(
            any(line.startswith("NOT-ANCESTOR ") for line in lines), lines
        )

    def test_probe_failure_is_not_flattened_into_current(self) -> None:
        """A broken probe must raise, never return the empty "current" list."""
        with TemporaryDirectory() as temp:
            repo = Path(temp)
            self._sibling_fixture(repo)
            pin = _fixture_head(repo)

            with self.assertRaises(ProbeFailure):
                _pin_staleness(repo, "no-such-ref-at-all")

            with self.assertRaises(ProbeFailure):
                _pin_staleness(Path(temp) / "not-a-repository", pin)

    def test_main_prints_the_staleness_evidence_and_stays_green(self) -> None:
        """`main` forwards the probe's evidence, and does NOT fail on drift.

        `FindingsParity` is patched to a trivial case because `main` runs the
        whole suite: driving the real one from inside it would recurse. That
        substitution is also what keeps the digest out of the way, since a
        synthetic SIBLING_REF changes the diff header the digest hashes.
        """

        class _Trivial(unittest.TestCase):
            def test_ok(self) -> None:
                pass

        with TemporaryDirectory() as temp:
            repo = Path(temp)
            self._sibling_fixture(repo)
            pin = _fixture_head(repo)
            _fixture_commit(repo, {PARITY_PATH: "four\n"}, "fourth findings commit")
            moved = _fixture_head(repo)

            output = StringIO()
            with (
                patch(f"{__name__}.SIBLING_REPO", repo),
                patch(f"{__name__}.SIBLING_REF", pin),
                patch(f"{__name__}.FindingsParity", _Trivial),
                redirect_stdout(output),
            ):
                return_code = main([])
            printed = output.getvalue()

        self.assertEqual(return_code, 0, printed)
        self.assertIn(moved, printed)
        # Spelled out rather than looped over STALENESS_REMEDY: deriving the
        # expectation from the very tuple `main` prints makes the assertion
        # tautological, so deleting a remedy would leave this green.
        self.assertIn("re-pin SIBLING_REF to the newest sibling commit", printed)
        self.assertIn("re-walk the hunks against DECLARED_DIVERGENCES", printed)
        self.assertIn(
            "re-pin BOTH EXPECTED_CHANGED_LINES and EXPECTED_DELTA_DIGEST", printed
        )
        self.assertIn("file the outstanding port", printed)
        self.assertIn("does NOT fail the gate", printed)
        self.assertIn("d-20260826-10", printed)

    def test_probe_lists_only_findings_commits_after_real_movement(self) -> None:
        """The pathspec must still filter once the pin is genuinely stale.

        The current-pin test returns before this code path, so without this
        fixture the second pathspec could be deleted and every test stayed
        green while the warning began reporting the sibling's unrelated work.
        """
        with TemporaryDirectory() as temp:
            repo = Path(temp)
            self._sibling_fixture(repo)
            pin = _fixture_head(repo)
            _fixture_commit(repo, {"docs/unrelated.md": "noise\n"}, "unrelated work")
            noise = _fixture_head(repo)
            _fixture_commit(repo, {PARITY_PATH: "three\n"}, "third findings commit")
            moved = _fixture_head(repo)

            lines = _pin_staleness(repo, pin)

        self.assertTrue(any(moved in line for line in lines), lines)
        self.assertFalse(any(noise in line for line in lines), lines)

    def test_probe_reports_a_pin_ahead_of_the_siblings_own_history(self) -> None:
        """The pin carries a change to the file that HEAD does not have.

        `pinned..HEAD -- path` is empty here, so the NEWER branch never fires,
        and the distinct PIN-AHEAD line is the only evidence. It must not be
        called NEWER: HEAD's tip for the file is the pin's own ancestor.
        """
        with TemporaryDirectory() as temp:
            repo = Path(temp)
            self._sibling_fixture(repo)
            base = _fixture_head(repo)
            _fixture_git(repo, "checkout", "--quiet", "-b", "side")
            _fixture_commit(repo, {PARITY_PATH: "side\n"}, "side findings commit")
            pin = _fixture_head(repo)
            _fixture_git(repo, "checkout", "--quiet", "-B", "trunk", base)
            _fixture_commit(repo, {"docs/unrelated.md": "trunk\n"}, "trunk work")

            lines = _pin_staleness(repo, pin)

        self.assertTrue(any(line.startswith("PIN-AHEAD ") for line in lines), lines)
        self.assertTrue(any(base in line for line in lines), lines)
        self.assertFalse(any(line.startswith("NEWER ") for line in lines), lines)

    def test_probe_reports_a_sibling_with_no_history_for_the_file(self) -> None:
        with TemporaryDirectory() as temp:
            repo = Path(temp)
            _fixture_git(repo, "init", "--quiet", ".")
            _fixture_commit(repo, {"docs/only.md": "no findings here\n"}, "unrelated")
            pin = _fixture_head(repo)

            lines = _pin_staleness(repo, pin)

        self.assertTrue(any(line.startswith("NO-COMMIT ") for line in lines), lines)

    def test_probe_converts_an_oserror_into_a_probe_failure(self) -> None:
        """git failing to START must fail closed, not read as "current"."""
        with TemporaryDirectory() as temp:
            repo = Path(temp)
            self._sibling_fixture(repo)
            pin = _fixture_head(repo)

            def _cannot_start(*_args: object, **_kwargs: object) -> object:
                raise OSError("git binary is missing")

            with patch("subprocess.run", _cannot_start):
                with self.assertRaises(ProbeFailure):
                    _pin_staleness(repo, pin)

    def test_probe_rejects_an_unexpected_merge_base_status(self) -> None:
        """`--is-ancestor` answers 0 or 1; anything else is a broken probe.

        Treating an unexpected status as "not an ancestor" would turn a git
        malfunction into a confident claim about the sibling's history.
        """
        with TemporaryDirectory() as temp:
            repo = Path(temp)
            self._sibling_fixture(repo)
            pin = _fixture_head(repo)

            real = _run_git

            def _fake(target: Path, *arguments: str) -> object:
                if arguments[:2] == ("merge-base", "--is-ancestor"):
                    return subprocess.CompletedProcess(
                        args=list(arguments), returncode=128, stdout="", stderr="bad"
                    )
                return real(target, *arguments)

            with patch(f"{__name__}._run_git", _fake):
                with self.assertRaises(ProbeFailure):
                    _pin_staleness(repo, pin)

    def test_main_still_runs_the_parity_suite_after_warning(self) -> None:
        """The advisory must not become an early return.

        A `main` that printed the warning and returned 0 would skip every parity
        check exactly when the sibling moved — the moment the checks matter
        most. The patched suite fails, so a green result proves it never ran.
        """

        class _Failing(unittest.TestCase):
            def test_not_ok(self) -> None:
                self.fail("the parity suite must still run after the advisory")

        with TemporaryDirectory() as temp:
            repo = Path(temp)
            self._sibling_fixture(repo)
            pin = _fixture_head(repo)
            _fixture_commit(repo, {PARITY_PATH: "five\n"}, "fifth findings commit")

            output = StringIO()
            with (
                patch(f"{__name__}.SIBLING_REPO", repo),
                patch(f"{__name__}.SIBLING_REF", pin),
                patch(f"{__name__}.FindingsParity", _Failing),
                redirect_stdout(output),
            ):
                return_code = main([])
            printed = output.getvalue()

        self.assertEqual(return_code, 1, printed)
        self.assertIn(STALENESS_HEADING, printed)

    def test_main_fails_closed_when_the_probe_cannot_run(self) -> None:
        with TemporaryDirectory() as temp:
            repo = Path(temp)
            self._sibling_fixture(repo)
            pin = _fixture_head(repo)

            def _broken(*_args: object, **_kwargs: object) -> list[str]:
                raise ProbeFailure("git exploded")

            output = StringIO()
            with (
                patch(f"{__name__}.SIBLING_REPO", repo),
                patch(f"{__name__}.SIBLING_REF", pin),
                patch(f"{__name__}._pin_staleness", _broken),
                redirect_stdout(output),
            ):
                return_code = main([])
            printed = output.getvalue()

        self.assertEqual(return_code, 1, printed)
        self.assertIn("the pin was NOT checked", printed)
        self.assertIn("git exploded", printed)

    def test_a_pending_port_the_sibling_was_not_told_about_fails(self) -> None:
        untold = DeclaredDivergence(
            "untold", ("marker",), "test", sibling_told=False, port_pending=True
        )
        sibling = "prefix\nmarker old\nsuffix\n"
        local = "prefix\nmarker new\nsuffix\n"
        failures = _parity_failures(
            sibling,
            local,
            (untold,),
            len(_changed_lines(_diff_hunks(sibling, local))),
            _delta_digest(sibling, local),
        )

        self.assertTrue(
            any("has NOT" in failure and "untold" in failure for failure in failures),
            failures,
        )

    def test_hunk_matching_is_not_global(self) -> None:
        first = DeclaredDivergence("first", ("marker-first",), "test", False, True)
        second = DeclaredDivergence("second", ("marker-second",), "test", False, True)
        hunks = [
            "@@ -1 +1 @@\n-marker-first\n+marker-first-local\n",
            "@@ -4 +4 @@\n-marker-second\n+marker-second-local\n",
        ]
        self.assertEqual(_hunk_claims(hunks, (first, second)), [[first], [second]])


def main(argv: list[str] | None = None) -> int:
    arguments = sys.argv[1:] if argv is None else argv
    unexpected = [argument for argument in arguments if argument != ALLOW_MISSING_SIBLING]
    if unexpected:
        print(
            "FAIL findings parity check: unexpected argument(s): "
            + ", ".join(unexpected)
        )
        return 2

    allow_missing_sibling = ALLOW_MISSING_SIBLING in arguments
    if not SIBLING_REPO.exists():
        if allow_missing_sibling:
            print(
                "SKIP findings parity check: sibling checkout is unavailable: "
                f"{SIBLING_REPO}; NO comparison was made. "
                f"This missing-sibling failure was waived by {ALLOW_MISSING_SIBLING}."
            )
            return 0
        print(
            "FAIL findings parity check: sibling checkout is unavailable: "
            f"{SIBLING_REPO}; NO comparison was made. Pass "
            f"{ALLOW_MISSING_SIBLING} to waive this failure."
        )
        return 1
    try:
        _read_committed_sibling()
    except AssertionError as error:
        print(f"FAIL findings parity check: {error}")
        return 1

    # Fail-closed, and deliberately not the advisory path. Reaching here means
    # `_read_committed_sibling` already proved git usable and the ref readable,
    # so a probe failure now is anomalous rather than expected, and "could not
    # check" must never exit the same way as "checked and current"
    # (`d-20260830-20`). Sibling MOVEMENT stays advisory below; only a broken
    # probe is fatal.
    try:
        staleness = _pin_staleness(SIBLING_REPO, SIBLING_REF)
    except ProbeFailure as error:
        print(
            "FAIL findings parity check: the pin-staleness probe could not "
            f"run, so the pin was NOT checked: {error}"
        )
        return 1
    if staleness:
        print(STALENESS_HEADING)
        for line in staleness:
            print(f"  {line}")
        for item in STALENESS_REMEDY:
            print(f"  REMEDY {item}")
        print(STALENESS_ADVISORY_NOTE)

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(FindingsParity)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
