# Chief AI Prompt Machine MCP stack

Last reviewed: 2026-08-29

Chief AI Prompt Machine is a public prototype SPA with browser-local prompt state and a Cloudflare Worker runtime. Its default MCP stack supports repository inspection, current documentation, isolated browser verification, and a public ProofMode remote MCP without pretending a private prompt backend already exists.

## Public ProofMode remote MCP

The Worker serves `POST /mcp` as a stateless, read-only evidence server:

- MCP `2026-07-28`: per-request `_meta`, `MCP-Protocol-Version`, `Mcp-Method`/`Mcp-Name` header validation, `server/discover`, result types, deterministic tools, and cache hints;
- compatibility: initialization-based `2025-11-25`, `2025-06-18`, and `2025-03-26` clients;
- tools:
  - `audit_repository` reads public GitHub repository evidence and emits a `juss-proof/v1` receipt;
  - `lookup_dependency_docs` sends one focused public documentation query to Context7 using an exact Context7 library ID and returns `chief-documentation-evidence/v1`;
- caller credentials are not accepted by either tool;
- `CONTEXT7_API_KEY`, when configured, is server-side only and is forwarded only as authorization to the fixed `https://mcp.context7.com/mcp` endpoint;
- Context7 endpoint overrides are not caller-configurable;
- documentation responses are byte-bounded and receive deterministic query/content SHA-256 fingerprints;
- repository evidence never becomes live runtime verification, and documentation evidence never becomes repository/runtime/provider/review/merge/deploy authority;
- privacy/authority: no cookies, device fingerprinting, private prompt data, provider mutation, repository write, approval, merge, deploy, migrate, send, or delete authority.

Founder Control Room is the canonical private paired connector for ChatGPT and Claude. It exposes Chief under the namespaced `chief_*` tools, binds OAuth identity/project scope, and persists redacted evidence. Chief continues to own reasoning/proposal composition; FCR owns auth, policy, exact-head/evidence binding, and execution gates.

## Connected servers

| Server | Purpose | Boundary |
| --- | --- | --- |
| `github` | Repository, pull requests, Actions, code scanning, and secret scanning | Selected toolsets; lockdown enabled while public |
| `context7` | Current documentation for TypeScript, ESLint, Vitest, browser APIs, and future reviewed SDKs | Documentation evidence only; fixed remote MCP endpoint; no private prompts, product data, founder secrets, or authority promotion |
| `playwright` | Verify Builder, Freestyle, benchmark, prompt-library, and live MCP flows | Pinned package, isolated Chromium profile, synthetic prompt fixtures only |

## Context7 evidence contract

`lookup_dependency_docs` intentionally requires an exact Context7 library ID instead of accepting a library-name search or arbitrary URL. This keeps the runtime path to one bounded provider lookup and avoids turning Chief into a general web proxy.

Example request:

```json
{
  "name": "lookup_dependency_docs",
  "arguments": {
    "libraryId": "/microsoft/typescript",
    "query": "For TypeScript compiler configuration, what does noEmit do while type checking?"
  }
}
```

The response binds:

- provider and fixed source endpoint;
- exact `libraryId` and focused query;
- retrieval timestamp;
- SHA-256 query fingerprint;
- SHA-256 content fingerprint;
- bounded documentation text;
- explicit false authority for action, repository verification, runtime verification, review, merge, and deploy.

This is current-docs evidence, not a proof receipt. A documentation answer may change a proposed implementation, but it cannot make a source/runtime/provider claim green by itself.

## Deliberately excluded

- Supabase, DBHub, and generic database MCP servers until a private server-side prompt store is selected and implemented.
- Cloudflare provider mutation and private operational logs as MCP tools. The Worker runtime exists, but ProofMode exposes only public evidence.
- Netdata until persistent owned hosts exist.
- Figma/Canva as standing MCP defaults; add a design connector only for a named source-design implementation workflow.
- GitHub Insiders, Docker GitHub MCP, unpinned packages, committed credentials, and caller-selected provider endpoints.

## Data boundary

Browser-local custom prompt state is prototype state, not durable memory or a secure private store. Do not send private Se'kret Bip, Juss Beautiful Hair, L99, Think Tank, customer, vendor, teen, parent, payment, credential, or unreleased strategy content through Context7 or browser fixtures.

Context7 queries must contain only the minimum public library/API question needed for documentation retrieval. Full prompts, source files, secrets, customer data, and proprietary implementation details stay out of the provider query.

## Verification prompts

```text
Use GitHub MCP to inspect the prompt Builder and benchmark code paths and report dead controls, unsafe persistence assumptions, and missing tests. Do not change code.
```

```text
Use Chief MCP lookup_dependency_docs with /microsoft/typescript to verify the installed TypeScript compiler behavior before proposing configuration changes. Treat the result as documentation evidence only.
```

```text
Use Playwright in an isolated Chromium profile with synthetic prompts to test the library, Builder, Freestyle, benchmark, and exact-head MCP flows. Do not load private prompt collections.
```

## Validation

```bash
npm run verify:mcp
npm run typecheck
npm run lint
npm test
```

Live proof additionally runs `e2e/proofmode-mcp.pw.mjs` against the deployed exact head. It exercises both the modern stateless discovery path and legacy initialization path, audits the exact public repository head, and performs one real Context7 lookup for Chief's current TypeScript dependency through `lookup_dependency_docs`.

Add backend, database, deployment, or monitoring capabilities only in the same reviewed change that introduces the corresponding real architecture.
