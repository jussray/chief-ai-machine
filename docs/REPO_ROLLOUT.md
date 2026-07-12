# Global AI Contract and Guardrail Rollout Ledger

This ledger records where the shared founder stack, provider contracts, product vision, executable guardrails, and Playwright verification have been proposed or merged.

Canonical founder stack:

```text
/garyvee lindymode redteam l99 redteam ooda
```

The first redteam attacks the premise. The second attacks the selected implementation.

## Current rollout

| Repository | Doctrine PR | Implementation PR | Scope | Status |
|---|---:|---:|---|---|
| `jussray/chief-ai-machine` | #3 | #3 | Canonical doctrine, provider guides, vision, bounded browser imports, runtime guardrails, Playwright and CI | Open; require Playwright success |
| `jussray/Sekret-Bip` | #331 | #349 | Canonical teen-safety vision, privacy/consent/identity runtime registry, Playwright public-surface verification | Doctrine merged; implementation open |
| `jussray/founder-control-room` | #1 | #7 | Founder authority, separate data boundary, public-safe guardrail status, protected project access verification | Doctrine merged; implementation open |
| `jussray/l99-` | #14 | #14 | Provenance, isolation, revocation, event truth, creator/operator separation, Playwright and CI | Open; require unit and Playwright success |
| `jussray/jussbeautifulhair-site` | #3 | #3 | Customer-truth vision, Stripe redirect allowlist, policy/mobile/secret Playwright verification | Open; require typecheck, build, and Playwright success |
| `jussray/untold-stories-storefront` | #4 | #5 stacked on #3 | Shopify/Hydrogen vision, checkout-domain validation, public guardrail route, Playwright and CI | Foundation #3 first; then retarget #5 to main |

## Implementation standard

A repository is not considered rolled out merely because it contains persuasive Markdown. Each active product repository should have, where technically applicable:

- a canonical `docs/VISION.md`;
- a versioned `docs/GUARDRAILS.md` with stable IDs;
- runtime enforcement or a machine-readable guardrail registry;
- public-safe status evidence that exposes no secrets or private user data;
- Playwright verification of user-visible boundaries, routes, redirects, mobile behavior, and secret minimization;
- lower-layer tests for rules a browser cannot prove, including RLS, RPCs, migrations, tenant isolation, deletion, revocation, and provider authentication;
- CI that runs the appropriate checks before merge;
- an explicit rollback path.

Playwright verifies observable behavior. It does not magically inspect a database policy through the glass, a limitation browser automation continues to handle with surprising dignity.

## Intentionally not modified

The rollout did not write to obvious duplicate, legacy, demo, backup, or ambiguous-source repositories. Those should receive the contract only after one canonical source of truth is chosen, otherwise global doctrine becomes another species of merge conflict.

No canonical Think Tank repository was identified in the accessible repository list during this rollout.

## Merge discipline

Merge approval is repository-specific; approving one does not automatically approve the others. A workflow file is not proof that its workflow passed.

After merge, each repository should record:

- merge commit;
- Playwright and lower-layer check results;
- any conflicts with newer project-local instructions;
- whether guardrails are discoverable by the intended runtime and agent;
- deployment status as a separate fact;
- rollback commit or recovery procedure;
- next review date when provider behavior or product boundaries materially change.

## Drift rule

`global/GLOBAL_AI.md` and `docs/OPERATING_MODES.md` in Chief AI are the canonical shared doctrine. Project repositories may add stricter local rules, but must not weaken privacy, security, evidence, approval, provenance, rollback, or truthfulness.
