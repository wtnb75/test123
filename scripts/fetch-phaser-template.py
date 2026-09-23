#!/usr/bin/env python3
"""Fetch a fresh Phaser + Vite + TypeScript (Minimal) template from the
official `pnpm create @phaserjs/game@latest` installer into OUTPUT_DIR,
without a human at the keyboard.

OUTPUT_DIR must be a plain relative name with no path separator (e.g.
"game", not "/tmp/x/game") -- the installer itself rejects folder names
containing "/" as invalid. Run this with your working directory already
set to wherever you want the new folder created (see the
scaffold:update-base-template Taskfile task for the intended usage: cd into
a fresh temp dir first).

The installer is an interactive arrow-key wizard; a plain non-interactive
pipe doesn't work because it reads raw keypresses. This drives it through a
pty and always answers the same way: Web Bundler -> vite -> Minimal (Single
Phaser Scene) -> TypeScript -> Y (telemetry consent). That's the choice
`scaffold/base-template/` in this repo is built from -- see AGENTS.md
section 2.2/2.3.

If Phaser changes the wizard's questions or wording, this times out loudly
instead of silently answering the wrong prompt. In that case, run
`pnpm create @phaserjs/game@latest <dir>` by hand in a real terminal,
answer the wizard yourself, and copy the result into
`scaffold/base-template/` manually (same file list as here), then update
SELECTIONS below to match the new wizard.
"""
import fcntl
import os
import pty
import re
import select
import signal
import struct
import sys
import termios
import time

DOWN = b"\x1b[B"
ENTER = b"\r"

# (substring that must appear before we act, keys to send once it does,
# substring that must appear in the resulting confirmation line)
SELECTIONS = [
    ("Select Option:", DOWN * 3 + ENTER, "Web Bundler"),
    ("Select Template:", ENTER, "vite"),
    ("Minimal or Complete Project:", DOWN + ENTER, "Minimal"),
    ("Select Development Language:", ENTER, "TypeScript"),
    ("(Y/n)", b"Y\r", "yes"),
]

PROMPT_TIMEOUT = 60
CONFIRM_TIMEOUT = 10
DRAIN_TIMEOUT = 20
RUNAWAY_BYTES = 5 * 1024 * 1024

STRIP_ANSI = re.compile(rb"\x1b\[[0-9;?]*[A-Za-z]")


def clean(data: bytes) -> bytes:
    return STRIP_ANSI.sub(b"", data)


def die(pid, msg):
    print(msg, file=sys.stderr)
    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    sys.exit(1)


def main():
    if len(sys.argv) != 2:
        print("usage: fetch-phaser-template.py <output-dir>", file=sys.stderr)
        sys.exit(2)
    out_dir = sys.argv[1]
    if "/" in out_dir:
        print("output-dir must be a plain relative name with no '/' "
              "-- the installer rejects paths (see module docstring)", file=sys.stderr)
        sys.exit(2)
    if os.path.exists(out_dir):
        print(f"{out_dir} already exists", file=sys.stderr)
        sys.exit(1)

    pid, fd = pty.fork()
    if pid == 0:
        os.execvp("pnpm", ["pnpm", "create", "@phaserjs/game@latest", out_dir])

    # a bare pty.fork() leaves the window size at 0x0, which makes the
    # installer's spinner busy-loop redrawing forever instead of proceeding
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 120, 0, 0))

    buf = b""

    def read_until(predicate, timeout, on_timeout):
        nonlocal buf
        deadline = time.time() + timeout
        while time.time() < deadline:
            r, _, _ = select.select([fd], [], [], 0.2)
            if fd in r:
                try:
                    data = os.read(fd, 4096)
                except OSError:
                    die(pid, "installer process ended unexpectedly")
                if not data:
                    die(pid, "installer process ended unexpectedly")
                buf += data
                if len(buf) > RUNAWAY_BYTES:
                    die(pid, "installer produced runaway output, aborting")
            if predicate():
                return
        die(pid, on_timeout)

    for wait_for, keys, confirm in SELECTIONS:
        read_until(
            lambda w=wait_for: w.encode() in clean(buf),
            PROMPT_TIMEOUT,
            f"timed out waiting for prompt {wait_for!r} -- wizard flow may have changed",
        )
        os.write(fd, keys)
        read_until(
            lambda c=confirm: c.encode() in clean(buf[-4000:]),
            CONFIRM_TIMEOUT,
            f"did not see confirmation {confirm!r} after answering {wait_for!r}",
        )

    # drain remaining output until the installer exits
    end = time.time() + DRAIN_TIMEOUT
    while time.time() < end:
        wpid, _status = os.waitpid(pid, os.WNOHANG)
        if wpid != 0:
            break
        r, _, _ = select.select([fd], [], [], 0.2)
        if fd in r:
            try:
                data = os.read(fd, 4096)
            except OSError:
                break
            if not data:
                break
            buf += data
            if len(buf) > RUNAWAY_BYTES:
                die(pid, "installer produced runaway output after last prompt, aborting")

    if not os.path.isdir(out_dir):
        print("installer finished but did not create the output directory", file=sys.stderr)
        sys.exit(1)
    print(f"OK: {out_dir}")


if __name__ == "__main__":
    main()
