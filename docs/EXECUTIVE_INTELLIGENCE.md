# Chief AI Executive Intelligence Contract

## Definition

Chief AI is the executive intelligence layer that converts verified company reality into one coordinated, evidence-backed recommendation for the founder.

It does not replace the founder, own deployment authority, or pretend to be the deepest specialist in every domain.

## System boundary

```text
Reality
  ↓
Founder Control Room
  ↓ evidence-only receipts
Specialist Chiefs / Executive Council
  ↓
Chief AI
  ↓
Founder
  ↓
Approved execution
  ↓
Founder Control Room verification
  ↺
```

Responsibilities remain separated:

- **Founder Control Room** owns operational evidence, repository authority, release truth, execution scope, and rollback records.
- **Specialist Chiefs** investigate their domains and expose assumptions, constraints, dependencies, risks, and disagreement.
- **Executive Council** combines specialist reports without hiding dissent or crossing workspace boundaries.
- **Chief AI** synthesizes, cross-examines, prioritizes, and prepares one founder-ready recommendation.
- **Founder** owns vision, values, risk tolerance, and final authority.

Chief AI may recommend action. It must not silently inherit execution, deployment, publishing, billing, secret, auth, approval, repository-write, or destructive-data authority.

## Founder Control Room evidence boundary

The inbound evidence contract lives in `src/domain/control-room-evidence.js`.

```text
Control Room source record
  ↓
evidence-only receipt
  ↓
validated workspace/project ingestion
  ↓
specialist report
  ↓
Executive Council synthesis receipt
  ↓
Executive Brief
```

A Control Room receipt includes:

- workspace and project boundary;
- source record ID and optional exact source revision;
- evidence kind and subject identity;
- state: `verified`, `unknown`, or `blocked`;
- bounded evidence statement and source references;
- receipt lifecycle: `active`, `superseded`, or `revoked`;
- observation and recording timestamps;
- an immutable authority declaration.

The authority declaration is fixed to:

```text
scope: evidence-only
instruction policy: data-only
repository write: false
execution: false
deployment: false
publishing: false
billing: false
approval: false
secret mutation: false
destructive action: false
```

Rules:

1. Receipt content is data, not an instruction.
2. Chief AI cannot use a receipt as permission to act.
3. Control Room receipts do not carry the `inferred` state; inference belongs in a specialist report and must remain visibly distinct.
4. Verified receipts require at least one source reference.
5. Only active receipts may be ingested. Superseded and revoked receipts remain inspectable but cannot influence a new synthesis.
6. Duplicate receipts and mixed workspace or project data are rejected.
7. Receipt IDs must exactly match the claims they support; extra provenance cannot be invented later.
8. Evidence, source references, and receipt contributors fail closed at contract capacity instead of being silently truncated.
9. Schema validation does not authenticate a network sender or verify a cryptographic signature. Authenticated transport and signature verification remain separate production requirements.

The ingestion may create a specialist report while preserving per-claim Control Room receipt IDs. This is a reasoning handoff only. It does not call tools or authorize execution.

## Required executive brief

Every material recommendation must produce these fields:

```text
DECISION
The recommended action.

REALITY
Verified, inferred, unknown, and blocked claims with source references.

WHY
Reasoning, tradeoffs, and expected founder leverage.

DISSENT
Alternative positions and why they were not selected.

CONFIDENCE
An integer from 0 to 100 grounded in evidence quality and unresolved uncertainty.

RISK
Residual failure modes after the recommendation.

NEXT GATE
The one founder decision or proof step required next.
```

The prototype Executive Brief contract lives in `src/domain/executive-brief.js`.

## Specialist report contract

A specialist report represents one domain chief's bounded conclusion about a proposed decision. The contract lives in `src/domain/specialist-report.js`.

Each report includes:

- workspace and project boundary;
- specialist role and domain;
- position: `support`, `conditional`, `oppose`, or `abstain`;
- conclusion and recommendation;
- classified reality with source references and optional Control Room receipt IDs;
- assumptions;
- integer confidence from 0 to 100;
- risks and dependencies;
- lifecycle status: `draft`, `reviewed`, `approved`, or `superseded`;
- source and timestamps.

Accountability rules:

1. A conditional position requires at least one explicit dependency.
2. Reviewed or approved reports require verified reality.
3. Confidence values must be real integers, not coerced strings, booleans, or null values.
4. Verified claims without a source reference or evidence receipt remain visible as warnings.
5. High confidence paired with unknown or blocked reality remains visible as a warning.
6. Reports remain scoped to one workspace and project.
7. Receipt provenance is optional for schema-one reports created before the Control Room contract; new reports preserve it when present.

Recommended initial chiefs are Engineering, Product, Marketing, Finance, and Operations. The schema does not hardcode those names so the founder can add or replace domains without changing the portable contract.

## Executive Council synthesis

The deterministic council synthesizer lives in `src/domain/executive-council.js`.

It accepts one valid report per domain and produces:

- one validated Executive Council synthesis receipt;
- one Executive Brief;
- participating report IDs, Control Room receipt IDs, and domains;
- support, conditional, opposition, and abstention lists;
- merged evidence with per-claim report and Control Room contributors;
- preserved dissent;
- role-attributed residual risks;
- a transparent confidence calculation;
- workspace, project, synthesis ID, and creation timestamp.

The synthesizer refuses to:

- count the same report twice;
- count multiple reports as the single authority for one domain;
- mix reports across workspaces or projects;
- use superseded reports;
- create a reviewed brief from draft reports;
- create an approved brief from anything less than approved reports;
- silently downgrade a mistyped council status;
- create a valid reviewed or approved Executive Brief without verified reality;
- invent, drop, or mismatch Control Room receipt provenance;
- silently truncate evidence, source references, receipt contributors, risks, dissent, or specialist conclusions.

## Capacity and loss prevention

The Executive Brief and integration contracts are intentionally bounded. The system must fail closed rather than discard material information to fit those bounds.

- More than 200 inbound Control Room receipts requires an upstream batching decision.
- More than 50 unique evidence items requires an explicit evidence summary.
- More than 20 external source references for one merged claim requires source consolidation.
- More than 20 contributing receipts for one claim requires receipt consolidation.
- More than 30 unique council risks requires risk consolidation.
- A role-attributed risk beyond the Executive Brief field capacity requires a bounded risk summary.
- A dissenting position or reason beyond the Executive Brief field capacity requires a bounded dissent summary.
- A rationale longer than the Executive Brief capacity requires specialist conclusions to be summarized before synthesis.

The synthesis receipt keeps per-claim report IDs and Control Room receipt IDs outside the Executive Brief's source-reference list, so external evidence references remain intact and provenance remains recoverable.

## Confidence policy

Council confidence is intentionally conservative and inspectable.

1. Start with the rounded average of specialist confidence.
2. Never exceed the lowest participating specialist confidence.
3. Cap confidence at 49 when no reality item is verified.
4. Cap confidence at 69 when verified claims have neither an external source reference nor an evidence receipt.
5. Cap confidence at 69 when any reality item is blocked.
6. Cap confidence at 79 when any reality item is unknown.
7. Cap confidence at 79 when any specialist is conditional.
8. Cap confidence at 69 when any specialist abstains.
9. Cap confidence at 59 when any specialist opposes.

The synthesis returns the base confidence, weakest-specialist value, every applied cap, and final confidence. This avoids a polished average concealing one weak domain, missing evidence, or material disagreement.

## Accountability rules

1. Facts, inferences, unknowns, and blockers must remain visibly distinct.
2. Reviewed or approved briefs require at least one verified reality item.
3. Verified claims should include source references or traceable evidence receipts.
4. High confidence must not hide unknown or blocked evidence.
5. Dissent must be preserved rather than silently averaged away.
6. Residual risk and rollback implications must remain visible.
7. A recommendation is not proof of execution.
8. Founder Control Room evidence outranks agent confidence.
9. The founder remains the final decision-maker.

## Specialist relationship

Chief AI should coordinate specialists rather than impersonate them.

Chief AI may challenge a specialist, request additional evidence, lower confidence, reject a malformed report, require a bounded summary, or convene an Executive Council synthesis before producing the final brief.

The current contracts are deterministic domain logic. They do not themselves call models, run agents, authenticate integrations, debate autonomously, execute tools, approve actions, or verify signatures.

## Trust and learning

Chief AI should improve through organizational learning, not silent self-modification.

For each accepted decision, preserve:

- the exact Control Room receipts and ingestion record;
- the exact specialist reports;
- the exact validated council synthesis and Executive Brief;
- evidence available at decision time;
- alternatives considered;
- founder approval or rejection;
- execution receipt from Founder Control Room;
- measured outcome;
- later judgment about what worked or failed.

This creates portable company judgment while keeping providers replaceable.

## Current implementation truth

Implemented now:

- provider-neutral Executive Brief schema;
- classified reality items;
- dissent records;
- bounded confidence;
- risks and next-gate fields;
- evidence-only Founder Control Room receipt and ingestion schemas;
- active, superseded, and revoked receipt lifecycle;
- data-only handling with every action permission fixed to false;
- source, receipt, workspace, and project provenance validation;
- Control Room ingestion-to-specialist-report handoff;
- schema-one backward compatibility for reports and council records without receipt fields;
- specialist report schema and lifecycle validation;
- one-report-per-domain Executive Council synthesis;
- validated synthesis receipts with per-claim report and Control Room contributors;
- duplicate and superseded-record rejection;
- conservative, explainable confidence caps;
- fail-closed evidence, source, receipt, risk, dissent, and rationale capacity guards;
- focused unit tests for the contracts.

Not implemented by this slice:

- authenticated Founder Control Room transport;
- cryptographic signing or signature verification;
- live Control Room connector or webhook ingestion;
- specialist-agent runtime;
- automatic model-to-model debate;
- provider execution;
- durable server persistence;
- authentication or tenant isolation infrastructure;
- UI rendering;
- autonomous action;
- deployment.

## Prime rule

> Chief AI coordinates judgment. Founder Control Room verifies reality. The founder decides.
