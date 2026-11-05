# COUNSEL / Lawyer kernel

COUNSEL is a general-purpose legal research kernel for Truth Weaver / Chief. It is not scoped to a single person, state, country, or issue type.

## Foundational invariant

**The governing law is the authority.**

Model output, confidence, summaries, books, articles, blogs, vendor pages, strategic lenses, and prior answers never outrank governing law.

Authority must be resolved by jurisdiction, date/as-of date, issuing body or court, procedural posture, source type, and the hierarchy recognized by the governing legal system. There is no universal hard-coded hierarchy that fits every jurisdiction.

## Research path

`ISSUE → FACTS → JURISDICTION → GOVERNING LAW → ELEMENTS/RULES → EVIDENCE → REMEDIES/DEFENSES → PROCEDURE/DEADLINES → CONTRARY AUTHORITY → OPTIONS`

## Books

Books are first-class research material, but secondary by default. Treatises, hornbooks, practice guides, restatements, legal encyclopedias, law reviews, commentaries, textbooks, historical legal texts, and public-domain legal books are used for:

- doctrine and explanation;
- terminology and issue spotting;
- historical development;
- cross-references and citations;
- finding primary authority;
- identifying competing interpretations and arguments.

A book cannot silently become `VERIFIED LAW`. If a legal system explicitly gives a particular doctrinal source legal force, that must be represented as a jurisdiction-specific rule with evidence.

## VERIFIED LAW guard

A proposition can be promoted to `VERIFIED LAW` only when the current implementation has:

- a resolved governing jurisdiction;
- at least one qualifying primary-law source;
- a citation or official identifier;
- official/authentic status checked;
- currentness/as-of status checked;
- no unresolved contrary primary authority that defeats the proposition.

Otherwise the kernel fails closed to `JURISDICTION UNKNOWN`, `UNVERIFIED LAW`, or `SUPPORTED`.

## Coverage

The architecture is global, but coverage claims are evidence-based. A source appearing in the registry means the source family is known, not that a complete parser, API adapter, or current-law verification path exists for every jurisdiction.

Seed discovery and primary-source families are in `src/source-registry.js`. The Law Library of Congress Guide to Law Online is intentionally treated as a discovery bridge across international, multinational, foreign, U.S. federal, state, territorial, tribal, and local research. Official gazettes, legislatures, regulators, courts, treaty repositories, and official code publications remain the legal authorities for the jurisdiction.

## Truth states

- `VERIFIED LAW`
- `SUPPORTED`
- `ALLEGED FACT`
- `INFERRED`
- `CONTRADICTED`
- `STALE`
- `JURISDICTION UNKNOWN`
- `UNVERIFIED LAW`
- `NOT APPLICABLE`

## Lovable binding

The founder-facing surface is the existing Lovable project **Truth Weaver** (`8ef43cd3-8d93-4494-a685-59ce0f795614`). Lovable is a reasoning/research surface; this repository remains the canonical Chief source-of-truth. Founder Control Room retains authority, provenance, approval, and consequential-action boundaries.
