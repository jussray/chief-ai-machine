# Chief AI Prompt Machine MCP stack

Last reviewed: 2026-08-25

Chief AI Prompt Machine is a public prototype SPA with browser-local prompt state and a Cloudflare Worker runtime. Its default MCP stack supports repository inspection, current documentation, isolated browser verification, and a public ProofMode remote MCP without pretending a private prompt backend already exists.

## Public ProofMode remote MCP

The Worker serves `POST /mcp` as a stateless, read-only repository evidence server:

- MCP `2026-07-28`: per-request `_meta`, `MCP-Protocol-Version`, `Mcp-Method`/`Mcp-Name` header validation, `server/discover`, result types, deterministic tools, and cache hints;
- compatibility: initialization-based `2025-11-25`, `2025-06-18`, and `2025-03-26` clients;
- tool: `audit_repository` only;
- input: public GitHub owner/repo/ref plus optional receipt acknowledgements; caller-supplied credentials and unknown arguments are rejected;
- output: layered repository evidence and a `juss-proof/v1` receipt; repository evidence never becomes live runtime verification;
- privacy/authority: no cookies, device fingerprinting, private prompt data, provider mutation, repository write, approval, merge, deploy, migrate, send, or delete authority.

Founder Control Room is the canonical private paired connector for ChatGPT and Claude. It exposes Chief under the namespaced `chief_*` tools, binds OAuth identity/project scope, and persists redacted evidence. Chief continues to own reasoning/proposal composition; FCR owns auth, policy, exact-head/evidence binding, and execution gates.

## Connected servers

| Server | Purpose | Boundary |
| --- | --- | --- |
| `github` | Repository, pull requests, Actions, code scanning, and secret scanning | Selected toolsets; lockdown enabled while public |
| `context7` | Current documentation for TypeScript, ESLint, Vitest, browser APIs, and future reviewed SDKs | Documentation only; no private prompts, product data, or founder secrets |
| `playwright` | Verify Builder, Freestyle, benchmark, and prompt-library flows | Pinned package, isolated Chromium profile, synthetic prompt fixtures only |

## Deliberately excluded

- Supabase, DBHub, and generic database MCP servers until a private server-side prompt store is selected and implemented.
- Cloudflare provider mutation and private operational logs as MCP tools. The Worker runtime exists, but ProofMode exposes only public repository evidence.
- Netdata until persistent owned hosts exist.
- Figma/Canva as standing MCP defaults; add a design connector only for a named source-design implementation workflow.
- GitHub Insiders, Docker GitHub MCP, unpinned packages, and committed credentials.

## Data boundary

Browser-local custom prompt state is prototype state, not durable memory or a secure private store. Do not send private Se'kret Bip, Juss Beautiful Hair, L99, Think Tank, customer, vendor, teen, parent, payment, credential, or unreleased strategy content through Context7 or browser fixtures.

## Verification prompts

```text
Use GitHub MCP to inspect the prompt Builder and benchmark code paths and report dead controls, unsafe persistence assumptions, and missing tests. Do not change code.
```

```text
Use Context7 to verify the installed TypeScript, ESLint, and Vitest APIs before proposing configuration changes.
```

```text
Use Playwright in an isolated Chromium profile with synthetic prompts to test the library, Builder, Freestyle, and benchmark flows. Do not load private prompt collections.
```

## Validation

```bash
npm run verify:mcp
npm run typecheck
npm run lint
npm test
```

Live proof additionally runs `e2e/proofmode-mcp.pw.mjs` against the deployed exact head and exercises both the modern stateless discovery path and legacy initialization path.

Add backend, database, deployment, or monitoring capabilities only in the same reviewed change that introduces the corresponding real architecture.
