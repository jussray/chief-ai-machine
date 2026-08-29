# ProofMode Product Contract — v0.1

## Product promise

ProofMode answers a narrow question:

> What does the available evidence actually prove about this software project?

It does not award confidence because a README sounds confident, because a branch merged, or because deployment configuration exists.

## Five evidence layers

### 1. Claimed

Evidence that a project makes an implementation, testing, deployment, release, production, or verification claim.

**Important:** `claimed = supported` means the claim was found. It does not mean the claim is true.

### 2. Implemented

Evidence that non-test implementation source and a recognizable project manifest exist at the audited ref.

Test files are testing evidence, not implementation-source evidence, and do not increase the implementation count.

This is repository evidence only. It does not prove the code builds, runs, is reachable, or is safe.

### 3. Tested

Strong v0.1 support requires both:

- repository test artifacts; and
- a successful explicitly test-oriented GitHub Actions workflow carrying a non-empty head SHA that exactly matches the audited commit.

A workflow file without eligible exact-head successful test evidence is partial evidence. Generic successful lint, build, quality, gate, check, CI, or verification workflow names do not by themselves prove that tests ran.

`pull_request_target` runs are not accepted as exact-head test proof. GitHub executes that event in base-branch context, and its reported head SHA can identify the base commit rather than the pull-request code under review. Treating those runs as exact-head proof can misattribute unrelated PR policy evidence to the audited commit.

### 4. Deployed

Deployment configuration or a successful GitHub deployment-platform record tied to the exact audited commit is **partial** evidence only.

It does not establish runtime health, route correctness, configuration parity, database state, or that users are actually receiving the intended artifact.

### 5. Verified

`Verified` requires an independent live witness of the deployed runtime tied to the expected artifact identity.

ProofMode v0.1 deliberately has no runtime witness tool, so this layer remains `not_proven`.

A repository release-marker file is evidence that verification machinery may exist; it is not a live witness.

## Evidence states

- `supported` — the v0.1 threshold for that layer was met.
- `partial` — relevant evidence exists but does not meet the stronger threshold.
- `not_proven` — the required evidence was not observed.
- `blocked` — the evidence cannot be evaluated under the current boundary.

These are evidence states, not universal quality scores.

## Non-negotiable invariants

1. Read-only by default.
2. No repository mutation in v0.1.
3. No API keys, passwords, MFA codes, or access tokens in tool inputs or outputs.
4. All GitHub repository evidence reads are credential-free in v0.1. A server-held credential must not expand the audit into private data if repository visibility changes during collection.
5. Public visibility must be positively established as `private: false` and `visibility: public` before repository evidence is classified.
6. Private, internal, or ambiguous-visibility repository metadata or contents are outside the v0.1 evidence boundary.
7. Repository claims are not evidence of their own truth.
8. CI success is not deployment proof.
9. Base-context `pull_request_target` success is not exact-head PR test proof.
10. Missing workflow head provenance is not exact-head test proof.
11. Generic green lint/build/quality/CI evidence is not proof that tests ran.
12. Test artifacts are not implementation-source artifacts.
13. Deployment configuration is not runtime proof.
14. A repository-hosted release marker is not a live release marker.
15. Missing evidence stays missing.
16. Model narration may explain evidence; deterministic code owns the layer state.
17. Unexpected internal exceptions must not be exposed verbatim through tool results.

## Served MCP boundary

Chief AI currently mounts ProofMode at `/mcp` through its Cloudflare Worker. The served tool is `audit_repository` and must remain explicitly read-only, non-destructive, idempotent, and open-world because it reads public GitHub over the network.

The runtime must enforce the same input constraints it advertises before any provider access. Caller-supplied credential-like fields, malformed acknowledgement receipt IDs, unsupported properties, and invalid refs must fail before GitHub is contacted.

The current served transport is the legacy 2025 MCP handshake. Supporting the 2026 stateless protocol requires a real transport migration; changing a version string alone is not compatibility proof.

Repository implementation of `/mcp` is not evidence that a live production deployment is serving a particular commit. Exact-head preview and production workflows remain separate witnesses.

## Verification contract

`npm run verify:proofmode` is the named repository contract for the deterministic classifier, provider boundary, proof receipt, served MCP tool surface, error mapping/redaction, and read-only authority metadata.

Changes under `plugins/proofmode/**` or the served ProofMode Worker surface must also trigger the live immutable-preview MCP workflow before they are treated as deployment evidence.

The live witness binds receipt authority to the audited repository plus exact commit SHA. The current shared receipt maps generic audit `ref` into a field named `exactTarget.branch`; because `ref` may be a branch, tag, or SHA, consumers must not infer branch semantics from that field until the canonical federated-proof contract resolves the naming.

## Planned v0.2 runtime witness

A future `verify_runtime` tool may accept an explicit user-approved HTTPS witness URL and expected commit identity. It must be designed with SSRF-resistant outbound networking, redirect restrictions, DNS/IP controls, bounded response sizes, timeouts, and no credential-bearing URLs.

Only that independent runtime observation can move `verified` toward `supported`.
