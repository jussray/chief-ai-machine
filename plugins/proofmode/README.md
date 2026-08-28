# ProofMode

> **Don't tell me it works. Show me what the evidence actually proves.**

ProofMode is a read-only evidence engine for software projects. It separates evidence into five layers:

1. **Claimed** — what project documentation says.
2. **Implemented** — what non-test source and project structure support.
3. **Tested** — what test assets and eligible exact-head workflow evidence support.
4. **Deployed** — what deployment configuration or deployment records support.
5. **Verified** — what an independent live runtime witness proves.

The core invariant is strict: **repository evidence is not runtime verification**.

## v0.1 boundary

- Public GitHub repository evidence only.
- Read-only; no repository mutation capability.
- No caller-supplied access tokens.
- Optional server-held GitHub credential may be used for provider quota while private repositories remain rejected.
- Deterministic evidence classification.
- No live runtime witness tool yet, so `Verified` remains unproven by `audit_repository`.
- `pull_request_target` runs are excluded from exact-head test proof because they execute in base-branch context.
- Test files do not count as implementation source.

## Current repository implementation

- `src/github.js` — bounded public-repository evidence loader with workflow provenance.
- `src/audit.js` — deterministic five-layer classifier.
- `src/proof-receipt.js` — `juss-proof/v1` repository-evidence receipt producer.
- `test/audit.test.js` — evidence-boundary regression tests.
- `docs/PRODUCT_CONTRACT.md` — product invariants and evidence semantics.
- `../../worker/proofmode-mcp.js` — Chief AI's served `/mcp` transport and `audit_repository` tool.
- `../../worker/proofmode-mcp.test.js` — served tool/authority contract tests.
- `../../e2e/proofmode-mcp.pw.mjs` — immutable-preview live MCP witness.

Chief AI's Worker mounts ProofMode at `/mcp`. That repository fact proves implementation only; it does not prove that a live production Worker is serving any particular commit.

## Verification

From the repository root:

```bash
npm run verify:proofmode
```

From this nested package:

```bash
npm test
npm run check
```

ProofMode core or served-MCP changes must also pass the immutable Cloudflare preview workflow before they are treated as deployment evidence.

## Protocol boundary

The currently served MCP transport implements the legacy 2025 handshake. The 2026 stateless MCP revision is a separate transport contract and must not be claimed by changing a version string alone. A future migration should use the current MCP/Cloudflare SDK path and must be bundle- and runtime-verified before promotion.
