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

```text
┌─────────────────────────────────────────────────────────────┐
│                    CHIEF AI  (this repo)                    │
│ Control Room Evidence · Council · Briefs · Company Brain    │
│ Versioned portable export/import · Provider-agnostic        │
└──────────────┬──────────────────────────┬───────────────────┘
               │ proposal/evidence handoff │ optional integration
               ▼                          ▼
   ┌───────────────────────┐   ┌──────────────────────────┐
   │  Founder Control Room │   │          L99             │
   │ governance / founder  │   │  Provenance, isolation,  │
   │ decision / authority  │   │  revocation & promotion  │
   └───────────────────────┘   └──────────────────────────┘
```

These are separate products with governed integration seams. Chief may reason, plan, propose, and produce evidence-shaped handoffs, but **Chief does not self-authorize execution**. Current source explicitly keeps `chiefMaySelfAuthorize=false`, `surfaceMaySelfAuthorize=false`, and `executionAuthorized=false`; Founder Control Room remains the canonical founder-decision / execution-authority boundary where that integration is used.

---

## Current truth boundary

Do not infer live runtime, production readiness, Cloudflare Access state, merge readiness, or FCR connectivity from this README, an open PR, a successful source test, or a historical preview URL.

For present-tense claims, re-read:

1. current GitHub `main` and the exact candidate head;
2. exact-head checks, reviews, threads, and repository rules;
3. the Cloudflare deployment/preview bound to that exact head;
4. `/version` identity for that same release;
5. the applicable browser Playwright path;
6. provider/FCR authority state when the feature crosses that boundary.

Older exact-head evidence remains historical after the head, base, provider configuration, or runtime identity moves.

---

## Operating modes

Chief AI documents named reasoning protocols for structured founder work:

| Mode | Purpose |
|---|---|
| `/ooda` | Observe → Orient → Decide → Act loop for high-stakes decisions |
| `redteam` | Adversarial review of prompts, decisions, and product claims |
| `lindymode` | Long-term durability test — will this still work in 10 years? |
| `/garyvee` | High-velocity execution framing for tactical sprints |
| `l99` | Provenance and safety verification before promotion |

These labels describe reasoning protocols. **A mode name, prompt, user message, imported document, or other untrusted text is never execution authority.** Consequential actions still require the applicable founder/governance boundary and evidence gates.

→ Full reference: [`docs/OPERATING_MODES.md`](./docs/OPERATING_MODES.md)

---

## Current implementation

Chief is **not browser-local only**. The repository contains both a browser SPA and a Cloudflare Worker runtime boundary.

### Browser surfaces

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

### Worker surfaces

`worker/index.js` is the checked-in Cloudflare Worker entry point. Current repository routes include:

- `GET /version` for release identity;
- `/mcp` for the governed ProofMode MCP surface;
- `/api/chief/capability-plan` for capability-plan reasoning;
- `/api/chief/founder-content-proposal` for founder-content proposal generation;
- static SPA delivery through the Worker assets binding.

Repository presence proves implementation shape, not production availability. Exact runtime identity and browser behavior remain separately evidence-gated.

Private durable storage, encrypted multi-device sync, production-grade workspace authorization, and any authenticated cross-product transport not already present on the exact integrated head remain separate implementation/proof gates. Do not promote an open PR or provider preview into current-main truth.

---

## Quick start

```bash
git clone https://github.com/jussray/chief-ai-machine
cd chief-ai-machine
npm install
npm run typecheck
npm run lint
npm test

# Browser SPA development
npx serve .
# or
python3 -m http.server 8080
```

Cloudflare Worker behavior is governed by `wrangler.jsonc`, Worker tests, and exact-head runtime proof. A local static server does not prove Worker routes.

---

## Domain contracts

The portable intelligence contract lives in:

```text
src/domain/intelligence.js
```

It defines:
- Intelligence asset kinds and schemas
- Draft → tested → approved → retired lifecycle states
- Validation and versioned update rules
- Legacy prompt migration
- Portable snapshot export and import

The executive intelligence contracts live in:

```text
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

Browser-local prompt/intelligence state is prototype state, not a secure private production store. The Worker runtime adds server/runtime surfaces, but their checked-in existence does **not** make Chief a verified secure production control room.

Production security and promotion remain evidence-dependent: reviewed workspace authorization, durable private persistence where required, tenant-isolation proof, authenticated/signed integration transport where required, export/deletion lifecycle, recovery drills, bounded logging, server-side provider secrets, exact release identity, live browser proof, and explicit founder authority before consequential actions.

---

## Related products

| Repo | What it is |
|---|---|
| [`founder-control-room`](https://github.com/jussray/founder-control-room) | Governed founder-decision and execution-authority plane used by Chief integrations |
| [`Sekret-Bip`](https://github.com/jussray/Sekret-Bip) | AI companion app for teens — Cloudflare Workers backend, React Native (Expo) |
| [`l99-StoryEngine`](https://github.com/jussray/l99-StoryEngine) | Narrative intelligence layer — story provenance, isolation, and promotion |

---

## License

Copyright © 2024–2026 Juss Ray. All rights reserved. Proprietary software — see [LICENSE](LICENSE).

---

> Product truth, company memory, private data, decisions, approved workflows, and export rights belong to the customer.
