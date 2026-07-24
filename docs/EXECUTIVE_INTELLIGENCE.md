# Chief AI Executive Intelligence Contract

## Definition

Chief AI is the executive intelligence layer that converts verified company reality into one coordinated, evidence-backed recommendation for the founder.

It does not replace the founder, own deployment authority, or pretend to be the deepest specialist in every domain.

## System boundary

```text
Reality
  ↓
Founder Control Room
  ↓
Specialist Chiefs / Executive Council
  ↓
Chief AI
  ↓
Founder
  ↓
Approved execution
  ↓
Verification
  ↺
```

Responsibilities remain separated:

- **Founder Control Room** owns operational evidence, repository authority, release truth, execution scope, and rollback records.
- **Specialist Chiefs** investigate their domains and expose assumptions, constraints, and disagreement.
- **Chief AI** synthesizes, cross-examines, prioritizes, and prepares one founder-ready recommendation.
- **Founder** owns vision, values, risk tolerance, and final authority.

Chief AI may recommend action. It must not silently inherit execution, deployment, publishing, billing, secret, auth, or destructive-data authority.

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

The prototype domain contract lives in `src/domain/executive-brief.js`.

## Accountability rules

1. Facts, inferences, unknowns, and blockers must remain visibly distinct.
2. Reviewed or approved briefs require at least one verified reality item.
3. Verified claims should include source references.
4. High confidence must not hide unknown or blocked evidence.
5. Dissent must be preserved rather than silently averaged away.
6. Residual risk and rollback implications must remain visible.
7. A recommendation is not proof of execution.
8. Founder Control Room evidence outranks agent confidence.
9. The founder remains the final decision-maker.

## Specialist relationship

Chief AI should coordinate specialists rather than impersonate them.

A specialist report should include:

- domain conclusion;
- evidence and source references;
- assumptions;
- confidence;
- risks;
- dependencies;
- dissent or unresolved questions.

Chief AI may challenge a specialist, request additional evidence, lower confidence, or convene an executive-council comparison before producing the final brief.

## Trust and learning

Chief AI should improve through organizational learning, not silent self-modification.

For each accepted decision, preserve:

- the exact executive brief;
- evidence available at decision time;
- alternatives considered;
- founder approval or rejection;
- execution receipt from Founder Control Room;
- measured outcome;
- later judgment about what worked or failed.

This creates portable company judgment while keeping providers replaceable.

## Current implementation truth

Implemented in this slice:

- provider-neutral executive-brief schema;
- classified reality items;
- dissent records;
- bounded confidence;
- risks and next-gate fields;
- validation and accountability warnings;
- unit tests for the contract.

Not implemented by this slice:

- specialist-agent runtime;
- automatic executive-council debate;
- Founder Control Room ingestion;
- provider execution;
- durable server persistence;
- authentication or tenant isolation;
- UI rendering;
- autonomous action;
- deployment.

## Prime rule

> Chief AI coordinates judgment. Founder Control Room verifies reality. The founder decides.
