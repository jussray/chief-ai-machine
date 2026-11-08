#!/usr/bin/env python3
"""Self-audit protocol for /confess: expose epistemic and lifecycle overclaim."""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from evidence_core import normalize_label, normalize_state, state_exceeds


def audit(payload: dict[str, Any]) -> dict[str, Any]:
    buckets = {
        "KNOWN": [], "ASSUMED": [], "INHERITED_FROM_ANOTHER_MODEL": [],
        "ATTEMPTED": [], "FAILED": [], "NOT_ATTEMPTED": [], "UNVERIFIED": [],
        "BLOCKED": [], "CONTRADICTED": [], "CLAIMED_TOO_EARLY": [],
        "EVIDENCE_NEEDED_FOR_CLOSURE": [],
    }
    for idx, item in enumerate(payload.get("claims") or [], start=1):
        cid = item.get("id", f"claim-{idx}")
        text = item.get("claim", "")
        actual = normalize_label(item.get("actual_label"))
        record = {"id": cid, "claim": text, "actual_label": actual}

        if actual == "VERIFIED": buckets["KNOWN"].append(record)
        elif actual == "INFERRED": buckets["ASSUMED"].append(record)
        else: buckets["UNVERIFIED"].append(record)
        if item.get("inherited"): buckets["INHERITED_FROM_ANOTHER_MODEL"].append(record)
        if item.get("attempted"): buckets["ATTEMPTED"].append(record)
        else: buckets["NOT_ATTEMPTED"].append(record)
        if item.get("failed"): buckets["FAILED"].append(record)
        if actual == "BLOCKED" or item.get("blocked"): buckets["BLOCKED"].append(record)
        if actual == "DISPROVEN" or item.get("contradicted"): buckets["CONTRADICTED"].append(record)

        claimed_state = normalize_state(item.get("claimed_state"))
        proven_state = normalize_state(item.get("proven_state"))
        if state_exceeds(claimed_state, proven_state):
            buckets["CLAIMED_TOO_EARLY"].append({
                **record, "claimed_state": claimed_state, "proven_state": proven_state,
            })
        if actual != "VERIFIED" or state_exceeds(claimed_state, proven_state):
            buckets["EVIDENCE_NEEDED_FOR_CLOSURE"].append({
                "id": cid,
                "needed": item.get("closure_evidence") or "direct evidence that proves the unverified claim/state",
            })

    overclaim = len(buckets["CLAIMED_TOO_EARLY"]) + len(buckets["CONTRADICTED"])
    return {
        "mode": "/confess",
        "buckets": buckets,
        "summary": {
            "claims": len(payload.get("claims") or []),
            "overclaims": overclaim,
            "blocked": len(buckets["BLOCKED"]),
            "failed": len(buckets["FAILED"]),
        },
    }


def _load(path: str | None) -> dict[str, Any]:
    if path:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return json.load(sys.stdin)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", help="JSON payload; defaults to stdin")
    ap.add_argument("--compact", action="store_true")
    a = ap.parse_args(argv)
    result = audit(_load(a.input))
    print(json.dumps(result, indent=None if a.compact else 2, sort_keys=True))
    return 2 if result["summary"]["overclaims"] else (1 if result["summary"]["blocked"] else 0)


if __name__ == "__main__":
    raise SystemExit(main())
