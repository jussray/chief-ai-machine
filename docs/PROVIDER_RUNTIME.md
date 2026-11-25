# Operator-only provider runtime

`security/chief-edge-entry.js` wraps `worker/index.js`, which routes `/api/chief/provider` through the operator-authenticated membrane in `worker/chief-provider.js` to the shared provider adapter in `worker/provider-runtime.js`. The lane is optional, stateless, and separate from browser-local company intelligence. It does not read workspace assets or promote results into approved intelligence.

Required runtime configuration:

| Name | Handling |
| --- | --- |
| `CHIEF_AI_OPERATOR_KEY` | Existing Chief-specific server-side caller secret. Never send it to public-page JavaScript. |
| `CHIEF_LIVE_PROVIDER` | Server-owned selector: `openai` or `anthropic`. An absent selector preserves legacy OpenAI behavior; an invalid selector fails closed. |
| `OPENAI_API_KEY` | Existing Chief-specific provider secret, required when OpenAI is selected. |
| `CHIEF_OPENAI_MODEL` | Explicit approved OpenAI model identifier when selected. |
| `ANTHROPIC_API_KEY` | Existing Chief-specific provider secret, required when Anthropic is selected. |
| `CHIEF_ANTHROPIC_MODEL` | Explicit approved Anthropic model identifier when selected. |

No values belong in source, static assets, screenshots, logs, issues, or PRs. The current static Worker remains deployable without this optional lane; missing operator/provider configuration fails closed. Wrangler preserves provider-held secrets during code deployment. Reuse existing keys; this patch creates and rotates none.

An authenticated GET reports configuration only (`INTEGRATED` or `ABSENT`), never key validity. An authenticated POST accepts exactly `prompt` (1–8000 characters) and `sensitivity` (`public` or `internal`). The trusted operator must classify and minimize context before calling; labels are not a private-data detector. Restricted, teen, family, journal, customer-private, and credential-bearing context must not be submitted. The adapter bounds request/response bytes, disables redirects, uses a 60-second provider timeout, makes one request with at most 2000 output tokens and sets `store: false` for OpenAI, and exposes neither upstream error bodies nor transport exceptions.

OpenAI Responses API results require `status: completed`, usable assistant text and a valid response ID. Anthropic Messages API results require usable text and a valid response ID under the shared adapter contract. Successful results return `provider:<selected-provider>:<response-id>` provenance. OpenAI failed, incomplete, cancelled, queued, in-progress, or missing-status responses fail closed even if they contain partial text. No provider fallback is permitted. Every result retains `authority: none`. No tools, storage, retries, automatic fallback, publication, execution, or approvals are granted. Output still requires human review. This is not a browser login, tenant authorization system, or automated agent runtime.

## Protect Me 2 pilot: public draft authorization only

The **existing** operator-authenticated \`POST /api/chief/provider\` route supports an
opt-in, server-side check against the Juss Protect Me 2 gateway. It grants no
agent-execution authority. Normal Chief provider behavior is unchanged unless
\`CHIEF_PROTECT2_PILOT_MODE=enforce-public-draft\` is explicitly configured.

The pilot requires all of the existing Chief provider secrets plus a
separately issued, active **Model Two** \`CHIEF_PROTECT2_API_KEY\` stored as an
encrypted Worker secret. This key is provisioned only through the authorized
membership/test-identity process, **not by bypassing JussPay entitlement**.
Never copy a customer key, reuse an FCR/provider key, or put any key in source,
\`.dev.vars\` in production, screenshots, logs, or workflow artifacts.

While enabled:

- Only \`sensitivity: public\` can proceed; internal and restricted input is
  denied before the Protect Me 2 call.
- The server sends exactly \`{"tool":"chief.draft.generate"}\` to
  \`https://protect2.jussco.company/gateway/check\`, with no prompt, personal
  data, or upstream AI provider credentials.
- A fresh \`allow\` verdict is required **before** the selected provider draft call.
  A \`block\`, missing/bad identity, malformed/stale response, unknown pilot
  mode, or outage denies the call without fallback or execution.
- The successful draft includes the gateway check timestamp as evidence;
  \`authority: none\` remains unchanged. A receipt is not founder approval.
- The gateway checks tool entitlement only. **It does not inspect Chief's
  prompt in this pilot.** It cannot be described as full content protection.

**Production gate:** Keep the flag unset until an operator identity,
approved Model Two test membership, verified access policy, exact release SHA,
CI + Playwright proof, and a real gateway allow/deny pair are recorded.
A deployment with the pilot flag unset is not a live connected-agent rollout.
Do not activate paid enrollment or transfer customer data as part of this pilot.

**Rollback:** Remove \`CHIEF_PROTECT2_PILOT_MODE\` to restore pre-pilot route
behavior; do not delete or rotate other services' credentials. Disable the
test identity independently if it is compromised. If code rollback is
required, revert only the Chief provider pilot module/test changes and redeploy
through the existing reviewed path.

## Verification and release

Run `npm run typecheck`, `npm run lint`, and `npm test`. The existing Security Gates Playwright workflow also exercises the real Worker with synthetic credentials: public denial, authenticated configuration, restricted-input denial, and security headers. Completed-provider output and upstream failures are tested with a mocked provider; those tests are not live OpenAI proof.

Use the existing reviewed Worker deployment path after exact-candidate approval. Preserve the current `chief-ai` Worker identity, assets, domain bindings, and FCR ownership boundaries. Before calling production provider execution verified, observe the exact `/version` release and retain one authenticated, approved, non-sensitive request with a real selected-provider response ID. Missing keys/model remain a deployment/configuration blocker; successful source checks do not resolve it.

Rollback: revert the provider module and its single route registration through the same reviewed deployment path. Other Chief routes and static assets remain independent. Do not delete or rotate existing secrets as a side effect.
