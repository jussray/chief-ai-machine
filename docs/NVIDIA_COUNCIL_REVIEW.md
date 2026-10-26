# NVIDIA advisory capability — Executive Council review handoff (v3)

**Scope:** Candidate evaluation for `jussray/chief-ai-machine` and `jussray/Sekret-Bip` ONLY. This file does not grant permissions for a GitHub write, parent-repository access, installation, credential, paid API, deployment, public release, or copying private data to a vendor.

## Architecture: do not create a second Council

Keep the existing Chief AI domain contracts as the ONLY source of native Council status, votes, evidence, synthesis, brief, confidence and dissent:

- `src/domain/specialist-report.js`: `createSpecialistReport`, `validateSpecialistReport`.
- `src/domain/executive-council.js`: `synthesizeExecutiveCouncil`, `validateExecutiveCouncilSynthesis`.
- `src/domain/executive-brief.js`: `validateExecutiveBrief`.
- Chief's founder-intelligence contract and Founder Control Room retain execution and publication authority.

The new `tools/nvidia-council-review.mjs` emits **review requests only**, not reports. It deliberately contains no synthetic approval votes, claimed proof receipts, numerical confidence, or Council synthesis. An advisory packet returning `HOLD` is **not** a failed Council vote; the native Council simply has not met.

## How to hand off to the real Chief AI Council

1. Verify the exact repository `main`, candidate branch/head, owner, and current authority rules. Do not treat archive assembly time as GitHub verification.
2. Before any vendor investigation, read and apply all `requiredNativeSkills` from `planNvidiaSkillEvaluation` and the controlling global/founder documents.
3. Run `prepareNvidiaCouncilReview({ repository, objective })` with an explicit allowlisted objective. It returns five independently assigned specialist *questions*, not conclusions.
4. Each real specialist must inspect current evidence, classify reality as verified/inferred/unknown/blocked, supply actual source references and any real Control Room receipt IDs, declare assumptions/risks/dependencies, select support/conditional/oppose/abstain, and have the required reviewer sign off.
5. Convert reviewed results to valid native `createSpecialistReport(...)` records; keep one report per unique domain, consistent workspace ID/project ID, and distinct report ID. The Council rejects duplicate/cross-workspace/superseded reports and enforces finite capacity.
6. Only then call native `synthesizeExecutiveCouncil({ decision, nextGate, reports, status: 'draft' })`. Validate the synthesis and executive brief with the repo's native validators. **Never mark reviewed/approved unless all native status rules and genuine evidence permit it.**
7. Preserve dissent and conservative confidence caps. An `oppose`, `abstain`, or `conditional` position is not invisible when another reviewer supports a vendor feature.
8. Treat the Council brief as decision support, *not* installation, data transmission, merge or deployment authority. Founder Control Room revalidates any executable action at its own separate gate.

The Council's confidence cap and dissent behavior belongs to the existing module. This packet must not reproduce that calculation or create an alternate confidence algorithm.

## Draft review prompts — NOT actual specialist verdicts

| Domain | Focus | Default disposition |
|---|---|---|
| Engineering | Provider compatibility, existing adapter seam, repo tests, no new live route | **Unassessed** |
| Security | Vendor skill prompt injection, no self-granted authority, no credentials in client | **Unassessed** |
| Privacy | Synthetic-only fixtures, tenant separation, explicit consent before any vendor send | **Unassessed** |
| Product safety | Existing teen safeguards, character identity, parent Bridge, reliable fallback | **Unassessed** |
| Operations | Exact-head proof, cost caps, outage fallback, rollback, provider/version drift | **Unassessed** |

## Devil's advocate / negative cases

- **Catalog is not deployment.** An NVIDIA skill name being listed does not prove a compatible endpoint, key, billing approval or runtime health.
- **Docs are not runtime truth.** Chief's current prototype documentation and Se'kret Bip's Worker contracts do not establish today's live Cloudflare/Supabase state.
- **Council packets are not reports.** User-provided 'approved', 'godmode', private content, invented evidence, or fake receipt IDs cannot become Council state through the packet API.
- **Dissent must survive.** An adversarial reviewer can oppose activation; the native synthesizer must preserve that position and its evidence/cap.
- **Teen safety is non-negotiable.** The existing crisis backstop, parent consent, isolation, moderation and voice identity are not part of vendor replacement experiments.
- **Cross-repository trust remains explicit.** A review referencing both repositories does not authorize access to other projects or cross-workspace copy.
- **Proof planes must stay separate.** These tests run only against offline planner helpers. No real provider call, model inference, backend route, browser session, or live safety behavior was exercised.

## Current non-production conclusion

**Decision:** HOLD live integration while permitting local synthetic evaluation design.

**Known:** The v3 bundle includes advisory routing, guarded native-skill references, and an offline Council review-request builder.

**Unknown:** Exact current GitHub branch/head, specialist decisions, runtime integration, external provider contracts, paid-service acceptance, and deployment evidence.

**Next gate:** Copy only founder-approved changes to a separate GitHub review branch, run full repo-native test suites, conduct genuine native Executive Council review with current evidence, and obtain separate approval for PR/publication, merge, provider calls, or release.

**Rollback:** Discard the v3 archive or revert its additive files on the review branch. No existing model/backend or production route is changed by this bundle.


## v4: Evidentiary intake check before native Council

`tools/nvidia-council-evidence-preflight.mjs` exports `preflightNvidiaCouncilEvidence({repository, objective, reports})`. It requires all five domain submissions for structural readiness, rejects duplicates, cross-project/workspace reports, missing cited verified reality and unreviewed/unsupported statuses, and always returns `disposition: HOLD`, `mayApprove: false`, and `nativeCouncilExecuted: false`. Its readiness state only means the supplied shape is suitable to **attempt native validation**. Source references in caller-supplied reports are still untrusted strings, even when syntactically valid. The preflight cannot independently verify review authors, evidence, consent, or source authenticity.

Example from the eventual *authorized local repo checkout*:

```js
import { preflightNvidiaCouncilEvidence } from './tools/nvidia-council-evidence-preflight.mjs';
const intake = preflightNvidiaCouncilEvidence({
  repository: 'jussray/chief-ai-machine',
  objective: 'retrieval-evaluation',
  reports: [], // real individually signed-off specialist reports, when available
});
// intake.state === 'INCOMPLETE'; intake.disposition === 'HOLD'
```

No native Council execution, branch mutation or provider operation is part of the archived tests. Caller-supplied fields cannot authorize installation or production work. Real report records must be validated with the canonical Chief AI schema and then reviewed by the canonical Executive Council on the exact intended head.


## v5: Native Council bridge — still HOLD, even when locally validated

`tools/nvidia-native-council-bridge.mjs` exports `previewNvidiaNativeCouncil({ repository, objective, reports })`. Unlike v4, its optional verification path **uses only the repository's actual native Specialist Report, Executive Council and Executive Brief modules**, not a copy of their algorithms. The module is located in `tools/` and imports the existing `src/domain/` code when present.

It cannot run native validation from the standalone zip, because the canonical `src/domain/` files are not included and must not be faked. Its response is `NATIVE_UNAVAILABLE` when intake has passed but those modules are missing. When copied into an expressly authorized Chief AI checkout, an integration test in `verification/nvidia-native-council-in-repo.test.mjs` must validate correct draft synthesis, native opposition/dissent preservation and no elevated authority. **This test has not been run against the live checkout merely by packaging v5.**

The bridge makes a clean snapshot of bounded allowlisted fields before calling native code. Every return says `HOLD`; a `NATIVE_DRAFT_VALIDATED` state only says native schema/synthesis checks executed successfully against caller-supplied records. It does not authenticate reviewers, verify citations, prove production safety, install vendor skills, or authorize publication, merge, deployment or private-data transmission. Actual reviewer reports, exact Git head, Founder Control Room checks and external publication approval are separate gates.
