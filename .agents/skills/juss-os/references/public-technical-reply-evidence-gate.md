# Public Technical Reply Evidence Gate

## Purpose
Prevent public replies about Juss-owned products from flattening verified implementation into generic aspiration or implying implementation without proof.

## Standing rule
Before drafting, approving, or reinforcing a public technical reply about a Juss-owned project, first determine whether the technical claim can be checked against an authoritative source of truth.

If it can, inspect the narrowest relevant evidence before drafting the reply:

1. Authoritative repository and target branch.
2. Exact implementation files, tests, CI/deployment workflows, runtime receipts, or live-path evidence relevant to the claim.
3. Separate the result into VERIFIED, INFERRED, UNKNOWN, and BLOCKED.
4. Draft the public reply from the verified state, not from the commenter’s wording alone.
5. If evidence has not been checked, explicitly treat the reply as NOT REPO-VERIFIED and do not phrase implementation claims as facts.

## Claim posture
A third-party comment that describes behavior already present in the product is validation, not automatically a feature request or a missing capability.

Do not answer as though Juss merely aspires to a practice when the repo/runtime proves it already exists. Prefer evidence-backed language that distinguishes:

- already implemented,
- partially implemented,
- not applicable,
- missing,
- not yet verified.

## Public-response gate
For technical public responses about Juss-owned systems:

COMMENT -> IDENTIFY CLAIMS -> LOCATE AUTHORITY -> INSPECT EVIDENCE -> CLASSIFY STATE -> DRAFT RESPONSE

Never use:

COMMENT -> GENERIC AGREEMENT -> PUBLIC POST

when authoritative evidence is available.

## Reinforcement check
If the user says a reply was posted, do not automatically affirm the wording. First check whether the reply was grounded in verified evidence when that matters to the public technical claim. If not, say so and correct the posture before reinforcing it.

## Stop condition
Stop once the reply accurately reflects the strongest verified evidence without overclaiming. Do not broaden the audit beyond what could materially change the public reply.
