#!/usr/bin/env python3
"""Evidence-bound baseline and runtime attribution checker for /truthmode."""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from evidence_core import classify_claim, diagnose_runtime_boundary


def audit(payload: dict[str, Any]) -> dict[str, Any]:
    results = []
    for idx, claim in enumerate(payload.get("claims") or [], start=1):
        label, notes = classify_claim(
            claim.get("evidence") or [],
            bool(claim.get("blocked")),
            claim.get("required_source_kind"),
        )
        results.append({
            "id": claim.get("id", f"claim-{idx}"),
            "claim": claim.get("claim", ""),
            "label": label,
            "notes": notes,
            "closure_evidence": claim.get("closure_evidence") or (
                "direct fresh resolved evidence from the required authority" if label != "VERIFIED" else "none"
            ),
        })

    contradictions = []
    for item in payload.get("contradictions") or []:
        if item.get("left") != item.get("right"):
            contradictions.append({
                "topic": item.get("topic", "unspecified"),
                "left": item.get("left"),
                "right": item.get("right"),
                "verdict": "CONTRADICTION",
                "closure_evidence": item.get("closure_evidence", "identify the authoritative source and reconcile the losing claim"),
            })

    return {
        "mode": "/truthmode",
        "claims": results,
        "contradictions": contradictions,
        "runtime_boundary": diagnose_runtime_boundary(payload.get("runtime")),
        "summary": {
            "verified": sum(x["label"] == "VERIFIED" for x in results),
            "unknown_or_blocked": sum(x["label"] in {"UNKNOWN", "BLOCKED"} for x in results),
            "disproven": sum(x["label"] == "DISPROVEN" for x in results),
            "contradictions": len(contradictions),
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
    severe = result["summary"]["disproven"] + result["summary"]["contradictions"]
    return 2 if severe else (1 if result["summary"]["unknown_or_blocked"] else 0)


if __name__ == "__main__":
    raise SystemExit(main())
