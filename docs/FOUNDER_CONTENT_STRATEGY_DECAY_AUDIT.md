# Founder Content Strategy Decay Audit

## Why this exists

A post can remain factually true and still become strategically stale.

Truth decay answers:

> Is this claim still true at the moment we use it?

Strategy decay answers:

> Is this still the right, differentiated, audience-specific way to tell the story now?

The two must remain separate. A stale strategy should make Chief choose a different story. It must never weaken the truth gate, Sauce Guard, Current You approval, or provider authority.

## Failure chain

```text
verified progress exists
→ a truthful post strategy works once
→ founder posts again / feed changes / audience goal changes
→ old hook, frame, brag pattern, or CTA remains easy to retrieve
→ the system reuses it because the facts are still valid
→ public output becomes repetitive, crowded, generic, or aimed at the wrong people
```

This is not factual deception. It is strategic reuse after the context that made the strategy useful has moved.

## Root causes found

1. Chief's founder-content proposal already binds exact truth, Current You, evidence, temporal class, and Sauce Guard, but those controls intentionally do not model audience or novelty.
2. Recent own-post history was a human workflow expectation rather than a machine-checkable freshness boundary.
3. Current-feed comparison could be forgotten or silently guessed when no live source was available.
4. Strategic bragging had no explicit rule requiring the brag to point to a verified public claim.
5. "Self-upgrading" was a process idea, but there was no invariant requiring each new post to carry one deliberate experiment or improvement.
6. Analytics was correctly observation-only, but the sanitized learning output was not shaped into a reusable strategy receipt.

## Strategy Lease

`src/domain/founder-content-strategy.js` defines an advisory Strategy Lease.

A CURRENT strategy requires:

- a specific primary audience;
- intended impression and desired action;
- recent own-post memory observed at or after the latest published artifact;
- a digest of that history instead of requiring raw private post text;
- fresh current-feed context when the strategy depends on current conversation;
- crowded-pattern detection;
- a hook/frame/proof/closing strategy signature not exactly repeated from recent posts;
- one or more brag claim IDs that exist in the verified public claim set; and
- one deliberate improvement experiment.

Current feed is optional only when it is genuinely irrelevant. The system must not claim to have studied what others are posting when no current source was observed.

## Product Design contract

The founder-facing workflow should make these separate states visible:

```text
TRUTH
verified / historical / stale / superseded / unknown

STRATEGY
current / refresh-own-history / refresh-market-context / repeated-pattern / crowded-angle / audience-missing

AUTHORITY
proposal-only / founder-approved / dispatched / reconciled
```

Do not collapse them into one green badge.

A founder should be able to see:

- who the post is targeting;
- what angle was deliberately chosen;
- what crowded pattern was avoided or countered;
- what capability is being bragged about;
- what was intentionally withheld as sauce;
- what experiment makes this post different from the last one; and
- what evidence would invalidate the strategy before publication.

## Data Analytics contract

Safe strategy analytics may record:

- own post count;
- recent pattern count;
- crowded pattern count;
- retired pattern count;
- whether an improvement experiment exists;
- whether the brag is proof-backed;
- target audience category;
- strategy pattern signature;
- post-publication engagement or response classifications when available.

Do not retain raw feed text or private post history solely for strategy memory when a digest/pattern signature is enough.

Analytics may influence the next strategy. It may not authorize publication, renew truth, reinterpret engagement as product traction, or bypass Sauce Guard.

## Strategic brag boundary

The desired public posture is confident and high-signal:

> Show the capability. Hide the recipe.

Brag about what the product demonstrably does, what failure it caught, what boundary it enforces, what user problem it solved, or what verified engineering progress occurred.

Do not brag by leaking:

- proprietary prompts;
- scoring/routing internals;
- raw diffs;
- credentials;
- private metrics;
- unreleased roadmap;
- customer/private data;
- security-sensitive implementation details; or
- provider payloads.

Every brag selected by the structured strategy path must reference an existing verified public claim.

## FutureYOU / self-upgrading invariant

The latest published artifact must be present in strategy memory before the next strategy is considered current.

Every new strategy must define one deliberate improvement experiment. Examples include:

- a new hook family;
- a narrower audience;
- a more technical proof style;
- a failure-first story;
- a stronger counter-position;
- a different CTA;
- a new product-value frame.

Exact reuse of the recent hook/frame/proof/closing signature is blocked.

This does not mean every post must be wildly different. Preserve strengths. Change at least one meaningful strategic dimension on purpose.

## OODA / L99 loop

```text
OBSERVE
current product truth
+ latest own-post memory
+ current external conversation when relevant

ORIENT
separate truth from strategy
identify target audience
identify crowded patterns
identify proof-backed brag
identify sauce boundary

DECIDE
choose distinct angle
choose one strategy experiment
issue Strategy Lease

ACT
build Truth + Sauce proposal
Current You decides publication
provider executes only through existing authority

LOOP
capture publication artifact
record sanitized outcome learning
refresh own-post memory
invalidate old strategy lease
```

## Redteam invariants

1. A truthful claim does not make a repeated strategy good.
2. Strong engagement does not make a false claim true.
3. A fresh strategy does not renew stale operational evidence.
4. Current-feed observations are strategy evidence, never product-truth authority.
5. Missing live feed evidence is UNKNOWN, never fabricated research.
6. A strategic brag must reference a verified public claim.
7. Raw sauce is never required to prove public sophistication.
8. Own-post memory that predates the latest publication is stale.
9. Exact recent strategy-signature reuse is blocked.
10. A crowded angle is blocked unless a deliberate counter-position is declared.
11. Analytics may teach the next post but may not authorize it.
12. The Strategy Lease stays outside FCR's canonical publication-authority hash.
13. Changing audience, draft strategy, newest post, or required market context invalidates the old strategy.
14. Product-generated content must still distinguish proposal, founder approval, dispatch, and provider reconciliation.

## Architecture

```text
verified product progress
        ↓
Chief Strategy Lease (advisory)
        ↓
fresh audience + angle + brag + experiment
        ↓
Chief Truth + Sauce proposal (canonical)
        ↓
FCR validation + Current You authority
        ↓
provider execution
        ↓
observable publication artifact
        ↓
sanitary learning signal
        ↓
next Strategy Lease
```

This keeps the public-content system self-improving without making the learning system self-authorizing.
