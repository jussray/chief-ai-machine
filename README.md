# Chief AI — Founder Intelligence OS

> **Use providers. Do not depend on them.**

Chief AI is a **standalone Founder Intelligence OS** that turns founder judgment, company context, prompts, workflows, decisions, research, benchmarks, and brand voice into portable, versioned company intelligence — owned by the founder, not any model provider, platform, or Git host.

---

## Why this exists

Every AI conversation starts from zero. Useful prompts live in browser history. Approved workflows drift across Notion, Slack, and half-finished docs. When you switch providers, you lose context. When your API key changes, the whole system breaks.

Chief AI solves the **portable intelligence problem** for founders running multi-AI stacks:

- Stop restarting every AI conversation from zero
- Preserve company knowledge outside provider chat history
- Distinguish drafts from tested, approved operating assets
- Compare provider output without locking to one vendor
- Export your entire company brain as a versioned, portable snapshot

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CHIEF AI  (this repo)                    │
│ Control Room Evidence · Council · Briefs · Company Brain    │
│  Versioned portable export/import · Provider-agnostic        │
└──────────────┬──────────────────────────┬───────────────────┘
               │ authorizes execution      │ optional integration
               ▼                          ▼
   ┌───────────────────────┐   ┌──────────────────────────┐
   │  Founder Control Room │   │          L99             │
   │  Agent governance &   │   │  Provenance, isolation,  │
   │  OODA execution loop  │   │  revocation & promotion  │
   └───────────────────────┘   └──────────────────────────┘
```

These are **three separate products with optional integrations**. Chief AI delivers full value without the other two.

---

## Operating modes

Chief AI ships with named operating modes for structured thinking:

| Mode | Purpose |
|---|---|
| `/ooda` | Observe → Orient → Decide → Act loop for high-stakes decisions |
| `redteam` | Adversarial review of prompts, decisions, and product claims |
| `lindymode` | Long-term durability test — will this still work in 10 years? |
| `/garyvee` | High-velocity execution framing for tactical sprints |
| `l99` | Provenance and safety verification before promotion |

→ Full reference: [`docs/OPERATING_MODES.md`](./docs/OPERATING_MODES.md)

---

## Current prototype

The application is a **vanilla JS SPA** running entirely in the browser (no server required for the prototype):

| Module | What it does |
|---|---|
| **Founder Control Room evidence contract** | Accepts evidence-only, data-only receipts with revocation lifecycle, workspace isolation, bounded provenance, and no action authority |
| **Specialist Report contract** | Domain conclusion, evidence, assumptions, position, confidence, risks, dependencies, receipt provenance, and lifecycle |
| **Executive Council synthesizer** | Produces one validated synthesis receipt and Executive Brief while preserving dissent, report and Control Room contributors, workspace boundaries, and conservative confidence caps |
| **Executive Brief contract** | Provider-neutral decision, reality, dissent, confidence, risk, and next-gate schema with accountability checks |
| **Company Brain** | Browser-local intelligence assets: prompts, workflows, decisions, playbooks, benchmarks, brand voice, research |
| **Prompt Library** | Reusable starter systems across supported providers |
| **Builder** | Structured prompt composition with validation |
| **Freestyle** | Provider-specific prompt templates |
| **Prompt Drafts** | Working prompts not yet approved as company intelligence |
| **Benchmarks** | Model-routing guidance by task type |
| **Portable export/import** | Versioned company-brain snapshots with backward compatibility |

> **Status:** prototype — browser-local only. Private auth, encrypted sync, durable version history, provider execution, specialist-agent runtime, authenticated Founder Control Room transport and signature verification, and Executive Brief UI are on the roadmap. See [`docs/ROADMAP.md`](./docs/ROADMAP.md).

---

## Founding pilot — $300

**Chief AI Founder Intelligence Pilot** is a one-time founding engagement for the **first 3 paying users**.

> A focused setup that turns a founder's scattered AI prompts, decisions, workflows and company knowledge into a portable operating brain they own.

The founding pilot includes:

- a company-intelligence inventory;
- workspace setup using the current Chief AI prototype;
- reusable company-intelligence assets;
- a portable export of the resulting company brain; and
- one follow-up review.

**Founding price:** $300 one time.

### Founding subscription — $160/month

For founders who want the system maintained instead of treated as a one-off setup, the recurring option has a **lower entry price** and adds a repeat service loop:

- the initial company-intelligence setup;
- one monthly intelligence review;
- updates, retirement, or refinement of existing intelligence assets based on observed outcomes;
- a refreshed portable export; and
- one follow-up review each month.

**Approved founding subscription price:** $160/month.

The recurring checkout is **not active yet**. Stripe live-account, tax, and recurring-price verification remain the activation gate. Once that path is verified, the first 3 founding customers may choose either the $300 one-time pilot or the $160/month continuity subscription.

This is a hands-on pilot around the current browser-local prototype, **not** a claim of production SaaS, encrypted cloud sync, multi-user collaboration, or managed private hosting. Those capabilities remain separately gated on the roadmap.

**Interested in a pilot?** Start from [Juss Rayy's GitHub profile](https://github.com/jussray) or [Juss & Co](https://jussco.company). Public-build support is also available through [GitHub Sponsors](https://github.com/sponsors/jussray).

## Quick start

```bash
git clone https://github.com/jussray/chief-ai-machine
cd chief-ai-machine
npm install
npm run typecheck
npm run lint
npm test

# Serve locally — any static file server works
npx serve .
# or
python3 -m http.server 8080
```

---

## Domain contracts

The portable intelligence contract lives in:

```
src/domain/intelligence.js
```

It defines:
- Intelligence asset kinds and schemas
- Draft → tested → approved → retired lifecycle states
- Validation and versioned update rules
- Legacy prompt migration
- Portable snapshot export and import

The executive intelligence contracts live in:

```
src/domain/control-room-evidence.js
src/domain/specialist-report.js
src/domain/executive-council.js
src/domain/executive-brief.js
```

They define:
- Evidence-only Founder Control Room receipts with `data-only` handling and every action permission fixed to false
- Active, superseded, and revoked receipt lifecycle with verified, unknown, and blocked evidence states
- Workspace/project isolation, source receipts, bounded ingestion, and fail-closed capacity checks
- Specialist roles, domains, positions, conclusions, evidence, assumptions, confidence, risks, dependencies, and lifecycle states
- One-report-per-domain council synthesis with duplicate, cross-workspace, and superseded-report rejection
- Validated synthesis receipts with per-claim specialist and Control Room contributors; receipt IDs remain provenance pointers, not proof by themselves
- Transparent confidence calculation with weakest-specialist and evidence/disagreement caps
- Fail-closed capacity guards that prevent silent evidence, source, receipt, risk, dissent, or rationale truncation
- Decision, reality, rationale, dissent, risk, and next-gate fields
- Verified, inferred, unknown, and blocked reality classifications
- Review and approval evidence requirements
- Accountability warnings when confidence outruns evidence

---

## Docs

| Document | Contents |
|---|---|
| [`docs/PRODUCT_DOCTRINE.md`](./docs/PRODUCT_DOCTRINE.md) | Category, customer problem, product promise, independence tests, MVP |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Portable intelligence domain, storage phases, provider execution, Control Room evidence boundary, security boundaries |
| [`docs/EXECUTIVE_INTELLIGENCE.md`](./docs/EXECUTIVE_INTELLIGENCE.md) | Control Room receipts, specialist reports, Executive Council synthesis, confidence policy, Chief AI boundary, and implementation truth |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Validation milestones, commercial tests, metrics, stop conditions |
| [`docs/OPERATING_MODES.md`](./docs/OPERATING_MODES.md) | `/garyvee`, `lindymode`, `redteam`, `l99`, `ooda` |
| [`docs/PLATFORM_ROUTING.md`](./docs/PLATFORM_ROUTING.md) | Provider roles and cross-tool handoffs |
| [`docs/industry-signals/ai-tooling-under-the-radar-2026.md`](./docs/industry-signals/ai-tooling-under-the-radar-2026.md) | Evidence-ranked under-the-radar AI tooling trends, risks, and product opportunities |

### Platform guides
[ChatGPT](./docs/CHATGPT.md) · [Perplexity](./docs/PERPLEXITY.md) · [Figma](./docs/FIGMA.md) · [Canva](./docs/CANVA.md) · [Shopify](./docs/SHOPIFY.md)

---

## Security posture

The current browser-local prototype is suitable for **controlled personal use only**.

Production security requires: private workspace authorization · encrypted persistence · tenant-isolation tests · authenticated and signed integration transport · export and deletion lifecycle · recovery drills · bounded logging · server-side provider secrets · explicit human approval before irreversible action.

---

## Related products

| Repo | What it is |
|---|---|
| [`Sekret-Bip`](https://github.com/jussray/Sekret-Bip) | AI companion app for teens — Cloudflare Workers backend, React Native (Expo) |
| [`l99-StoryEngine`](https://github.com/jussray/l99-StoryEngine) | Narrative intelligence layer — story provenance, isolation, and promotion |

---

## License

Copyright © 2024–2026 Juss Ray. All rights reserved. Proprietary software — see [LICENSE](LICENSE).

---

> Product truth, company memory, private data, decisions, approved workflows, and export rights belong to the customer.
