# Chief AI - Founder Intelligence

> **Use providers. Do not depend on them.**

Chief AI is a **standalone founder-intelligence and portable company-intelligence system**. It turns founder judgment, company context, prompts, workflows, decisions, research, benchmarks, and brand voice into portable, versioned intelligence owned by the founder, not by any model provider, platform, or Git host.

Chief is not a module, shell, or subordinate runtime of Founder Control Room, PromptOS, Sol, or another portfolio product. Those systems can interoperate through explicit contracts, but each keeps its own job, interface, intelligence, architecture, runtime truth, and product identity.

Chief can reason, synthesize, compose capabilities, preserve company intelligence, produce executive judgment, and execute bounded capabilities that belong to Chief itself. Cross-system execution authority is not implied by integration. External publication, provider mutation, repository mutation, deployment, billing, credentials, or other consequential actions require the authority and proof required by the responsible execution boundary.

---

## Why this exists

Every AI conversation starts from zero. Useful prompts live in browser history. Approved workflows drift across Notion, Slack, and half-finished docs. When you switch providers, you lose context. When an API key changes, a provider-dependent workflow can break.

Chief AI solves the **portable intelligence problem** for founders running multi-AI stacks:

- Stop restarting every AI conversation from zero
- Preserve company knowledge outside provider chat history
- Distinguish drafts from tested, approved operating assets
- Compare provider output without locking to one vendor
- Export company intelligence as a versioned, portable snapshot
- Keep reasoning, evidence, and capability selection separable from any one execution provider

---

## Architecture overview

```text
┌──────────────────────────────────────────────────────────────┐
│                    CHIEF AI  (this repo)                    │
│                                                              │
│  Executive reasoning · Council synthesis · Company Brain     │
│  Capability composition · Portable export/import             │
│  Bounded Chief-owned runtimes, including local video render  │
└─────────────────────────────┬────────────────────────────────┘
                              │ explicit optional contracts
              ┌───────────────┼────────────────┬───────────────┐
              ▼               ▼                ▼               ▼
     Founder Control Room   PromptOS           Sol            L99
     governance/evidence    prompt system      intel peer     provenance
     and execution plane    peer integration   integration    integration
```

The topology is **standalone peers, not one shell containing the others**.

Founder Control Room can serve as the governance, evidence, and execution authority for paired workflows under the V10 contract. That relationship does not erase Chief's standalone product or runtime identity. Chief remains independently useful and independently callable. PromptOS, Sol, and L99 integrations are likewise explicit rather than implicit ownership relationships.

### Commercial packaging

Chief is a product in its own right. It may be sold, licensed, piloted, or bundled alongside another Juss product without becoming subordinate to that product.

Default commercial truth for Chief:

- **customer:** founder or team needing portable company intelligence, structured executive reasoning, and provider-independent continuity;
- **payer:** the Chief workspace or deployment owner, or a buyer purchasing Chief as part of an explicit bundle;
- **revenue mechanism:** subscription, license, premium intelligence capability, or paid deployment/service layer without hard-coding a price here;
- **repeat engine:** intelligence compounds as approved assets, decisions, evidence, outcomes, benchmarks, and provider comparisons accumulate;
- **North Star:** retained users who rely on Chief for consequential reasoning and reusable company intelligence;
- **money test:** prove that Chief reduces restart cost, improves decision quality, increases reusable intelligence, or creates paid demand for its own capability.

Bundling is a go-to-market choice. It is not the architecture.

---

## Operating modes

Chief AI ships with named operating modes for structured thinking:

| Mode | Purpose |
|---|---|
| `/ooda` | Observe -> Orient -> Decide -> Act loop for high-stakes decisions |
| `redteam` | Adversarial review of prompts, decisions, and product claims |
| `lindymode` | Long-term durability test: will this still make sense later? |
| `/garyvee` | High-velocity execution framing for tactical sprints |
| `l99` | Provenance and safety verification before promotion |

Full reference: [`docs/OPERATING_MODES.md`](./docs/OPERATING_MODES.md)

---

## Current implementation truth

Chief is no longer accurately described as browser-only. The repository currently contains multiple bounded runtime surfaces.

| Surface / module | What it does |
|---|---|
| **Browser SPA** | Local Founder Intelligence interface and company-brain workflows |
| **Founder Control Room evidence contract** | Accepts evidence-only, data-only receipts with revocation lifecycle, workspace isolation, bounded provenance, and no self-granted action authority |
| **Specialist Report contract** | Domain conclusion, evidence, assumptions, position, confidence, risks, dependencies, receipt provenance, and lifecycle |
| **Executive Council synthesizer** | Produces a validated synthesis receipt and Executive Brief while preserving dissent, contributors, workspace boundaries, and conservative confidence caps |
| **Executive Brief contract** | Provider-neutral decision, reality, dissent, confidence, risk, and next-gate schema with accountability checks |
| **Company Brain** | Browser-local intelligence assets: prompts, workflows, decisions, playbooks, benchmarks, brand voice, research |
| **Prompt Library** | Reusable starter systems across supported providers |
| **Builder** | Structured prompt composition with validation |
| **Freestyle** | Provider-specific prompt templates |
| **Prompt Drafts** | Working prompts not yet approved as company intelligence |
| **Benchmarks** | Model-routing guidance by task type |
| **Portable export/import** | Versioned company-brain snapshots with backward compatibility |
| **Chief video renderer** | Independent Node/FFmpeg image-to-MP4 renderer with bounded motion, ffprobe readback, source/output SHA-256 receipts, and no publish authority |

The video renderer is implemented at `src/domain/video-renderer.js` and exposed through `scripts/render-video.mjs` / `npm run video:render`. It requires `ffmpeg` and `ffprobe` on `PATH` and verifies rendered dimensions, duration, codecs, and output digest before returning `RENDERED`.

> **Status:** the core Founder Intelligence UI is still browser-local, while the repository also contains non-browser runtime capabilities such as the local video renderer. Private auth, encrypted sync, durable server-side version history, provider execution, authenticated cross-product transport, and broader production hardening remain separate gates. Resolve current deployment/runtime state from live evidence rather than treating this README as proof of deployment.

---

## Quick start

```bash
git clone https://github.com/jussray/chief-ai-machine
cd chief-ai-machine
npm install
npm run typecheck
npm run lint
npm test

# Serve the browser UI locally
npx serve .
# or
python3 -m http.server 8080

# Verify Chief's local video renderer
npm run video:proof

# Render from a JSON input file. ffmpeg + ffprobe are required.
npm run video:render -- --input ./path/to/render-input.json
```

---

## Domain contracts

The portable intelligence contract lives in:

```text
src/domain/intelligence.js
```

It defines:

- Intelligence asset kinds and schemas
- Draft -> tested -> approved -> retired lifecycle states
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

- Evidence-only Founder Control Room receipts with `data-only` handling and action permissions fixed by contract
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

Chief's local media runtime lives in:

```text
src/domain/video-renderer.js
scripts/render-video.mjs
```

It defines a bounded Chief-owned render path. Rendering does not grant publication authority.

---

## Docs

| Document | Contents |
|---|---|
| [`docs/PRODUCT_DOCTRINE.md`](./docs/PRODUCT_DOCTRINE.md) | Product doctrine and commercial assumptions; mutable claims must be reconciled with current founder decisions and runtime evidence |
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

The browser-local Founder Intelligence surface is suitable for **controlled personal use only** until its production security gates are proven.

The local video renderer processes local files, verifies its output with `ffprobe`, emits content digests, and explicitly returns `publishAuthority: false`. Rendering an artifact is not permission to publish it.

Production security requires, where applicable: private workspace authorization · encrypted persistence · tenant-isolation tests · authenticated and signed integration transport · export and deletion lifecycle · recovery drills · bounded logging · server-side provider secrets · explicit authority before irreversible external action.

---

## Related first-party systems

These are related systems, not containers for Chief:

| Repo | What it is |
|---|---|
| [`Founder Control Room`](https://github.com/jussray/founder-control-room) | Independent founder operating environment for governance, execution, evidence, continuity, and outcomes; optional Chief peer integration |
| [`PromptOS`](https://github.com/jussray/promptos) | Independent prompt and routing system; optional Chief peer integration |
| [`SolContinuity`](https://github.com/jussray/solcontinuity) | Independent continuity/intelligence system; optional Chief peer integration |
| [`Sekret-Bip`](https://github.com/jussray/Sekret-Bip) | Privacy-first emotional growth and self-expression product for teens and trusted family relationships |
| [`StoryEngine`](https://github.com/jussray/StoryEngine) | Creator-facing product with its own runtime and product boundary |

---

## License

Copyright © 2024-2026 Juss Ray. All rights reserved. Proprietary software. See [LICENSE](LICENSE).

---

> Product truth, company memory, private data, decisions, approved workflows, and export rights belong to the customer.
