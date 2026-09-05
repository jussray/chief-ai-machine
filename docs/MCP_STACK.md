# Chief AI Machine MCP stack

Last reviewed: 2026-09-05

Chief AI Machine has its own MCP identity. It is not a duplicate Founder Control Room and it is no longer presented as only its ProofMode subsystem.

The design boundary is:

```text
Chief MCP = intent + reasoning + proposal composition + supporting evidence
FCR MCP   = portfolio reality + authority + evidence + connection/execution brokerage
```

Chief may propose. Chief may inspect. Chief may explain. Chief may never self-authorize.

## Chief remote MCP

The Worker serves `POST /mcp` as the Chief MCP surface.

Server identity:

- name: `chief-ai-machine`
- title: `Chief AI Machine`
- modern protocol: MCP `2026-07-28`
- compatibility protocols: `2025-11-25`, `2025-06-18`, `2025-03-26`

Native tools:

- `compose_capability_plan` uses Chief's real capability-plan engine to turn a founder goal plus submitted registry snapshot into a bounded proposal;
- `audit_repository` uses Chief ProofMode to classify public repository evidence and emit a `juss-proof/v1` receipt;
- `lookup_dependency_docs` retrieves one focused public dependency-documentation answer from Context7 and returns bounded `chief-documentation-evidence/v1`.

All three tools are non-destructive. `compose_capability_plan` is proposal-only and asserts the existing Chief governance boundary before returning:

- `chiefMaySelfAuthorize: false`;
- `surfaceMaySelfAuthorize: false`;
- `executionAuthorized: false`;
- founder approval remains required;
- connection resolution authority remains `founder-control-room`;
- no provider mutation, merge, deploy, publication, or outcome-verification authority is minted by the MCP call.

This preserves Chief's native job: **understand the goal, compose the mission/proposal, identify capabilities and proof requirements, and hand the bounded result to the authority layer.**

## Founder Control Room relationship

Founder Control Room is a separate MCP server and the canonical private authority/evidence broker for ChatGPT, Claude, Chief, and other approved clients.

FCR owns:

- authenticated founder/client identity and project scope;
- current portfolio truth and exact-target evidence;
- permission and approval brokerage;
- connection-vault resolution;
- provider policy and execution gates;
- redacted MCP evidence receipts;
- independent verification and outcome-plane separation.

Chief owns:

- intent interpretation;
- capability-plan composition;
- reasoning/synthesis;
- proposal handoff;
- non-authorizing repository/documentation evidence used to improve a proposal.

The canonical cross-system shape is therefore:

```text
Founder / approved client
        │
        ├──────────────► Chief MCP
        │                 intent → reasoning → bounded proposal
        │                              │
        │                              ▼
        └──────────────► FCR MCP ◄──── handoff
                          reality → authority → evidence
                                   │
                                   ▼
                         governed provider/tool execution
                                   │
                                   ▼
                         independent result verification
```

Neither server may collapse `proposal`, `approval`, `execution`, `receipt`, and `verified outcome` into one state.

## ProofMode evidence subsystem

ProofMode remains a Chief subsystem rather than Chief's server identity.

`audit_repository` reads public GitHub repository evidence and classifies claimed, implemented, tested, deployed, and independently verified layers. It is read-only and emits `juss-proof/v1` receipts.

Repository evidence never becomes live runtime verification merely because the source audit succeeds.

## Context7 documentation subsystem

`lookup_dependency_docs` requires an exact Context7 library ID and one focused public documentation query.

- fixed provider endpoint: `https://mcp.context7.com/mcp`;
- optional `CONTEXT7_API_KEY` remains server-side only;
- caller endpoint overrides are forbidden;
- responses are byte-bounded;
- query and content receive SHA-256 fingerprints;
- documentation evidence cannot grant repository, runtime, provider, review, merge, deploy, publication, or execution authority.

Example:

```json
{
  "name": "lookup_dependency_docs",
  "arguments": {
    "libraryId": "/microsoft/typescript",
    "query": "For TypeScript compiler configuration, what does noEmit do while type checking?"
  }
}
```

## Capability-plan MCP example

```json
{
  "name": "compose_capability_plan",
  "arguments": {
    "proposal": {
      "goalPlan": "<juss-v10 goal-plan object>",
      "registrySnapshot": "<submitted capability registry snapshot>",
      "expectedHeadSha": "<exact 40-character candidate SHA>",
      "requestedAuthority": "reversible",
      "connectionRequests": []
    }
  }
}
```

The returned object is explicitly `juss/chief-mcp-capability-proposal@v1` and carries false authority for founder approval, execution, provider mutation, merge, deploy, publication, and outcome verification. FCR is the next authority.

## Connected servers used by Chief development

| Server | Purpose | Boundary |
| --- | --- | --- |
| `founder-control-room` | Governed portfolio truth, authority, evidence, and connection brokerage | Credential-free source config; live auth remains provider/runtime state |
| `github` | Repository, pull requests, Actions, code scanning, and secret scanning | Selected toolsets; lockdown enabled while public |
| `context7` | Current public dependency documentation | Documentation evidence only |
| `playwright` | Exact-head browser/runtime verification | Pinned package, isolated Chromium profile, synthetic fixtures only |

## Privacy and authority boundary

Do not send private Se'kret Bip, Juss Beautiful Hair, L99, Think Tank, customer, vendor, teen, parent, payment, credential, or unreleased strategy content through Context7 or public repository fixtures.

The Chief MCP accepts no caller credential as an authority argument. Raw tokens, API keys, private keys, secret references, provider approval IDs, or caller-minted founder approval fields must not become a path for increasing authority.

## Verification

Source verification:

```bash
npm run verify:mcp
npm run typecheck
npm run lint
npm test
```

Focused MCP verification additionally exercises `worker/chief-mcp.test.js`.

Live proof runs `e2e/proofmode-mcp.pw.mjs` against the deployed exact head. Despite the historical filename, that Playwright suite now verifies the **Chief MCP identity**, exact `/version` SHA, native `compose_capability_plan` boundary, ProofMode repository evidence, and Context7 documentation evidence.

The protected Cloudflare runtime lane must remain fail closed: PR-authored workflow code is not allowed to receive `proofmode-access-admin` credentials. A founder-authorized exact-SHA `workflow_dispatch` is required for credential-bearing runtime proof after the bounded Access check/repair gate is satisfied.

## Stop rule

Do not grow Chief into a second FCR.

Add a Chief MCP tool only when it belongs to **reasoning, proposal composition, or non-authorizing evidence used by reasoning**. Authority, permissions, portfolio current truth, connection secrets, provider writes, execution receipts, and outcome verification belong to Founder Control Room.