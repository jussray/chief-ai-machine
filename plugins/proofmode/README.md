# ProofMode

> **Don't tell me it works. Show me what the evidence actually proves.**

ProofMode is a read-only evidence engine for software projects. It separates evidence into five layers:

1. **Claimed** — what project documentation says.
2. **Implemented** — what source and project structure support.
3. **Tested** — what test assets and exact-head workflow evidence support.
4. **Deployed** — what deployment configuration or deployment records support.
5. **Verified** — what an independent live runtime witness proves.

The core invariant is strict: **repository evidence is not runtime verification**.

## v0.1 boundary

- Public GitHub repository evidence only.
- Read-only; no repository mutation capability.
- No user-supplied access tokens.
- Deterministic evidence classification.
- No live runtime witness yet, so `Verified` remains unproven.

## Canonical Cloudflare MCP deployment

The canonical deploy target for v0.1 is this package's stateless Worker:

- `worker.js` — MCP SDK v2 server factory using Cloudflare `createMcpHandler()`.
- `wrangler.jsonc` — Worker deployment configuration; the MCP route is `/mcp`.
- `src/github.js` — bounded public-repository evidence loader.
- `src/audit.js` — deterministic five-layer classifier.
- `test/audit.test.js` — evidence-boundary regression tests.
- `docs/PRODUCT_CONTRACT.md` — product invariants and evidence semantics.

The MCP tools are:

- `audit_repository`
- `inspect_repository_evidence`

Both are read-only. They declare external-network access because they read public GitHub evidence.

## Deployment gate

From `plugins/proofmode/`:

```bash
npm install
npm test
npm run check
npx wrangler deploy --dry-run
npm run deploy
```

A successful deployment should produce a Worker URL whose MCP endpoint is:

```text
https://<worker>.<subdomain>.workers.dev/mcp
```

Do not call ProofMode deployed or verified until the exact deployed Worker passes MCP initialize, tool discovery, and a real `audit_repository` call.

## Legacy/parallel runtime note

The repository may also contain an older manually implemented ProofMode MCP transport under `worker/`. Keep it as historical/parallel evidence unless it is deliberately reconciled. The canonical v0.1 Cloudflare deploy target is `plugins/proofmode/worker.js`; no older runtime is deleted or silently treated as equivalent.
