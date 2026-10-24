---
name: browser-reality-inspector
description: Inspect a shared link or named live web page in an approved browser, follow its redirect, and report only what the rendered page proves. Use for read-only link resolution, social/Marketplace content checks, login-wall diagnosis, and evidence-backed live-page reality reports; stop at authentication, permission, CAPTCHA, or provider boundaries.
metadata:
  version: "1.0.0"
  owner: "Juss"
  contract: "juss/browser-reality@v1"
---

# Browser Reality Inspector

Use the canonical [`juss/browser-reality@v1`](../../../config/browser-reality.contract.json) contract. This skill grants read-only inspection authority only.

## Inspect the real page

1. Admit the exact supplied URL through the deterministic public-network guard before opening it. Only public HTTP(S) destinations on ports 80/443 are eligible.
2. Open only an admitted URL in an approved live browser. Do not substitute search-engine snippets, cached summaries, or a guessed canonical URL.
3. Follow normal redirects only while the redirect budget remains valid. Re-run public-network admission for every redirect target before navigation continues and record the final browser URL.
4. Inspect only content the page actually renders. Classify every material observation as `VERIFIED`, `INFERRED`, `UNKNOWN`, or `BLOCKED`; hidden or expected content is never verified.
5. Identify the rendered target type, visible account/Page/profile name, main text in concise summary, visible media, date/time, Marketplace price/location, engagement counts, and external links when present.
6. Capture a safe screenshot when the browser supports it, plus the rendered page state and decisive page text. Redact or omit credentials, session values, private messages, or unrelated personal data.
7. If the page makes factual claims worth checking, research them separately. Label the rendered claim with the platform name, such as `FACEBOOK CLAIM`, and the independent result `EXTERNAL VERIFICATION`. Browser rendering proves what the page says, not that its claim is true.

## Network admission

Use `src/domain/browser-reality-network.js` as the repo-native admission primitive. DNS hostnames must resolve before navigation, every returned address must classify as public, and the same admission must run again for every redirect target. Reject localhost, private/link-local/carrier-grade-NAT/reserved/documentation/metadata destinations, credential-bearing URLs, non-HTTP(S) schemes, unexpected service ports, mixed public/private DNS answers, unresolved hostnames, and redirect chains beyond the contract budget.

Evidence URL sanitization and evidence fingerprints happen after observation and are not network admission. Never treat `sanitizeBrowserRealityUrl()` or a valid evidence digest as permission to navigate.

If public-network identity cannot be established deterministically, classify the target `BLOCKED` and stop. Do not weaken the guard to make a page reachable.

## Stop boundaries

Continue read-only when the existing browser session is already authenticated. Stop and report the exact blocker when access requires authentication, credential submission, a permission grant, CAPTCHA/human verification, another provider boundary, a mutation, or expansion beyond the user-authorized target. Do not solve, bypass, or cross the gate under this profile.

Never like, comment, message, follow, purchase, save, share, change settings, submit credentials, or perform another state-changing action.

## Continuity and privacy

- The browser may reuse its normal existing first-party cookies or session storage when appropriate. Never inspect, extract, export, copy, log, alter, synthesize, or expose their contents. This capability keeps [`.security/cookies.json`](../../../.security/cookies.json) at zero cookie writers.
- Do not create a continuity identifier by default. If an existing reviewed first-party app seam genuinely requires one, it must be cryptographically random, never device-derived, purpose-limited, resettable, disclosed, consent-aware, first-party, and unusable for cross-site correlation.
- Never derive identity from canvas, WebGL, audio, fonts, user-agent entropy, hardware-signal aggregation, or similar signals. Never alter a device/browser fingerprint and never perform cross-site tracking.
- Repository/history “fingerprints” mean deterministic provenance or evidence identities only; they are not device fingerprinting.

## Evidence fingerprint

When a durable receipt is needed, use the repo-native `juss-browser-reality-canonical-json-v1` helper. It computes lowercase SHA-256 over recursively key-sorted UTF-8 JSON containing the `juss/browser-reality@v1` contract ID, sanitized authorized input and final URLs, canonical UTC observation time, purpose-limited scope, normalized/deduplicated rendered observations ordered `VERIFIED → INFERRED → UNKNOWN → BLOCKED` then by statement in JavaScript UTF-16 order, and an optional lowercase screenshot SHA-256.

The helper strips URL user information, fragments, default ports, and tracking query parameters; redacts sensitive query values; sorts remaining query parameters; and fails closed on cookie, credential/token, browser/device-entropy, person/user-ID, or unrelated-private-data fields. This digest binds evidence content only. It is never an identity, continuity ID, person/device fingerprint, or cross-site correlator.

## Disablement and rollback

Stop invoking or routing work to this skill to disable it. Roll back through an authorized git revert of the exact change or a focused forward-fix; do not prescribe deleting skill, contract, or user files. No cookie, identifier, authentication, or session migration is required because this capability writes none of them.

## Return only

```text
REALITY:
What the live browser verified, with truth-state labels.

TARGET:
What the supplied link ultimately resolved to.

CONTENT:
A concise description of what rendered.

PROOF:
Final URL, screenshot/browser evidence, and decisive rendered observations.

RED TEAM:
Suspicious, inconsistent, misleading, externally unverified, or otherwise important claims.

BLOCKERS:
Anything the site or provider prevented the browser from seeing.

NEXT GATE:
The single most useful authorized next action.
```
