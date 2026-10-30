#!/usr/bin/env python3
"""Validate a runtime-kernel receipt. Exit 0 = consistent, 1 = violations."""
import json
import sys

STATUSES = {"UNKNOWN", "CANDIDATE", "PROVEN"}
ROLES = ["REQUESTED", "AUTHORIZED", "EXECUTED", "OBSERVED", "VERIFIED", "DECIDED"]
STATES = {"VERIFIED", "FAILED", "UNKNOWN", "RECONCILING", "BLOCKED"}
PHASES = ["DECLARE", "PERMIT", "ATTEMPT", "RECORD", "PROVE", "DECIDE"]


def check(r):
    errs = []
    slots = r.get("slots", {})
    for name, s in slots.items():
        st = s.get("status", "UNKNOWN")
        if st not in STATUSES:
            errs.append(f"{name}: bad status {st}")
        if st == "PROVEN" and not s.get("evidence"):
            errs.append(f"{name}: PROVEN without evidence")
    why = slots.get("WHY", {})
    if why.get("status") == "PROVEN" and not why.get("causal"):
        errs.append("WHY: PROVEN on correlation/intent only (causal=false)")

    who = r.get("who", {})
    for role in ROLES:
        w = who.get(role, {"status": "UNKNOWN"})
        st = w.get("status", "UNKNOWN")
        if st not in STATUSES:
            errs.append(f"WHO.{role}: bad status {st}")
        if st == "PROVEN":
            if not w.get("actor"):
                errs.append(f"WHO.{role}: PROVEN without actor")
            for k in ("identity", "action", "authority"):
                if not w.get(k):
                    errs.append(f"WHO.{role}: PROVEN missing {k} binding")

    phase = r.get("phase", "DECLARE")
    if phase not in PHASES:
        errs.append(f"bad phase {phase}")
    elif PHASES.index(phase) >= PHASES.index("ATTEMPT"):
        pa = r.get("prospective_authority", {})
        if pa.get("status") != "PROVEN" or not pa.get("evidence"):
            errs.append("acted (phase>=ATTEMPT) without PROVEN prospective authority -> BLOCKED")

    state = r.get("state", "UNKNOWN")
    if state not in STATES:
        errs.append(f"bad state {state}")
    if state == "VERIFIED":
        for m in r.get("must", []):
            if slots.get(m, {}).get("status") != "PROVEN":
                errs.append(f"VERIFIED but Must slot {m} not PROVEN")
        ex = who.get("EXECUTED", {})
        ve = who.get("VERIFIED", {})
        if ve.get("status") != "PROVEN":
            errs.append("VERIFIED but WHO.VERIFIED not PROVEN")
        elif ex.get("actor") and ex.get("actor") == ve.get("actor"):
            errs.append("self-certification: executor == sole verifier")
    return errs


def main():
    if len(sys.argv) != 2:
        print("usage: check_receipt.py receipt.json")
        sys.exit(2)
    with open(sys.argv[1]) as f:
        errs = check(json.load(f))
    if errs:
        print("VIOLATIONS:")
        for e in errs:
            print(" -", e)
        sys.exit(1)
    print("OK: receipt consistent with kernel invariants")


if __name__ == "__main__":
    main()
