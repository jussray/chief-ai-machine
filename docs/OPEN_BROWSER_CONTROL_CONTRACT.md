# Open Browser Control Contract

## Purpose

Chief AI and connected Control Rooms may use an approved browser-control surface to inspect and operate web-only systems when no direct native connector exists.

## Fallback order

1. Use a direct provider connector when available.
2. Otherwise use an approved Open Browser, browser-control, computer-use, MCP, or equivalent UI-control connector.
3. Otherwise use a provider-held API bridge already configured for the workflow.
4. Otherwise provide exact manual steps and record the blocked path.

## ChatGPT and Zapier

When ChatGPT has no native Zapier connector, the approved bridge is the existing `@OpenAI Developers` / OpenAI Platform connection used by the preconfigured Founder Signal Engine workflow. The dedicated key reference is `zapier-founder-signal-engine`.

The raw key must never be exposed. It authenticates OpenAI inside Zapier, but it does not itself grant Zapier UI control, publication authority, CRM authority, billing authority, credential authority, or deletion authority.

## Browser-control scope

An approved agent may open and inspect the named workflow, test non-destructive steps, repair mappings, verify connected accounts, and capture evidence when the target and action are explicitly scoped and auditable.

Publication, outreach, CRM writes, billing, credential changes, account ownership changes, and deletion remain separate founder gates.

## Read-only reality inspection profile

`juss/browser-reality@v1` is the canonical Chief AI / Founder Control Room contract for resolving a supplied link and reporting what a live rendered page actually proves. The repo capability name is `browser-reality-inspector`.

Under this profile, use the real browser page rather than search snippets or cached summaries, follow normal redirects, record the final URL, and distinguish `VERIFIED`, `INFERRED`, `UNKNOWN`, and `BLOCKED`. Capture screenshots and decisive rendered text when available. Never infer hidden content or treat a rendered factual claim as externally verified.

The profile is strictly read-only. It does not authorize likes, comments, messages, follows, purchases, saves, shares, settings changes, credential submission, CAPTCHA solving, or another state mutation. An existing authenticated browser session may continue read-only. Authentication, permissions, CAPTCHA/human verification, and provider boundaries are stop conditions and must be reported exactly.

Normal browser-held first-party cookies or session storage may be reused when appropriate, but their contents must never be inspected, extracted, exported, copied, logged, altered, synthesized, or exposed. Chief AI remains governed by [the zero-writer cookie manifest](../.security/cookies.json); this contract adds no cookie writer. A pseudonymous continuity ID is not created by default and is permitted only for an existing reviewed first-party app seam when it is cryptographically random, never device-derived, purpose-limited, resettable, disclosed, consent-aware, first-party, and unavailable for cross-site correlation.

Probabilistic browser/device fingerprinting and fingerprint alteration are prohibited. Do not derive identity from canvas, WebGL, audio, fonts, user-agent entropy, hardware-signal aggregation, or similar signals, and never perform cross-site tracking. Repository/history fingerprints remain deterministic provenance identities as defined by the continuity protocol, not device identities.

When durable evidence binding is needed, use `juss-browser-reality-canonical-json-v1`: lowercase SHA-256 over recursively key-sorted UTF-8 JSON containing the browser-reality contract ID, sanitized authorized input and final URLs, canonical UTC observation time, purpose-limited scope, normalized/deduplicated observations ordered `VERIFIED → INFERRED → UNKNOWN → BLOCKED` then by statement in JavaScript UTF-16 order, and an optional lowercase screenshot SHA-256. Strip URL user information, fragments, default ports, and tracking query parameters; redact sensitive query values; sort remaining query parameters; and exclude cookie values, credentials/tokens, browser/device entropy, user/person identity, and unrelated private data. This is an evidence/content fingerprint only, never a person/device identity, continuity ID, or cross-site correlator.

The required report sections are `REALITY`, `TARGET`, `CONTENT`, `PROOF`, `RED TEAM`, `BLOCKERS`, and `NEXT GATE`. When outside research is warranted, keep the platform's rendered claim separate from `EXTERNAL VERIFICATION`.

Disable this profile by stopping its invocation and capability routing. Roll back through an authorized git revert of the exact change or a focused forward-fix; do not prescribe deleting skill, contract, or user files. It creates no cookie, identifier, auth, or session migration to undo.

## Evidence required

Record the target, action, before state, after state, run ID, safe screenshots, rollback step, and blocked conditions. Browser access is not proof of a full pass. The full chain still requires source evidence, workflow-run evidence, model output, downstream provider status, CRM association, and Control Room evidence.
