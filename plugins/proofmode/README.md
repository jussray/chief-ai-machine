# ProofMode

> **Don't tell me it works. Show me what the evidence actually proves.**

ProofMode is a read-only evidence engine for software projects. It separates evidence into five layers:

1. **Claimed** — what project documentation says.
2. **Implemented** — what source and project structure support.
3. **Tested** — what test assets and exact-head workflow evidence support.
4. **Deployed** — what deployment configuration or deployment records support.
5. **Verified** — what an independent live runtime witness proves.

The core invariant is strict: **repository evidence is not runtime verification**.

## v0.1 core boundary

- Public GitHub repository evidence only.
- Read-only; no repository mutation capability.
- No user-supplied access tokens.
- Deterministic evidence classification.
- No live runtime witness yet, so `Verified` remains unproven.

## Current branch contents

- `src/github.js` — bounded public-repository evidence loader.
- `src/audit.js` — deterministic five-layer classifier.
- `test/audit.test.js` — evidence-boundary regression tests.
- `docs/PRODUCT_CONTRACT.md` — product invariants and evidence semantics.

The MCP transport/UI adapter is intentionally kept separate from the evidence engine. This branch currently contains the validated core only.
