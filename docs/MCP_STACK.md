# Chief AI Prompt Machine MCP stack

Last reviewed: 2026-07-14

Chief AI Prompt Machine is currently a public prototype SPA with browser-local prompt state. Its default MCP stack supports repository inspection, current documentation, and isolated browser verification without pretending a private backend already exists.

## Connected servers

| Server | Purpose | Boundary |
| --- | --- | --- |
| `github` | Repository, pull requests, Actions, code scanning, and secret scanning | Selected toolsets; lockdown enabled while public |
| `context7` | Current documentation for TypeScript, ESLint, Vitest, browser APIs, and future reviewed SDKs | Documentation only; no private prompts, product data, or founder secrets |
| `playwright` | Verify Builder, Freestyle, benchmark, and prompt-library flows | Pinned package, isolated Chromium profile, synthetic prompt fixtures only |

## Deliberately excluded

- Supabase, DBHub, and generic database MCP servers until a private server-side prompt store is selected and implemented.
- Cloudflare Builds and Observability until this repository owns a deployed runtime that needs operational evidence.
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

Add backend, database, deployment, or monitoring capabilities only in the same reviewed change that introduces the corresponding real architecture.
