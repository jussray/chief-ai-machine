# Chief AI — Founder Intelligence

> **Use providers. Do not depend on them.**

Chief AI is the **governed cognition and portable company-intelligence layer paired with Founder Control Room**. It turns founder judgment, company context, prompts, workflows, decisions, research, benchmarks, and brand voice into portable, versioned company intelligence owned by the founder, not any model provider, platform, or Git host.

Chief remains technically independent and can deliver standalone reasoning and portable-intelligence value. **Technical independence does not automatically make Chief a separate commercial founder OS.** The default customer-facing founder-software identity is Founder Control Room, with Chief packaged as a monetizable intelligence module inside that product unless separate paid-demand evidence justifies another offer.

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
               │ proposes governed handoff │ optional integration
               ▼                          ▼
   ┌───────────────────────┐   ┌──────────────────────────┐
   │  Founder Control Room │   │          L99             │
   │  Human authority,     │   │  Provenance, isolation,  │
   │  execution & evidence │   │  revocation & promotion  │
   └───────────────────────┘   └──────────────────────────┘
```

Chief AI can deliver standalone reasoning and portable-intelligence value. When an action crosses into execution, provider mutation, repository write, deployment, publication, credentials, billing, or another consequential boundary, Chief remains proposal-only: Founder Control Room is the enforcement/evidence plane and the human founder remains the final authority. L99 remains an optional integration.

### Commercial packaging

```text
Founder / team
→ Founder Control Room workspace
→ Chief intelligence, council, synthesis, and company-brain value
→ important decisions and reusable intelligence
→ retained / upgraded FCR workspace
```

Default commercial truth:

- **customer:** FCR founder or team needing portable company intelligence and structured executive reasoning;
- **payer:** FCR workspace owner by default;
- **revenue mechanism:** included in higher-value FCR plans or premium intelligence capability;
- **repeat engine:** intelligence compounds as approved assets, decisions, evidence, outcomes, and provider comparisons accumulate;
- **North Star:** retained FCR workspaces using Chief for important decisions;
- **next money test:** prove Chief improves FCR activation, retention, paid conversion, or willingness to upgrade.

A separate Chief commercial offer requires independent customer, payer, distinct value, revenue mechanism, repeat-payment evidence, and proof that separate packaging improves paid demand rather than fragmenting the FCR story. Internal use, repository separation, successful tests, or portable export do not prove that gate.

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
| [`docs/PRODUCT_DOCTRINE.md`](./docs/PRODUCT_DOCTRINE.md) | Category, customer problem, product promise, independence tests, commercial packaging, and capability target |
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
| [`Founder Control Room`](https://github.com/jussray/founder-control-room) | Default customer-facing founder-software shell; governance, execution, evidence, outcomes, and commercial packaging |
| [`Sekret-Bip`](https://github.com/jussray/Sekret-Bip) | Privacy-first emotional growth and self-expression product for teens and trusted family relationships |
| [`StoryEngine`](https://github.com/jussray/StoryEngine) | Creator-facing product; L99 provides provenance, isolation, recovery, and promotion runtime underneath it |

---

## License

Copyright © 2024–2026 Juss Ray. All rights reserved. Proprietary software — see [LICENSE](LICENSE).

---

> Product truth, company memory, private data, decisions, approved workflows, and export rights belong to the customer.
