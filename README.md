# Chief AI — Founder Intelligence

> **Use providers. Do not depend on them.**

Chief AI is the **governed cognition and portable company-intelligence layer paired with Founder Control Room**. It turns founder judgment, company context, prompts, workflows, decisions, research, benchmarks, and brand voice into portable, versioned company intelligence owned by the founder, not any model provider, platform, or Git host.

**Chief AI is a standalone product.** It owns its customer-facing identity, runtime, permissions, accounts, data, operating evidence, and proposed commercial path. Founder Control Room is a separately owned peer, not a required shell or runtime. Integration or bundling requires explicit permission; customer demand and realized revenue remain unverified until measured.

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

Chief AI provides its own standalone reasoning and portable-intelligence value. Consequential actions remain bounded by Chief's authenticated, product-owned permission and evidence gates. An integration with Founder Control Room must be explicit and scoped; neither peer inherits authority over the other. Founder approval remains necessary where Chief's governance requires it. L99 is optional.

### Commercial packaging

Chief owns its product offer and can serve customers directly, independently of FCR. A Chief subscription, license, or other paid offering is a **proposed** path until real checkout, entitlement, delivery, safety, and retention are verified.

```text
Chief customer
→ Chief-owned account and consent
→ intelligence, council, synthesis, and company-brain value
→ verified customer outcome
→ optional Chief-owned plan and renewal
```

- **customer hypothesis:** founders and teams needing portable, provider-neutral business intelligence;
- **payer hypothesis:** Chief account or workspace owner;
- **revenue hypothesis:** Chief-owned plan or license; an FCR bundle is a separate, permissioned option;
- **repeat engine:** updated approved assets, decisions, and evidence;
- **North Star:** retained Chief customers with verified outcomes;
- **next money test:** Chief activation, willingness to pay, paid conversion, retention, and cost per outcome.

Internal use, repository separation, a green CI run, or an untested checkout are not proof of sales or revenue.

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
| [`Founder Control Room`](https://github.com/jussray/founder-control-room) | Standalone peer with its own identity, authorizations, workflows, deployments, and commercial path; integration with Chief is optional and permissioned |
| [`Sekret-Bip`](https://github.com/jussray/Sekret-Bip) | Privacy-first emotional growth and self-expression product for teens and trusted family relationships |
| [`StoryEngine`](https://github.com/jussray/StoryEngine) | Creator-facing product; L99 provides provenance, isolation, recovery, and promotion runtime underneath it |

---

## License

Copyright © 2024–2026 Juss Ray. All rights reserved. Proprietary software — see [LICENSE](LICENSE).

---

> Product truth, company memory, private data, decisions, approved workflows, and export rights belong to the customer.
