# Test-ledger authority boundary

The exact-head ledger records every discovered GitHub check for visibility, but only checks named in `.control-room/test-ledger.manifest.json` under `policy.requiredChecks` are authoritative for the repository-local aggregate.

Unlisted checks remain visible as advisory evidence and cannot silently acquire merge authority merely by being installed or queued.
