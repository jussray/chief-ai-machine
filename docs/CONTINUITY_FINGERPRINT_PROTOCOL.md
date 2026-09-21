# Continuity Fingerprint Protocol

Purpose: make future founder shorthand resolvable without guessing, while preserving repository truth as authority.

## Resolution rule

Use shorthand as a retrieval signal, never as proof.

```text
founder shorthand
→ conversation/history fingerprints
→ candidate project
→ authoritative repository verification
→ action
```

For Chief AI Machine, high-signal fingerprints include: prompt operating system, capability router, prompt library, specialist agents, founder content learning, merge-intent evaluation, private model/backend boundary, Chief AI, and cross-project AI orchestration.

If a fingerprint could belong to PromptOS, FCR, or another project, verify the exact repo, branch, files, PR/issue, and current `main` before acting.

## Genesis fingerprint

When asked when this project started, resolve in this order:
1. GitHub repository `created_at`.
2. Root/first commit reachable from authoritative history.
3. Earliest substantive implementation commit.
4. Historical docs that reference earlier work.
5. Earliest available conversation about the project.
6. Earlier uploaded designs, files, or artifacts.
7. Founder testimony, labeled as founder-reported rather than GitHub proof.

Keep idea genesis, repo genesis, first recorded build, first substantive build, launch milestones, and current state separate.

## Truth states

Always distinguish VERIFIED, INFERRED, REMEMBERED, UNKNOWN, STALE, and BLOCKED.

## Browser and device boundary

In this protocol, a “fingerprint” is a deterministic retrieval, provenance, history, or evidence identity. It is not a probabilistic browser/device identity.

For the `juss/browser-reality@v1` read-only inspection profile, never collect canvas, WebGL, audio, font, user-agent, hardware-signal aggregation, or similar entropy; never alter a browser fingerprint; and never perform cross-site tracking. The browser may reuse normal browser-held first-party session state when appropriate without inspecting, extracting, exporting, copying, logging, altering, or synthesizing its contents. Do not create a pseudonymous continuity ID unless an existing reviewed first-party app seam requires it; any such ID must be cryptographically random, never device-derived, purpose-limited, resettable, disclosed, consent-aware, first-party, and unavailable for cross-site correlation.

The `juss-browser-reality-canonical-json-v1` SHA-256 digest is a separate evidence/content fingerprint. It binds a sanitized browser observation receipt; it must never enter identity continuity, identify a person/device, or correlate activity across sites.

## Supersession and decay

Prior plans, prompts, branches, screenshots, PR descriptions, or deploy claims lose authority when `main`, runtime, provider state, or governing contracts change. Revalidate before reuse.

## Reuse rule

Every correction should leave a reusable fingerprint. Prefer exact prompt IDs, functions, routes, failing tests, PRs, SHAs, provider boundaries, and prior decisions before broad repo scans.

This protocol supplements `AGENTS.md`, `CLAUDE.md`, Founder Intelligence, release truth, privacy/security, and approval gates. It never overrides a stricter rule or grants mutation authority by itself.
