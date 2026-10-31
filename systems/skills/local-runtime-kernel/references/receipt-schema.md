# Receipt schema

```json
{
  "claim": "Se'kret Bip signup works for a stranger on prod",
  "depth": "full",
  "slots": {
    "WHAT":  {"status": "PROVEN",    "evidence": ["playwright:trace-2026-10-03.zip"]},
    "WHERE": {"status": "PROVEN",    "evidence": ["https://example.prod/signup"]},
    "WHEN":  {"status": "PROVEN",    "evidence": ["sha:abc123", "deploy:gen-42"]},
    "HOW":   {"status": "CANDIDATE", "evidence": ["log:worker-tail.txt"]},
    "WHY":   {"status": "UNKNOWN",   "evidence": [], "causal": false}
  },
  "who": {
    "REQUESTED":  {"status": "PROVEN",  "actor": "juss", "identity": ["chat:msg"], "action": ["chat:msg"], "authority": ["founder"]},
    "AUTHORIZED": {"status": "PROVEN",  "actor": "juss", "identity": ["..."], "action": ["..."], "authority": ["..."]},
    "EXECUTED":   {"status": "PROVEN",  "actor": "claude-session", "identity": ["..."], "action": ["commit:abc123"], "authority": ["fix-branch only"]},
    "OBSERVED":   {"status": "UNKNOWN"},
    "VERIFIED":   {"status": "PROVEN",  "actor": "playwright-ci", "identity": ["..."], "action": ["..."], "authority": ["..."]},
    "DECIDED":    {"status": "UNKNOWN"}
  },
  "must": ["WHAT", "WHERE", "WHEN"],
  "prospective_authority": {"status": "PROVEN", "evidence": ["founder approved fix branch"]},
  "phase": "PROVE",
  "state": "VERIFIED"
}
```

Status values: `UNKNOWN`, `CANDIDATE`, `PROVEN`. Phases: `DECLARE, PERMIT, ATTEMPT, RECORD, PROVE, DECIDE`.
States: `VERIFIED, FAILED, UNKNOWN, RECONCILING, BLOCKED`.

Missing WHO roles default to UNKNOWN. `causal: true` on WHY means the evidence is a trace, diff, or
reproduction linking cause to effect — not timing alone.
