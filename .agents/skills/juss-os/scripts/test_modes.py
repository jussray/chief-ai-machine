#!/usr/bin/env python3
import json
from pathlib import Path
import subprocess
import sys
import unittest

import confess
import truthmode
from evidence_core import diagnose_runtime_boundary


SCRIPT = Path(__file__).resolve().parent / "ultrathink.py"


class TruthModeTests(unittest.TestCase):
    def test_direct_runtime_evidence_verifies(self):
        out = truthmode.audit({"claims": [{"claim": "route answered", "evidence": [{
            "source_kind": "runtime", "supports": True, "direct": True, "fresh": True
        }]}]})
        self.assertEqual(out["claims"][0]["label"], "VERIFIED")

    def test_authoritative_contradiction_disproves(self):
        out = truthmode.audit({"claims": [{"claim": "deployed", "evidence": [{
            "source_kind": "deployment", "supports": False, "direct": True, "fresh": True
        }]}]})
        self.assertEqual(out["claims"][0]["label"], "DISPROVEN")

    def test_runtime_who_remains_unknown_until_proven(self):
        b = diagnose_runtime_boundary({
            "request": "GET /", "response": "403",
            "producer": "Cloudflare", "producer_proven": False,
            "stages": [
                {"name": "edge", "received": True, "evidence": "trace-1"},
                {"name": "origin", "received": False, "evidence": None},
            ],
        })
        self.assertEqual(b["last_proven_received"], "edge")
        self.assertEqual(b["first_unproven_forward_transition"], "origin")
        self.assertEqual(b["who_produced_outcome"], "UNKNOWN")

    def test_contradictions_are_explicit(self):
        out = truthmode.audit({"contradictions": [{"topic": "status", "left": "DRAFT", "right": "Founder-Approved"}]})
        self.assertEqual(out["summary"]["contradictions"], 1)


class ConfessTests(unittest.TestCase):
    def test_claimed_state_above_proof_is_exposed(self):
        out = confess.audit({"claims": [{
            "claim": "done", "actual_label": "PARTIAL",
            "claimed_state": "DEPLOYED", "proven_state": "COMMITTED",
        }]})
        self.assertEqual(len(out["buckets"]["CLAIMED_TOO_EARLY"]), 1)
        self.assertEqual(out["summary"]["overclaims"], 1)

    def test_inherited_claim_is_named(self):
        out = confess.audit({"claims": [{
            "claim": "17 commits", "actual_label": "UNKNOWN", "inherited": True,
            "claimed_state": "PLANNED", "proven_state": "PLANNED",
        }]})
        self.assertEqual(len(out["buckets"]["INHERITED_FROM_ANOTHER_MODEL"]), 1)

    def test_verified_claim_goes_to_known(self):
        out = confess.audit({"claims": [{
            "claim": "tests passed", "actual_label": "VERIFIED",
            "attempted": True, "claimed_state": "LOCALLY VERIFIED", "proven_state": "LOCALLY VERIFIED",
        }]})
        self.assertEqual(len(out["buckets"]["KNOWN"]), 1)
        self.assertEqual(out["summary"]["overclaims"], 0)


class CliEndToEndTests(unittest.TestCase):
    def run_cli(self, mode, payload):
        return subprocess.run(
            [sys.executable, str(SCRIPT), mode, "--compact"],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            check=False,
        )

    def test_truthmode_dispatcher_verified_path(self):
        proc = self.run_cli("truthmode", {"claims": [{
            "claim": "runtime answered",
            "evidence": [{"source_kind": "runtime", "supports": True, "direct": True, "fresh": True}],
        }]})
        self.assertEqual(proc.returncode, 0, proc.stderr)
        out = json.loads(proc.stdout)
        self.assertEqual(out["mode"], "/truthmode")
        self.assertEqual(out["claims"][0]["label"], "VERIFIED")

    def test_truthmode_dispatcher_unknown_path_is_nonzero(self):
        proc = self.run_cli("truthmode", {"claims": [{"claim": "producer is Cloudflare", "evidence": []}]})
        self.assertEqual(proc.returncode, 1, proc.stderr)
        out = json.loads(proc.stdout)
        self.assertEqual(out["claims"][0]["label"], "UNKNOWN")

    def test_confess_dispatcher_overclaim_fails_closed(self):
        proc = self.run_cli("confess", {"claims": [{
            "claim": "deployed",
            "actual_label": "PARTIAL",
            "attempted": True,
            "claimed_state": "DEPLOYED",
            "proven_state": "COMMITTED",
        }]})
        self.assertEqual(proc.returncode, 2, proc.stderr)
        out = json.loads(proc.stdout)
        self.assertEqual(out["mode"], "/confess")
        self.assertEqual(out["summary"]["overclaims"], 1)
        self.assertEqual(len(out["buckets"]["CLAIMED_TOO_EARLY"]), 1)


if __name__ == "__main__":
    unittest.main()
