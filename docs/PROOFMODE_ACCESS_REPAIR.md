# Protected ProofMode CI access

Chief's protected preview and production proof must use authenticated machine access. Interactive Cloudflare account-member login remains protected; a bypass policy or removal of Access is not a repair.

## Source repair

`scripts/proofmode-access-client.mjs` supplies Access headers only to Chief's HTTPS production and immutable-preview Worker origins. It rejects partial or malformed credential pairs, unexpected origins/paths, and redirects. Playwright transport errors are replaced with a fixed diagnostic rather than exposing request headers. Credential-bearing proof traces are disabled.

The production proof job now receives the same named Access credentials as the protected-preview job, checks configuration before version promotion, and supplies the credentials to both its release-identity probe and MCP requests. Previously its release probe and Playwright requests lacked Access headers. Missing credentials still block promotion. Local credential-free source proof continues to work.

This is request authentication only. It does not grant merge, deployment, publication, key-creation, or policy-change authority. Existing exact-head, one-shot, preview, and production-environment gates remain intact.

## Provider repair to complete after storage access is available

The founder authorized a Chief-scoped credential and protected CI access repair. Before generating any new service token, verify this connection can securely write the intended GitHub environment secrets. The current connection's GET of `repos/jussray/chief-ai-machine/environments/proofmode-access-admin/secrets/public-key` is denied with HTTP 403 (`Resource not accessible by integration`); no token should be generated and stranded without a secure destination.

Once that access is available:

1. Re-observe existing service-token metadata and reuse a valid Chief token if available. Do not create duplicates on retry.
2. If still absent, create one named `chief-proofmode-ci` service token with a bounded lifetime (suggested 720 hours), keeping its returned secret entirely inside a secure local/helper flow. Never return plaintext through model-visible tool output, shell arguments, logs, artifacts, or public-page JavaScript.
3. Save the credential through GitHub's encrypted environment-secret API as `CLOUDFLARE_ACCESS_CLIENT_ID` and `CLOUDFLARE_ACCESS_CLIENT_SECRET` in the workflow's `proofmode-access-admin` and `Cloudflare Production` environments. This is one Chief-specific credential, not an OpenAI key or a cross-project transfer. Verify name-level storage readback before policy activation; do not overwrite unrelated secrets.
4. Add a token-specific Service Auth (`non_identity`) policy to Chief's existing Access application `61d38cdf-0db8-41d3-91da-72ec61e98a64`, including only that token's provider ID. Preserve policy `27bd800f-7d85-4be6-982b-eebd8aacf28f` for interactive Cloudflare account members. Never add an everyone/bypass/any-token policy.
5. Read back that exact application and token-specific policy. Prove the exact preview release using authenticated requests with redirects disabled, and prove an unauthenticated request remains denied or redirected. Token presence alone is not successful authentication.
6. Revalidate the PR's exact current head and obtain its one-shot production authorization before another canonical production-proof attempt. Prior receipts already consumed by failed attempts must not be replayed.

If secure storage or provider verification fails, stop with the exact blocker. Do not log or ask the founder to paste a secret in chat. No credentials or Access policies were changed by the source repair.

## Proof and recovery

Run typecheck, lint, the focused Access-client and production-authority tests, the existing local ProofMode Playwright suite, and the changed-line Sauce Guard audit. A successful source/local run does not establish the live Access policy or service-token validity.

Rollback is the reviewed source revert. Any later provider policy/token changes need their own observed before/after receipt and scoped recovery; never roll back by making the application public or rotating unrelated credentials.
