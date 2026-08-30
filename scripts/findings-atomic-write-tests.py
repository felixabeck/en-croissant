#!/usr/bin/env python3
"""Regression anchor for ``findings._atomic_write``'s failure reporting.

`scripts/findings.py` is deliberately identical across Felix's projects, so this
file lives beside it rather than inside it: the shared tool carries no
repository-specific code, and this repository has no other Python test suite for
it to join. Run it with ``pnpm findings:test``.

The defect it pins (f-20260829-14): the ``finally`` block used to re-raise a
failing ``tmp.unlink``. A ``raise`` inside ``finally`` replaces the exception
already in flight, so a ledger write that failed *and* whose cleanup then failed
reached the operator as "could not remove /tmp/...tmp-x" while the reason the
ledger could not be written was discarded.
"""

from __future__ import annotations

import importlib.util
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPTS = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("findings_under_test", SCRIPTS / "findings.py")
assert _spec and _spec.loader
findings = importlib.util.module_from_spec(_spec)
# Register before executing: ``@dataclass`` resolves its own class through
# ``sys.modules[cls.__module__]``, which fails for a module that is not there yet.
sys.modules[_spec.name] = findings
_spec.loader.exec_module(findings)


class AtomicWriteFailureReporting(unittest.TestCase):
    def setUp(self) -> None:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / "ledger.md"

    def test_write_failure_survives_a_failing_cleanup(self) -> None:
        """The primary error propagates; the cleanup failure is still reported."""
        write_failure = OSError("no space left on device")
        stderr = io.StringIO()

        with (
            mock.patch.object(findings.os, "replace", side_effect=write_failure),
            mock.patch.object(findings.Path, "unlink", side_effect=OSError("permission denied")),
            mock.patch.object(sys, "stderr", new=stderr),
        ):
            with self.assertRaises(OSError) as caught:
                findings._atomic_write(self.path, "body\n")

        self.assertIs(
            caught.exception,
            write_failure,
            "the cleanup failure replaced the write failure -- f-20260829-14 has regressed",
        )
        self.assertIn("could not clean up temporary file", stderr.getvalue())
        self.assertIn("after a failed atomic write", stderr.getvalue())
        self.assertIn("permission denied", stderr.getvalue())

    def test_cleanup_failure_after_a_committed_write_only_warns(self) -> None:
        """A committed write must never be turned into a failure by its cleanup."""
        stderr = io.StringIO()

        with (
            mock.patch.object(findings.Path, "unlink", side_effect=OSError("permission denied")),
            mock.patch.object(sys, "stderr", new=stderr),
        ):
            findings._atomic_write(self.path, "body\n")

        self.assertEqual(self.path.read_text(encoding="utf-8"), "body\n")
        self.assertIn("could not clean up temporary file", stderr.getvalue())
        self.assertIn("after atomic write", stderr.getvalue())

    def test_the_ordinary_write_leaves_no_temporary_behind(self) -> None:
        findings._atomic_write(self.path, "body\n")
        self.assertEqual(self.path.read_text(encoding="utf-8"), "body\n")
        self.assertEqual([entry.name for entry in self.path.parent.iterdir()], [self.path.name])


if __name__ == "__main__":
    unittest.main(verbosity=2)
