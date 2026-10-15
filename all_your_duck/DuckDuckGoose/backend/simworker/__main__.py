"""Worker process entrypoint: ``python -m simworker --run-dir <dir>``.

CWD is switched to the run dir (oasis writes ./log there). SIGTERM/SIGINT
set the engine's module-level stop flag, which the round loop and wait mode
check — the worker finishes the current round, emits sim_finished, and
exits cleanly."""

import argparse
import asyncio
import os
import signal
from pathlib import Path

from simworker import engine


def _request_stop(signum, frame) -> None:  # noqa: ARG001 (signal signature)
    engine.STOP_REQUESTED.set()


def main() -> None:
    parser = argparse.ArgumentParser(prog="simworker")
    parser.add_argument(
        "--run-dir", required=True,
        help="run directory containing run.json and worker inputs",
    )
    args = parser.parse_args()
    run_dir = Path(args.run_dir).resolve()
    os.chdir(run_dir)
    signal.signal(signal.SIGTERM, _request_stop)
    signal.signal(signal.SIGINT, _request_stop)
    asyncio.run(engine.run(run_dir))


if __name__ == "__main__":
    main()
