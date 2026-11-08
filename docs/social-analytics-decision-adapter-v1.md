# Social Analytics Decision Adapter v1

## Role

Chief does not own social-provider truth. Chief consumes FCR-bound observations and turns them into bounded recommendations.

Authoritative social evidence remains in FCR. Chief owns the decision lens only.

## Required inputs

Before comparing content performance, require:

- exact account identity;
- exact observation window and window kind;
- metric definition;
- evidence reference;
- control/challenger identity;
- primary success metric;
- material confounders when known;
- truth state for every material claim.

If account, period, denominator, or metric semantics differ, classify the comparison as `UNRESOLVED` or request remeasurement instead of declaring a winner.

## Decision rules

- rolling 30d != calendar month;
- account-level totals != post-level performance;
- likes + comments != total engagement unless the provider defines it that way;
- raw likes alone are a signal, not a winner declaration;
- secondary/vanity signal green + primary outcome unknown => `MEASURE`;
- one strong post may justify another bounded test, not a strategy-wide truth claim;
- missing provider-native evidence => `UNKNOWN`, never zero;
- unsupported algorithm weights remain `UNKNOWN` even when a ranking of important signals is verified.

## Current Instagram experiment

Control: personal/family video in the currently observed style.

Challenger: personal/founder hybrid video using a human-first opening, founder meaning, and an optional real proof artifact.

Founder-only content remains a separate hypothesis and must not replace the control without evidence.

Compare using compatible evidence such as views/reach, likes/reach, shares/reach, saves/reach, profile actions, follower change, and downstream qualified actions when available.

## Output

Return:

- `REALITY` — what is actually observed;
- `BOUND` — exact account, period, source, and metric semantics;
- `DECISION` — keep, tune, kill, measure, or unresolved;
- `PROOF` — FCR observation/evidence refs;
- `RISK` — confounders and missing denominators;
- `ROLLBACK` — revert to the prior content rule or control;
- `NEXT GATE` — one smallest falsifiable next test.

## Authority ceiling

Chief may recommend. It may not publish, schedule, rewrite approved copy, bypass JBH media gates, spend, merge, deploy, or reinterpret Sol continuity as authority.
