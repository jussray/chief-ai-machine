# Public Communication Truth Contract

This contract applies before publishing, scheduling, sending, announcing, promoting, pitching, or otherwise presenting ecosystem work to the public, partners, customers, investors, collaborators, or internal stakeholders who may reasonably treat the communication as an execution claim.

## Required posting loop

```text
/futureyou
→ /truthmode
→ /confess
→ Audience and harm check
→ Evidence check
→ Accounting-control check
→ Authorization check
→ Draft
→ Review or approved automation
→ Publish or hold
→ Capture the published artifact
→ Record outcome evidence
→ Reconcile and correct
```

## /futureyou

Before posting, ask:

> Will the future version of the founder, team, customer, or community be able to understand what was actually true when this was published?

A durable post should preserve context rather than manufacture a cleaner history. It must not create promises, expectations, or interpretations that future builders cannot support.

## /truthmode

Every material claim must be classified against its actual proof layer:

```text
Planned
Built
Tested
CI-verified
Deployed
Runtime-observed
Used by people
Produced an outcome
```

One layer does not prove another. Do not describe committed code as deployed, a triggered workflow as successful, a draft as published, a scheduled post as delivered, a model response as an external action, or attention as customer impact.

## /confess

Before release, state internally and, when material to the audience, publicly:

```text
Known
Inferred
Assumed
Unknown
Blocked
Still needing verification
```

Corrections must be direct. Do not bury a mistake beneath promotional language or silently edit history when a public correction is warranted.

## Accounting-control principles for automated posting

The founder authorizes automated publication only when the post and its workflow satisfy all of these controls:

- **Completeness:** all material facts, limitations, dependencies, and known exceptions needed to avoid a misleading impression are included.
- **Accuracy:** every factual, financial, operational, usage, partnership, deployment, and outcome claim matches recorded evidence.
- **Consistency:** terms, statuses, metrics, time periods, and classifications are applied the same way across posts and records unless a documented reason explains a change.
- **Cut-off:** events are attributed to the correct date and period; planned, pending, completed, and later-occurring events are not blended together.
- **Evidence and traceability:** each material claim can be traced to a source artifact, record, run, message, URL, ledger entry, or other durable evidence.
- **Authorization:** the post belongs to an approved automated publishing class and does not exceed that class's audience, channel, topic, frequency, or risk boundary.
- **Separation of record and promotion:** promotional language may summarize verified records but may not alter, replace, or overstate them.
- **Conservatism:** when evidence is incomplete or ambiguous, use the less expansive claim or hold the post.
- **Reconciliation:** after publishing, compare the intended post, platform artifact, publication time, links, and status; record mismatches.
- **Correction and audit trail:** preserve what was published, why, by which workflow, under which authorization, and how any error was corrected.

This is an internal control framework inspired by sound accounting practice. It is not a representation that a post, workflow, or repository has received an external audit or formal GAAP opinion.

## Standing founder authorization

The founder has approved automated posting as a class when, and only when, the workflow passes this contract and the accounting-control principles above.

This standing authorization removes the need for per-post founder approval for compliant posts inside the approved class. It does not authorize:

- invented, estimated, or unsupported financial results;
- claims of revenue, profit, valuation, funding, customers, users, partnerships, endorsements, deployment, or impact without evidence;
- disclosure of private, sensitive, contractual, security-relevant, or legally restricted information;
- changes to prices, financial commitments, contracts, payments, fundraising terms, legal positions, or binding promises;
- crisis communications, admissions of liability, political statements, or other high-consequence communications not explicitly approved as a separate class;
- bypassing a hold condition because a scheduler or model is technically able to publish.

Any post outside these boundaries requires fresh founder approval.

## Posting requirements

Every material post must have:

- a clear purpose and intended audience;
- evidence supporting each execution or outcome claim;
- honest status language;
- disclosure of material uncertainty or limitation;
- no invented metrics, testimonials, partnerships, users, revenue, deployment, or approval;
- no implication of founder approval when only an agent drafted the content;
- a reviewable draft or an approved automated publishing class;
- a captured URL, platform artifact, message ID, or equivalent evidence after publication;
- a correction path when the post becomes inaccurate.

## Status language

Prefer precise language:

- "planned" when it is an intention;
- "in development" when work exists but is incomplete;
- "committed" when code or documentation is stored;
- "tested locally" only with local test evidence;
- "CI verified" only with an observable successful run;
- "deployed" only with deployment evidence;
- "live" only with runtime evidence at the public destination;
- "used" or "helped" only with evidence of human use or outcome.

## Hold conditions

Hold the post when:

- a key claim cannot be traced to evidence;
- the accounting-control check does not pass;
- the post falls outside the approved automated publishing class;
- the post depends on a workflow that failed before executing steps;
- private, sensitive, or security-relevant information could be exposed;
- urgency is being used to bypass truth or review;
- the post would make a reasonable reader believe more was completed than the evidence proves.

## Completion standard

A posting workflow is not complete when a draft exists, a scheduler accepted it, or an automation was triggered.

It is complete only when the intended publication artifact is observable, its claims remain accurate, the platform result is reconciled, and the evidence is recorded.