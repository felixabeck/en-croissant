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
from dataclasses import dataclass
from difflib import unified_diff
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER = REPO_ROOT / "scripts" / "findings.py"
SIBLING_REPO = Path("/home/felixb/Projekte/chess-tactics-app")
SIBLING_REF = "4c83bf50c55bab8dc4a9babf5797f6cb019766e6"


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
            "failure already in flight. The sibling port remains pending."
        ),
        sibling_told=False,
        port_pending=True,
    ),
)

# Measured from the pinned sibling blob and this tree after walking the sole
# declared hunk. Marker matching alone cannot protect an adjacent edit because
# a zero-context unified diff absorbs it into the same hunk.
EXPECTED_CHANGED_LINES = 20
EXPECTED_DELTA_DIGEST = (
    "b105bb9c577e2e6b61d6a7532c754ccefbfa7b80bb2b2450714a6fc04acac2d4"
)


def _read_committed_sibling() -> str:
    git_dir = subprocess.run(
        ["git", "-C", str(SIBLING_REPO), "rev-parse", "--git-dir"],
        capture_output=True,
        check=False,
        text=True,
    )
    if git_dir.returncode != 0:
        detail = git_dir.stderr.strip() or "git rev-parse --git-dir failed"
        raise AssertionError(
            f"chess-tactics-app sibling checkout is present but unusable: {detail}"
        )
    committed = subprocess.run(
        [
            "git",
            "-C",
            str(SIBLING_REPO),
            "show",
            f"{SIBLING_REF}:scripts/findings.py",
        ],
        capture_output=True,
        check=False,
        text=True,
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


class FindingsParity(unittest.TestCase):
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

    def test_hunk_matching_is_not_global(self) -> None:
        first = DeclaredDivergence("first", ("marker-first",), "test", False, True)
        second = DeclaredDivergence("second", ("marker-second",), "test", False, True)
        hunks = [
            "@@ -1 +1 @@\n-marker-first\n+marker-first-local\n",
            "@@ -4 +4 @@\n-marker-second\n+marker-second-local\n",
        ]
        self.assertEqual(_hunk_claims(hunks, (first, second)), [[first], [second]])


def main() -> int:
    if not SIBLING_REPO.exists():
        print(
            "SKIP findings parity check: sibling checkout is unavailable: "
            f"{SIBLING_REPO}"
        )
        return 0
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(FindingsParity)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
