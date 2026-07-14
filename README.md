# Chief AI

Chief AI is a **standalone Founder Intelligence OS**.

It turns founder judgment, company context, prompts, workflows, decisions, research, benchmarks, brand voice, and operating playbooks into portable, versioned company intelligence that is not owned by one model provider, Git host, or software platform.

> Use providers. Do not depend on them.

## Product promise

Chief AI helps founders and small teams:

- stop restarting every AI conversation from zero;
- preserve useful company knowledge outside provider chat history;
- distinguish drafts from tested and approved operating assets;
- compare provider output without becoming locked to one provider;
- record what happened when a prompt, workflow, or decision was used;
- export their company intelligence in a portable format.

Chief AI remains useful without GitHub, Founder Control Room, L99, or any specific repository name.

## Current prototype

The current application is a vanilla JavaScript SPA containing:

- **Company Brain** — browser-local intelligence assets for prompts, workflows, decisions, playbooks, benchmarks, brand voice, and research;
- **Prompt Library** — reusable starter systems across supported providers;
- **Builder** — structured prompt composition;
- **Freestyle** — provider-specific prompt templates;
- **Prompt Drafts** — working prompts that are not yet approved company intelligence;
- **Benchmarks** — model-routing guidance;
- **Portable export/import** — versioned company-brain snapshots with backward compatibility for the original custom-prompt export.

Treat the current application as a prototype until private authentication, encrypted sync, durable version history, deletion and recovery, and real provider execution are implemented and verified.

## Product boundaries

```text
Chief AI
thinks, structures, tests, and preserves company intelligence

Founder Control Room
separately authorizes and governs agent execution

L99
optionally verifies provenance, isolation, revocation, and promotion safety
```

These are separate products with optional integrations. Chief AI must not require the other two to deliver its core value.

## Canonical documents

- [`docs/PRODUCT_DOCTRINE.md`](./docs/PRODUCT_DOCTRINE.md) — category, customer problem, product promise, independence tests, boundaries, and MVP
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — portable intelligence domain, storage phases, provider execution, integrations, and security boundaries
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — validation milestones, commercial tests, metrics, and stop conditions
- [`docs/OPERATING_MODES.md`](./docs/OPERATING_MODES.md) — `/garyvee`, `lindymode`, `redteam`, `l99`, and `ooda`
- [`docs/PLATFORM_ROUTING.md`](./docs/PLATFORM_ROUTING.md) — provider roles and cross-tool handoffs

## Domain source of truth

The portable prototype contract lives in:

```text
src/domain/intelligence.js
```

The contract defines:

- intelligence asset kinds;
- draft, tested, approved, and retired states;
- validation;
- versioned updates;
- legacy prompt migration;
- portable snapshot export and import.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test
```

The prototype can be served as static files using any local web server.

## Platform guides

- [`docs/CHATGPT.md`](./docs/CHATGPT.md)
- [`docs/PERPLEXITY.md`](./docs/PERPLEXITY.md)
- [`docs/FIGMA.md`](./docs/FIGMA.md)
- [`docs/CANVA.md`](./docs/CANVA.md)
- [`docs/SHOPIFY.md`](./docs/SHOPIFY.md)

## Security posture

The current browser-local mode is suitable only for controlled prototype use. Do not treat localStorage as secure multi-device company storage.

Production claims require:

- private workspace authorization;
- encrypted persistence;
- tenant-isolation tests;
- export and deletion lifecycle;
- recovery drills;
- bounded logging;
- server-side provider secrets;
- explicit human approval before irreversible action.

## Prime directive

> Product truth, company memory, private data, decisions, approved workflows, and export rights belong to the customer.
