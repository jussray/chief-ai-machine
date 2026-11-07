#!/usr/bin/env python3
"""Portable ULTRATHINK mode dispatcher."""
from __future__ import annotations

import argparse

import confess
import truthmode


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="mode", required=True)
    for name in ("truthmode", "confess"):
        p = sub.add_parser(name)
        p.add_argument("--input")
        p.add_argument("--compact", action="store_true")
    args = ap.parse_args(argv)
    delegated = []
    if args.input:
        delegated += ["--input", args.input]
    if args.compact:
        delegated.append("--compact")
    return truthmode.main(delegated) if args.mode == "truthmode" else confess.main(delegated)


if __name__ == "__main__":
    raise SystemExit(main())
