# Founder Content Strategy Decay Audit

## Why this exists

A post can remain factually true and still become strategically stale.

Truth decay asks whether a claim is still true at use time. Strategy decay asks whether this is still the right, differentiated, audience-specific way to tell that true story now.

The two remain separate. A stale strategy must make Chief choose a different story. It may never weaken the truth gate, Sauce Guard, Current You approval, or provider authority.

## Failure chain

```text
verified progress exists
→ a truthful strategy works once
→ founder posts again / feed changes / audience goal changes
→ old hook, frame, brag pattern, CTA, or copy stays easy to reuse
→ system reuses it because the facts are still valid
→ output becomes repetitive, crowded, generic, or aimed at the wrong people
```

## Root causes

1. The canonical founder-content proposal correctly models truth, evidence, temporal class, Current You, and Sauce Guard, but intentionally does not own novelty or audience strategy.
2. Recent own-post memory previously lacked a machine-enforced freshness boundary.
3. Current discourse could be forgotten, stale, or represented with more authority than its source deserved.
4. Strategic bragging needed a final binding to verified public claims, not self-reported evidence hashes.
5. Self-upgrading needed an explicit experiment and repeat detection, not a slogan.
6. Analytics needed a reusable learning shape without becoming publication authority.
7. Strategy itself needed TOCTOU protection so a once-current strategy could not survive a new post or expired market context.

## Strategy Lease

`src/domain/founder-content-strategy.js` defines an advisory `chief-ai/founder-content-strategy-lease`.

A CURRENT strategy requires:

- one primary audience segment;
- what that audience cares about;
- its skepticisms when known;
- credibility signals that should earn attention;
- intended impression and desired action;
- own-post memory observed at or after the latest published artifact;
- a hash of that history rather than raw private post storage;
- optional hash-only learning-signal references;
- fresh market context when current conversation matters;
- explicit market source class;
- crowded-pattern detection;
- one non-repeated hook/frame/proof/closing signature;
- brag claim IDs drawn from the canonical verified public claim set; and
- one deliberate improvement experiment.

### Freshness is not authenticity

A current external-feed observation may be fresh enough to guide differentiation while still being only `submitted-unverified` for authority.

Therefore:

- `external-research` and `founder-observation` are advisory source classes;
- a feed digest proves only the bytes represented by the submitted digest, not that Chief independently authenticated the source;
- strategy evidence is never product-claim proof;
- missing current research is UNKNOWN when research is required, never fabricated;
- a historical/version-bound story may mark market context `not-required` when current discourse genuinely does not matter.

## Product Design contract

The founder-facing surface should keep three planes visually distinct:

```text
TRUTH
verified / historical / stale / superseded / unknown

STRATEGY
current / refresh-own-history / refresh-market-context /
repeated-pattern / repeated-copy / crowded-angle / audience-missing

AUTHORITY
proposal-only / founder-approved / dispatched / reconciled
```

A founder should be able to see:

- who the post targets;
- what that audience cares about;
- what makes it skeptical;
- which credibility signals the story uses;
- the chosen angle or counter-position;
- the proof-backed capability being bragged about;
- what was withheld as sauce;
- the experiment that makes this post improve on the last one; and
- what would invalidate the strategy before publication.

Do not collapse these into one green badge.

## Data Analytics contract

Safe strategy analytics may retain sanitized observations such as:

- own-post count;
- strategy-pattern count;
- normalized-draft fingerprint count;
- hash-only learning-signal count;
- crowded-pattern count;
- repeated-hook count;
- emerging-conversation count;
- retired-pattern count;
- target-audience category;
- presence of an improvement experiment; and
- sanitized post-publication outcome classifications.

Do not retain raw feed text, raw old posts, private metric payloads, customer data, private prompts, raw diffs, provider payloads, credentials, or chain-of-thought merely to make strategy memory work.

Analytics may influence the next strategy. It may not authorize publication, renew claim truth, reinterpret engagement as product traction, or bypass Sauce Guard.

## Strategic brag boundary

> Show the capability. Hide the recipe.

Brag about demonstrable capabilities, failure detection, authority boundaries, rollback behavior, runtime witnesses, user value, or verified engineering progress.

Do not leak proprietary prompts, scoring/routing internals, raw diffs, credentials, private metrics, unreleased roadmap, customer/private data, security-sensitive mechanics, or provider payloads.

The normal composition path builds the canonical Truth + Sauce proposal first, derives the verified public claim IDs from that proposal, then permits the Strategy Lease to select brag IDs only from that final set. Caller-supplied "verified" brag IDs cannot widen the set.

## FutureYOU / self-upgrading invariant

The newest published artifact must be represented in strategy memory before the next strategy is considered current.

Each new strategy must define one deliberate improvement experiment. Exact reuse of a recent hook/frame/proof/closing signature is blocked.

The final canonical public draft is also normalized and SHA-256 fingerprinted. Exact or trivially reformatted repetition of a recent draft is blocked without retaining raw old copy.

Preserve strengths without copying the same post.

## Use-boundary revalidation

Strategy is subject to the same class of time-of-check/time-of-use failure as operational truth.

Before a Strategy Lease binds to the canonical proposal:

- re-read the current own-history digest;
- reject if a newer post changed it;
- reject if required market context expired;
- reject if a selected brag disappeared from the final verified public claim set.

A Strategy Lease that was CURRENT yesterday is not standing authority today.

## OODA / L99 loop

```text
OBSERVE
current product truth
+ latest own-post memory
+ current discourse when relevant
+ sanitized learning signals

ORIENT
separate truth from strategy
separate freshness from source authentication
identify audience cares / skepticisms / credibility signals
identify crowded patterns
identify proof-backed brag
identify sauce boundary

DECIDE
choose differentiated angle
choose one improvement experiment
issue advisory Strategy Lease

ACT
build canonical Truth + Sauce proposal
revalidate Strategy Lease at use boundary
Current You controls publication authority
provider executes only through governed route

LOOP
capture publication artifact
record sanitized outcome learning
refresh own-post memory
invalidate the old Strategy Lease
```

## Redteam invariants

1. A truthful claim does not make a repeated strategy good.
2. Strong engagement does not make a false claim true.
3. Fresh strategy does not renew stale operational evidence.
4. Fresh market context is not authenticated product truth.
5. Missing required live-feed evidence is UNKNOWN, never fabricated research.
6. A strategic brag must survive the final canonical verified-public-claim set.
7. Raw sauce is never required to prove sophistication.
8. Own-post memory predating the latest publication is stale.
9. Exact recent strategy-signature reuse is blocked.
10. Exact/trivially reformatted final copy reuse is blocked by fingerprint.
11. A crowded angle is blocked unless a deliberate counter-position and reason exist.
12. Analytics may teach the next post but may not authorize it.
13. Learning signal hashes are references, not authenticated outcome proof.
14. The Strategy Lease stays outside FCR's canonical publication-authority hash.
15. Changing audience, newest post, draft strategy, or required market context invalidates old strategy.
16. Product-generated content must distinguish proposal, founder approval, dispatch, and provider reconciliation.
17. Forbidden raw/private fields fail closed before entering strategy memory.

## Architecture

```text
verified product progress
        ↓
canonical Truth + Sauce proposal
        ↓
verified public claim set
        ↓
Chief Strategy Lease (advisory)
        ↓
audience + angle + brag + experiment
        ↓
use-boundary strategy revalidation
        ↓
FCR validation + Current You authority
        ↓
provider execution
        ↓
observable publication artifact
        ↓
sanitized / hash-only learning
        ↓
next Strategy Lease
```

This keeps the content system self-improving without making the learning or strategy system self-authorizing.
