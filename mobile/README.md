# Chief AI Mobile

This directory is the first native iOS/Android carrier for Chief AI's founder-intelligence layer.

## Product job

Mobile v1 is intentionally offline and provider-neutral. It:

- reuses the canonical `src/domain/intelligence.js` schema;
- creates and validates founder-intelligence assets on-device;
- builds and parses the same portable founder-intelligence snapshot format;
- provides native haptic feedback;
- shares a snapshot only after an explicit user action.

It does not bundle Chief's proprietary prompt catalog, call a model provider, expose provider credentials, create a second Chief backend, or inherit Founder Control Room execution authority.

## Approval boundary

`AGENTS.md` requires explicit founder approval for an app identifier and signing changes. Accordingly, this carrier intentionally has **no** `ios.bundleIdentifier` and **no** Android `package` yet.

That means:

- source implementation may proceed;
- JavaScript platform export may be proven;
- final store identity, signing, signed native builds, and store submission remain blocked until their exact approval gate is satisfied.

Do not quietly add a guessed bundle/package identifier to make the app look further along than it is.

## Privacy boundary

Chief's existing repository contains proprietary prompt content and provider/tooling configuration. Mobile v1 imports only the framework-free founder-intelligence domain schema. Founder-authored content entered on the mobile screen stays in the current app session until the user explicitly invokes the native share sheet.

No model key, service-role key, MCP credential, admin token, or private prompt catalog belongs in the mobile bundle.

## Truth states

- `SOURCE IMPLEMENTED`: native carrier, canonical schema reuse, privacy/authority tests, and mobile workflow exist.
- `CI VERIFIED`: exact-head contract tests and Android/iOS Expo exports pass.
- `STORE ID APPROVED`: founder has explicitly approved the exact iOS/Android identifiers.
- `NATIVE BUILD VERIFIED`: requires signed/reviewable native build evidence after store identity/signing approval.
- `DEVICE VERIFIED`: requires installed runtime proof on target devices.
- `STORE SUBMITTED` / `STORE APPROVED`: require provider receipts.

A JavaScript export is not a signed `.aab`, `.ipa`, App Store Connect upload, Play Console upload, or store approval.

## Rollback

The carrier is isolated under `mobile/` plus its dedicated mobile workflow. Reverting this lane leaves Chief's current web product, domain logic, provider setup, FCR handoff contract, and deployment authority unchanged.
