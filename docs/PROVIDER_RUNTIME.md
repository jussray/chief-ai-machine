# Operator-only provider runtime

`worker/index.js` routes `/api/chief/provider` to the bounded server-side adapter in `worker/chief-provider.js`. The lane is optional, stateless, and separate from browser-local company intelligence. It does not read workspace assets or promote results into approved intelligence.

Required runtime configuration:

| Name | Handling |
| --- | --- |
| `CHIEF_AI_OPERATOR_KEY` | Existing Chief-specific server-side caller secret. Never send it to public-page JavaScript. |
| `OPENAI_API_KEY` | Existing Chief-specific provider secret; never copy a different project's key. |
| `CHIEF_OPENAI_MODEL` | Explicit approved OpenAI model identifier. No model is silently selected. |

No values belong in source, static assets, screenshots, logs, issues, or PRs. The current static Worker remains deployable without this optional lane; missing operator/provider configuration fails closed. Wrangler preserves provider-held secrets during code deployment. Reuse existing keys; this patch creates and rotates none.

An authenticated GET reports configuration only (`INTEGRATED` or `ABSENT`), never key validity. An authenticated POST accepts exactly `prompt` (1–8000 characters) and `sensitivity` (`public` or `internal`). The trusted operator must classify and minimize context before calling; labels are not a private-data detector. Restricted, teen, family, journal, customer-private, and credential-bearing context must not be submitted. The adapter bounds request/response bytes, disables redirects, uses a 30-second provider timeout, makes one request with `store: false` and at most 1000 output tokens, and exposes neither upstream error bodies nor transport exceptions.

Only completed assistant output with a valid response ID returns a draft and `provider:openai:<response-id>` provenance. Every result retains `authority: none`. No tools, storage, retries, automatic fallback, publication, execution, or approvals are granted. Output still requires human review. This is not a browser login, tenant authorization system, or automated agent runtime.

## Verification and release

Run `npm run typecheck`, `npm run lint`, and `npm test`. The existing Security Gates Playwright workflow also exercises the real Worker with synthetic credentials: public denial, authenticated configuration, restricted-input denial, and security headers. Completed-provider output and upstream failures are tested with a mocked provider; those tests are not live OpenAI proof.

Use the existing reviewed Worker deployment path after exact-candidate approval. Preserve the current `chief-ai` Worker identity, assets, domain bindings, and FCR ownership boundaries. Before calling production provider execution verified, observe the exact `/version` release and retain one authenticated, approved, non-sensitive request with a real OpenAI response ID. Missing keys/model remain a deployment/configuration blocker; successful source checks do not resolve it.

Rollback: revert the provider module and its single route registration through the same reviewed deployment path. Other Chief routes and static assets remain independent. Do not delete or rotate existing secrets as a side effect.
