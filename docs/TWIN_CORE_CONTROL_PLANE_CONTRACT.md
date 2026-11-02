# Twin Core Control Plane Contract

Status: active shared architecture contract
Owner: founder
Applies to: Founder Control Room, Chief AI, PromptOS handoffs, Council/Court routing, workflow productization, and inherited agent/skill behavior.

## Purpose

Founder Control Room and Chief AI are the `@Juss V10 Twin Core`.

They cooperate through shared contracts while remaining **standalone peers with different jobs**. Shared doctrine, schemas, receipts, and product packaging must never collapse their identities or responsibilities.

The strongest generic control-plane mechanics from the Se'kret Bip founder Control Room are adopted here as a donor pattern. The donor contributes reusable operating mechanics only. It does not make FCR or Chief into Se'kret Bip, and it does not make Se'kret Bip the center of the portfolio architecture.

## Donor provenance

Historical donor baseline:

- repository: `jussray/Sekret-Bip`
- observed source: `main@eb7c0861ba6ab3ed772efc672aff307bad7539fa`
- relevant donor surfaces:
  - `.agents/skills/bip-control-room/SKILL.md`
  - `docs/CONTROL_ROOM_FOUNDER_OPERATOR.md`
  - `scripts/control-room-provenance.mjs`
  - `scripts/control-room-agent.mjs`
  - `scripts/control-room-server.mjs`
  - `scripts/control-room-verify-frontend.mjs`
  - `scripts/control-room-test-skips.mjs`
  - `reports/control-room/**`

This SHA is provenance for the extracted mechanics. It is not a claim that Bip remains unchanged after that commit and is not a runtime dependency for FCR or Chief.

## Adopt mechanics, not identity

### Adopted generic primitives

1. **5W1H mission contract** before material execution or completion claims.
2. **Mission artifact spine**:
   - mission brief;
   - system/dependency map;
   - red-team register;
   - artifact ledger;
   - bottleneck map;
   - verification report;
   - founder decision pack.
3. **One active owner lane per artifact**, with support/advisory lanes unable to become competing writers automatically.
4. **Append-only history** for mission/workflow state, with successor versions pointing to predecessor fingerprints instead of silently overwriting history.
5. **Explicit proof levels** kept separate from task state:
   - `plan-only`;
   - `local-evidence`;
   - `exact-head`;
   - `deployed-observation`;
   - `outcome-verified`.
6. **Proven-only task clearance**: progress, rendering, source implementation, CI, merge, or deploy do not clear a task unless the original goal's required proof level is satisfied.
7. **Allowlisted execution**: free-form founder/user text is never converted directly into shell or provider mutation.
8. **System-owned evidence destinations**: user/browser/model input cannot choose arbitrary filesystem/database authority paths for proof storage.
9. **Bounded execution**: single-writer mutation where required, timeout/stop semantics, bounded output, rollback, and no hidden authority expansion.
10. **Evidence provenance**: canonical content fingerprints, source binding, claim binding, and explicit supersession instead of stale claims silently inheriting forward.
11. **False-green resistance**: skipped, blocked, unavailable, or never-started proof is not converted into pass/fail claims it cannot support.
12. **Human/founder gates stay separate** from plan generation, agent capability, model consensus, or tool availability.
13. **UI render is not runtime proof**. Cards, plans, or dashboards must not be called operational merely because they render.
14. **Proof artifact retention** appropriate to the path, including structured results and browser traces/screenshots/logs when browser proof is required.
15. **Privacy and secret minimization**: founder operations may contain operational metadata but must not ingest unrelated private product-user content or raw credentials.
16. **Recovery is a first-class mission**, not an afterthought.

### Explicitly excluded donor identity

Do not transplant:

- Se'kret Bip branding, characters, language, visual canon, or product identity;
- teen/parent product UX or Bip-specific safety semantics into unrelated products;
- Bip-specific mission IDs as universal portfolio commands;
- Bip route names, app paths, storage keys, report paths, or service names as FCR/Chief canonical names;
- Bip project data or its Supabase data into FCR/Chief operational stores;
- assumptions that Bip is the only or primary project in the portfolio;
- founder-only Bip UI details that do not generalize to a multi-project control plane.

The extraction rule is:

> Copy the control-plane mechanism. Re-express it in portfolio-neutral contracts. Keep the donor's product identity at the donor boundary.

## Twin Core anti-collapse invariant

### Founder Control Room identity

FCR owns the durable governance/execution plane:

- project/workflow registry and durable state;
- user/tenant/project bindings;
- memory and operational evidence;
- approval/authority evaluation;
- guarded execution coordination;
- provider/runtime readback;
- append-only receipts and supersession history;
- task proof/clearance state;
- rollback/recovery state;
- outcome observations;
- product-facing workflow surface.

FCR may display Chief output, call Chief, store Chief receipts, validate Chief plans, and commercially package Chief inside the FCR product experience.

FCR must **not** become the capability selector, reasoning engine, model/agent router, or workflow-candidate compiler merely because Chief is packaged inside its UI.

### Chief AI identity

Chief owns the cognition/routing plane:

- recover the real goal from messy language;
- create the 5W1H mission brief;
- map systems/dependencies;
- convene the smallest relevant Council/Court lanes;
- challenge assumptions and alternatives;
- identify the current bottleneck;
- assign one owner lane per planned artifact;
- select capabilities/models/agents/tools by current evidence;
- compile capability plans;
- detect repeatable work;
- compile FCR `WorkflowCandidate` handoffs;
- synthesize decision packs and next gates.

Chief may read FCR evidence through bounded interfaces and may recommend state transitions.

Chief must **not** become the durable workflow registry, approval engine, external execution authority, provider truth store, or final proof/clearance authority merely because it can reason about those concerns.

### Neither may swallow the other

The following are forbidden architecture states:

```text
FCR == Chief
Chief == FCR
FCR owns Chief identity
Chief owns FCR identity
commercial packaging == technical absorption
shared schema == shared authority
shared receipt == collapsed receipt
one side green == both sides proven
one side failed == both sides failed
model/tool capability == execution permission
```

Both peers remain independently callable and independently versioned. Each keeps its own lifecycle, failure state, receipts, fingerprints, continuity markers, rollback, and proof state.

A cross-system claim requires both relevant sides to contribute their own evidence. Evidence can inform the other peer only after recipient-side validation.

## Shared mission envelope

Both peers understand the same portfolio-neutral mission vocabulary:

```text
contract
mission_id
goal
preserved_constraints
who
what
where
when
why
how
system_map
red_team_register
bottleneck_map
artifact_ledger
required_proof_level
current_proof_level
proof_state
task_state
proof_refs
rollback
version
predecessor_fingerprint
```

Shared vocabulary does not mean identical responsibility.

Chief creates/decomposes the mission envelope and recommends owners/proof.
FCR validates, persists, executes through authorized paths, records evidence, and controls task clearance.

## Core artifact ledger

Every substantial mission should be able to express these artifact IDs without requiring all of them to become files:

- `mission-brief`
- `system-map`
- `red-team-register`
- `artifact-ledger`
- `bottleneck-map`
- `verification-report`
- `founder-decision-pack`

Each artifact records:

- exactly one `owner_lane`;
- zero or more `support_lanes`;
- status;
- required proof;
- evidence references;
- approval gate when applicable;
- rollback/stop notes when applicable.

A support lane may challenge or contribute. It does not silently become a second active writer.

## Proof and task state are different dimensions

Canonical proof order:

```text
plan-only
< local-evidence
< exact-head
< deployed-observation
< outcome-verified
```

Canonical task state:

```text
OPEN
→ ACTIVE
→ BLOCKED / PROOF_PENDING
→ PROVEN
→ CLEARED
```

Rules:

- `CLEARED` requires `PROVEN`.
- `PROVEN` requires evidence at or above the mission's `required_proof_level`.
- exact-head movement, deployment changes, provider changes, or stale evidence can move a task back to `PROOF_PENDING` without changing the task's identity.
- source implementation does not imply merge.
- merge does not imply deploy.
- deploy does not imply runtime verification.
- runtime verification does not imply user/business outcome verification.

## Execution boundary

Chief outputs plans/candidates, never arbitrary shell commands.

FCR execution accepts only registered/allowlisted workflow or action IDs whose authority policy is known. Free-form text can influence parameters only after validation; it does not become executable command text.

For local execution surfaces, preserve the donor's safety principles where applicable:

- local-only binding when a local-only surface is intended;
- fresh ephemeral authentication;
- allowlisted mission/action IDs;
- one active mutating execution per bounded resource when concurrency would create drift;
- timeout and stop semantics;
- bounded output;
- fixed system-owned evidence destinations;
- no raw secrets in reports/logs;
- shutdown/recovery behavior that cannot leave hidden child work running.

Do not copy Bip-specific local server implementation when FCR already has a stronger server/provider boundary. Adopt the invariant, not the file layout.

## Provenance and supersession

Evidence and claims should support deterministic content fingerprints and explicit lineage.

A current claim must be bound to the source/evidence state that justified it. When newer evidence changes the truth:

- preserve the earlier claim as historical provenance;
- mark it superseded/contradicted/stale as appropriate;
- create a successor claim/receipt bound to the new evidence;
- record the strategy or state mutation caused by the new observation;
- never silently rewrite the old claim and pretend it was always true.

## Productization relationship

This contract complements `docs/FOUNDER_WORK_PRODUCTIZATION_CONTRACT.md`.

Chat remains the invention lab. Chief turns repeatable proved patterns into candidates. FCR turns approved candidates into durable user-runnable workflows.

The Bip donor mechanics strengthen that path by making the mission artifact, proof, provenance, history, ownership, and recovery layers explicit.

## Definition of done

This control-plane transplant is not complete merely because this document exists.

For source-level adoption, each repository must have:

- a machine-verifiable mission/proof contract;
- tests for one-owner artifacts, proof-vs-task separation, append-only successor lineage, and anti-collapse responsibility boundaries;
- root/provider/skill inheritance through existing constitutional instruction paths;
- exact-head CI proof.

For runtime adoption, FCR must additionally prove at least one workflow can:

1. receive a Chief mission/candidate packet;
2. persist/validate it without changing Chief identity;
3. execute only an authorized registered action;
4. retain proof and rollback evidence;
5. remain `PROOF_PENDING` until the required proof is satisfied;
6. become `PROVEN` and then `CLEARED` only from valid evidence;
7. run again without reconstructing the internal system in chat.

Until that runtime path is proven, report the transplant as `SOURCE IMPLEMENTED` or `MERGED`, not `RUNTIME VERIFIED`.