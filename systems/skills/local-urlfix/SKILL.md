

# /urlfix — Live Product Repair

## 0. Status — read first

- v0.1.0. Adopted 2026-10-01 at the founder's word ("Install"); installed to ~/workspace/custom-skills/local-urlfix/. Challenger-reviewed 2026-09-30; corrections applied: (1) registry is bootstrapped in-draft, not a phantom dependency; (2) the governing axiom has a machine-checkable receipt gate; (3) one state vocabulary end to end; (4) picture Q&A annexed; (5) `/urlfix` naming, v0.1.0; (6) severity table gated on explicit approval; (7) artifacts default outside the repo with a gitignore snippet for the opt-in path.
- If the Juss Operating System v10 receipt fields are ever adopted, they supersede §15.

## 1. Governing axiom

**/urlfix may declare a defect repaired only when the exact failed browser witness has been rerun against the appropriate repaired runtime and now produces the expected observable result.**

This is the same law as the standing "URL ≠ runtime identity" boundary: a stable URL never carries proof forward by itself. Source-level green, local green, and "page now loads" are never proof of a repaired user journey. Enforcement is mechanical — see §11. Anything that cannot pass §11 is PATCHED or BLOCKED, never FIXED.

## 2. Modes

### Owned mode
Only when a registry entry exists AND is human-confirmed for the exact URL (see §3–§4). Workflow: TEST → DIAGNOSE → DELEGATE TO GOALFIX → VERIFY → LIVE RECHECK.

### Observation-only mode
Everything else: ownership missing, ambiguous, external, or contested. Workflow: TEST → DIAGNOSE → REPORT. Never clone, modify, commit, deploy, or open/update a PR for an unowned URL. Never attempt auth bypasses. Never submit forms with consequential external effects.

## 3. Registry bootstrap

There is no canonical FCR portfolio registry yet, so /urlfix bootstraps its own entry per URL. The entry is data, not authority — it becomes usable only after human confirmation.

```yaml
registry_entry:
  url: https://example.com
  project_id: string
  repo: owner/repo
  default_branch: main
  main_sha: commit-sha
  deployment: { provider: vercel|cloudflare|..., project: name, deployment_id: id-or-unknown }
  runtime_identity: deployment-id-or-unknown
  authorized_carrier: existing-branch-or-pr-or-none
  critical_flows: [ {name, route, actions[]} ]
  confirmed_by: human
  confirmed_at: ISO-8601
```

First run for a new URL: resolve what can be resolved, write the entry, classify OWNED_AMBIGUOUS, stop. No diagnosis beyond the baseline sweep until confirmation exists. /urlfix never invents registry facts and never infers source ownership from a domain name.

## 4. Resolution protocol

1. Normalize the input URL: record original, final, redirect chain, host, pathname, query, fragment.
2. Look up or bootstrap the registry entry (§3).
3. Classify: `OWNED_CONFIRMED` | `OWNED_AMBIGUOUS` | `EXTERNAL` | `UNKNOWN` | `BLOCKED`.
4. Anything other than OWNED_CONFIRMED → observation-only mode.

## 5. Baseline browser sweep

Run against the original URL. Preserve all artifacts. Minimum viewports: desktop `1440x900`, mobile `390x844`. Inspect: reachability, TLS failures, redirects, console errors, failed network requests (4xx/5xx), broken assets, overflow/clipping, blocked controls, form behavior, loading/error/empty states, accessibility basics (labels, focus, contrast), user-visible JS crashes. Capture: final URL, viewport, console/network logs, screenshots, Playwright traces, action transcript, timestamp, runtime identity (or `unknown`).

## 6. Core-flow selection

In order: (1) registry entry's `critical_flows`; (2) existing Playwright tests; (3) route metadata / documented journeys; (4) minimal public journey inferred from visible primary CTAs. Record the provenance of the chosen flow. Never improvise into consequential flows (billing, deletion, messaging) — those need explicit authorization or stay untested.

## 7. Issue ledger — one state vocabulary

```yaml
id: URLFIX-001
status: OBSERVED | REPRODUCED | MAPPED | PATCHED | FIXED | BLOCKED | NOT_REPRODUCED | DUPLICATE | P3_LOGGED
severity: P0 | P1 | P2 | P3
title: Short observable failure statement
mode: OWNED | OBSERVATION_ONLY
discovered_at: ISO-8601 timestamp
issue: >
  What visibly or behaviorally fails.
reproduction:
  preconditions: [state, identity class, feature flag, test fixture]
  steps: [exact ordered browser actions]
  witness: [expected assertion, actual result]
url:
  original: https://example.com/path
  final: https://example.com/path
  route: /path
environment:
  target: production | preview | local
  viewport: "390x844"
  browser: chromium
  runtime_identity: deployment-id-or-unknown
  source_sha: commit-sha-or-unknown
observed: >
  Exact visible, browser, or network behavior.
expected: >
  Expected behavior based on product flow, control label, API contract, established tests, or explicit specification.
evidence:
  console: [message, stack, severity, timestamp]
  network: [method, URL, status, request correlation if available]
  screenshot: artifact path or receipt ID
  trace: artifact path or receipt ID
  accessibility: relevant locator, role, label, or audit output
mapping:
  likely_source: [route, component, service, API endpoint, config, provider]
  relevant_recent_diff: [commit / PR / deployment relationship]
  confidence: 0.00
triage:
  materiality_rationale: >
    Why this is P0/P1/P2/P3.
  safe_to_autofix: true | false
  blocker: null | external-provider | missing-authority | auth | consequential-action | unknown
repair:
  goalfix_case_id: null
  repair_carrier: existing-branch-or-pr-or-none
  patch_commit: null
  regression_witness: null
verification:
  source_checks: []
  browser_retest: null
  preview_retest: null
  live_retest: null
  before_after_comparison: null
```

Lifecycle: OBSERVED → REPRODUCED → MAPPED → PATCHED → FIXED. FIXED is reachable only through the §11 receipt gate. PATCHED = source/preview witness passes, live recheck not yet done. Terminal non-fix states: BLOCKED, NOT_REPRODUCED, DUPLICATE, P3_LOGGED.

## 8. Severity policy

| Severity | Definition | Default action |
|---|---|---|
| P0 | Site/core runtime unusable; major public outage | Diagnose immediately; repair only through the authorized carrier with explicit approval |
| P1 | A core intended user journey is broken | Diagnose; repair only if owned, bounded, explicitly approved |
| P2 | Material responsive, accessibility, reliability, or UX defect | Repair only if causally understood, bounded, explicitly approved |
| P3 | Cosmetic preference, minor polish | Record only; never mutate source |

Approval gates are never skipped by severity. `safe_to_autofix: true` in triage never means "approved."

## 9. Source mapping protocol (output-only)

1. Confirm the observed failure (REPRODUCED first).
2. Identify the exact route and action boundary.
3. Correlate browser evidence with: router route, component tree, API client call, backend endpoint, config/env flag, logs, recent diffs.
4. Form one falsifiable root-cause hypothesis with a confidence score.
5. Attack the hypothesis before delegating (reproduce locally/in preview; prove the implicated request/config explains the failure).
6. Hand the hypothesis to goalfix. Mapping is output-only — /urlfix takes no incoming mapping requests.
7. If goalfix returns MAPPING_REJECTED with evidence, re-map once; if still rejected, mark the issue BLOCKED (mapping-contested) and report.

## 10. Goalfix handoff

Provide: issue ID, severity, exact reproduction transcript, URLs, viewport, expected/actual witness, screenshots/traces/console/network, authority receipt fields (repo, branch, SHA, runtime), source-mapping hypothesis, known recent diff, external-effect boundary, required same-test-after-fix witness. Expect back: root cause, smallest reversible patch, files changed, source checks, regression test, local/preview proof, candidate deployment identity, residual risk. No fresh PR merely because /urlfix found an issue — reuse the authorized carrier.

## 11. Receipt gate — programmatic enforcement of the axiom

A ledger issue may carry status FIXED only if `receipt.json` satisfies ALL of:

1. `witness_before.id == witness_after.id` — the same witness, not a similar one.
2. Identical tuple: viewport, route, ordered actions, preconditions.
3. `witness_after.runtime_identity` is known and identifies the repaired deployment.
4. `witness_after.result` equals the expected observable result.
5. Evidence artifact IDs exist for both runs (before trace + after trace at minimum).

If any check fails, the legal statuses are PATCHED (source/preview proven) or BLOCKED — never FIXED. This gate is checkable by script, not by reading the rule and nodding.

## 12. Verification ladder + proof levels

1. Source verification (goalfix): typecheck, lint, focused test.
2. Local/preview browser verification: same browser, viewport, route, preconditions, actions; expected network + visible result.
3. Runtime/deployment identity verification: candidate deployment identified; source SHA ↔ runtime relationship established. No production proof without it.
4. Live recheck: rerun the exact witness against the original URL; before/after comparison; no new console or failed-request regressions.

Proof level per issue: `SOURCE_ONLY` | `LOCAL_BROWSER_PROVEN` | `PREVIEW_BROWSER_PROVEN` | `LIVE_BROWSER_PROVEN`. Only LIVE_BROWSER_PROVEN satisfies the axiom.

## 13. Consequential-action boundary

Stop before any real external effect unless separately authorized. Requires explicit authorization: account creation, payments, subscriptions, publication, deletion, role changes, production config changes. Prefer sandbox/test identities/intercepted requests. If blocked, mark `BLOCKED_CONSEQUENTIAL_AUTHORIZATION`.

## 14. Stop conditions

All verified P0/P1 issues FIXED or BLOCKED; selected bounded P2s FIXED or BLOCKED; remainder is P3_LOGGED, NOT_REPRODUCED, DUPLICATE, or speculative; next issue needs external authority, provider repair, credentials, deployment access, or consequential authorization.

## 15. Receipt schemas

Authority receipt (registry entry confirmation):

```yaml
receipt_id, issued_at, issuer: human-founder,
url, project_id, repo, default_branch, main_sha,
deployment: {provider, project, deployment_id},
runtime_identity, authorized_carrier, critical_flows: [...]
```

Run receipt (`receipt.json`): url tested, final URL, ownership mode, repo/branch/SHA, runtime identity, core paths tested, viewports used, before/after summary per repaired issue, ledger grouped by status, proof level per issue, evidence artifact IDs, patch/commit/PR carrier (when applicable), residual risk + untested consequential flows.

## 16. Artifact layout

Default: `~/workspace/urlfix-runs/<UTC-timestamp>_<host>/` — outside any repo. Inside: `resolution.json`, `baseline/`, `ledger.yaml`, `issues/<ID>/` (reproduce spec, before/after traces, screenshots, hypothesis, source-map, comparison), `receipt.json`. Opt-in repo path `.fcr/urlfix/` only with this gitignore shipped alongside:

```
.fcr/urlfix/runs/
*.trace.zip
```

## 17. Annex — the three picture questions

**Q: How does /urlfix handle source mapping requests?**
A: It doesn't take them — mapping is output-only (§9). /urlfix produces one falsifiable hypothesis per issue and hands it to goalfix; disagreement returns as MAPPING_REJECTED with evidence, and contested mappings end BLOCKED, never patched on vibes.

**Q: What constitutes a valid failing browser witness?**
A: All six, or it's a report, not a witness: (1) exact viewport + route + ordered action sequence; (2) preconditions recorded; (3) expected vs actual observable result stated; (4) reproduced ≥2 runs; (5) trace + screenshot + console/network attached; (6) tied to one ledger ID. Only a valid witness can ever clear a defect under the axiom.

**Q: How are deployment receipts structured between /urlfix and FCR?**
A: Two receipts, defined in §15: the authority receipt (who says this URL maps to this repo/SHA/deployment — human-confirmed registry entry) and the run receipt (what was tested, what passed, at which proof level, with which artifacts). Until a canonical FCR registry exists, the authority receipt is bootstrapped per URL and human-confirmed. If OS v10 receipt fields are adopted, they supersede this section.

## 18. Division of labor

| Concern | /urlfix | /goalfix | FCR / registry |
|---|---|---|---|
| Start from a deployed URL | Owns | Consumes context | Supplies authority facts |
| URL ownership | Requests, never invents | — | Registry entry (bootstrapped until canonical) |
| Browser exploration | Owns | May rerun exact witness | — |
| Issue ledger + severity | Owns | Receives one selected defect | Stores receipts |
| Root-cause investigation | Initiates, supplies evidence | Owns causal isolation | Helps map repo/runtime |
| Patch creation | Delegates | Owns (smallest reversible) | Governs carrier/branch policy |
| Regression test | Defines failing browser witness | Adds/updates source test | Records proof |
| Production recheck | Owns | Supports | Confirms deployment identity |
| External URL | Observe/report only | Never mutates | Marks unowned |
## Available connectors

Use `muse.connector_search` to find the current connector docs before following
recovered instructions.
