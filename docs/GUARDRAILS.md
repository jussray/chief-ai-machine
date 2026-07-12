# Chief AI Guardrails

These guardrails are requirements, not decorative prose. Their public-safe runtime status is implemented in `src/config/visionGuardrails.js` and verified with Playwright.

## Guardrail registry

| ID | Requirement | Current enforcement |
|---|---|---|
| `CHIEF-TRUTH-001` | Do not describe unverified prototype behavior as production capability. | Runtime snapshot labels the app `prototype`; Playwright verifies the label. |
| `CHIEF-SECRET-001` | No provider key, service credential, private prompt store, or privileged model call may be placed in browser code. | Client has no privileged API adapter; Playwright scans rendered text and loaded resources for common secret markers. |
| `CHIEF-IMPORT-001` | Imported browser state must be bounded, structurally validated, and restricted to supported fields. | Import validation rejects oversized, malformed, or unexpected payloads before local storage writes. |
| `CHIEF-PROVIDER-001` | Provider identity and product role must remain distinct and replaceable. | Runtime snapshot exposes documented provider roles without keys or private configuration. |
| `CHIEF-APPROVAL-001` | Browser actions may not imply merge, deploy, billing, credential, or external-communication approval. | Current client exposes prompt operations only; Playwright verifies no privileged action controls are rendered. |
| `CHIEF-PROVENANCE-001` | Generated or imported state must remain distinguishable from repository or production truth. | Export format identifies browser-local state; runtime snapshot states the source and scope. |

## Import limits

- Maximum import file size: 1 MiB.
- Maximum custom prompts: 500.
- Maximum stars: 5,000 numeric IDs.
- Text fields are bounded and normalized.
- Unknown top-level fields are ignored rather than persisted.
- Prototype-pollution keys are rejected.

## Verification

Run:

```bash
npm install
npx playwright install chromium
npm run test:guardrails
```

The Playwright suite must verify:

- the app boots and declares its prototype guardrail status;
- import validation rejects unsafe payloads;
- no privileged controls are exposed;
- no obvious secret material is rendered or requested;
- loaded resources remain same-origin except for the explicitly approved Google Fonts stylesheet and font origins.

A green browser test does not prove authentication, private storage, or model execution exists. It proves the prototype does not falsely present or accidentally bypass the guardrails it currently claims.
