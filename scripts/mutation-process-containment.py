"""One-shot Linux subreaper for Cargo, independent of repository ownership state."""

import ctypes
import json
import os
import signal
import subprocess
import sys
import tempfile
import time

GRACE_SECONDS = 3
POLL_SECONDS = 0.02
stop_signal = None


def enable_subreaper():
    if sys.platform != "linux":
        raise RuntimeError("backend mutation requires Linux PR_SET_CHILD_SUBREAPER")
    if os.environ.get("CHESSFABLE_MUTATION_TEST_PRCTL_FAIL"):
        raise RuntimeError("injected PR_SET_CHILD_SUBREAPER refusal")
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(36, 1, 0, 0, 0) != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))


def identity(pid):
    try:
        with open(f"/proc/{pid}/stat", "rb") as stream:
            fields = stream.read().rsplit(b")", 1)[1].split()
        return int(fields[1]), fields[19].decode()
    except (FileNotFoundError, ProcessLookupError):
        return None


def descendant(pid):
    seen = set()
    current = pid
    while current > 0 and current not in seen:
        if current == os.getpid():
            return True
        seen.add(current)
        record = identity(current)
        if record is None:
            return False
        current = record[0]
    return False


def signal_owned(pid, start_time, signum):
    # pidfd closes the remaining reuse race between the identity check and kill.
    try:
        fd = os.pidfd_open(pid)
    except (FileNotFoundError, ProcessLookupError):
        return
    try:
        record = identity(pid)
        if record is not None and record[1] == start_time and descendant(pid):
            try:
                signal.pidfd_send_signal(fd, signum)
            except (FileNotFoundError, ProcessLookupError):
                pass
    finally:
        os.close(fd)


def signal_descendants(signum):
    for name in os.listdir("/proc"):
        if not name.isdigit() or int(name) == os.getpid():
            continue
        pid = int(name)
        record = identity(pid)
        if record is not None and descendant(pid):
            signal_owned(pid, record[1], signum)


def request_stop(signum, _frame):
    global stop_signal
    if stop_signal is None:
        stop_signal = signum


def exit_code(status):
    return os.waitstatus_to_exitcode(status)


def write_evidence(path, status, cargo_signal, start_time):
    directory = os.path.dirname(path)
    fd, temporary = tempfile.mkstemp(prefix=".terminal-", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf8") as stream:
            json.dump({"pid": os.getpid(), "pidStartTime": start_time,
                       "status": status, "signal": cargo_signal,
                       "no-unwaited-children": True}, stream)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        if os.environ.get("CHESSFABLE_MUTATION_TEST_EVIDENCE_FAIL"):
            raise OSError("injected terminal publication failure after rename")
        directory_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory_fd)
        finally:
            os.close(directory_fd)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def run(argv):
    try:
        enable_subreaper()
        if not hasattr(os, "pidfd_open") or not hasattr(signal, "pidfd_send_signal"):
            raise RuntimeError("Python 3 with Linux pidfd support is required")
        # Probe the kernel capability before any Cargo child, including on --check.
        fd = os.pidfd_open(os.getpid())
        os.close(fd)
    except Exception as error:
        print(f"Backend mutation containment unavailable: {error}. Install Python 3 with Linux subreaper/pidfd support.", file=sys.stderr)
        return 125
    if argv == ["--check"]:
        return 0
    if len(argv) < 3 or argv[1] != "--":
        print("Usage: mutation-process-containment.py evidence-path -- cargo ...", file=sys.stderr)
        return 125
    evidence_path, _, *command = argv
    start_time = identity(os.getpid())[1]
    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, request_stop)
    cargo_status = None
    cargo_signal = None
    child = None
    try:
        child = subprocess.Popen(command)
    except OSError as error:
        print(f"Backend mutation could not spawn {command[0]}: {error}", file=sys.stderr)
        cargo_status = 127
    deadline = None
    forwarded = False
    while True:
        # Drain all adopted children. ECHILD is the only terminal ownership proof.
        try:
            while True:
                pid, status = os.waitpid(-1, os.WNOHANG)
                if pid == 0:
                    break
                if child is not None and pid == child.pid:
                    code = exit_code(status)
                    child.returncode = code
                    cargo_signal = -code if code < 0 else None
                    cargo_status = 128 - code if code < 0 else code
        except ChildProcessError:
            break
        if stop_signal is not None and not forwarded:
            record = identity(child.pid) if child is not None else None
            if record is not None:
                signal_owned(child.pid, record[1], stop_signal)
            forwarded = True
        if cargo_status is not None or stop_signal is not None:
            if deadline is None:
                deadline = time.monotonic() + GRACE_SECONDS
            signal_descendants(signal.SIGTERM if time.monotonic() < deadline else signal.SIGKILL)
            if time.monotonic() > deadline + GRACE_SECONDS:
                raise RuntimeError("descendants could not be reaped within the cleanup deadline")
        time.sleep(POLL_SECONDS)
    # No child can be spawned after this terminal wait, including by evidence writing.
    try:
        os.waitpid(-1, 0)
        raise RuntimeError("unexpected unwaited child after terminal check")
    except ChildProcessError:
        pass
    if cargo_status is None:
        raise RuntimeError("Cargo status is unknown")
    try:
        write_evidence(evidence_path, cargo_status, cargo_signal, start_time)
    except Exception:
        # A post-rename failure must not leave a positive receipt whose Cargo
        # status happens to equal our failure status. If invalidation itself
        # fails, signal death makes Node refuse even a readable positive record.
        try:
            os.unlink(evidence_path)
        except FileNotFoundError:
            pass
        except OSError:
            os.kill(os.getpid(), signal.SIGKILL)
        raise
    return cargo_status


if __name__ == "__main__":
    try:
        sys.exit(run(sys.argv[1:]))
    except Exception as error:
        print(f"Backend mutation containment failed: {error}", file=sys.stderr)
        sys.exit(125)
