# CHIEF first-client activation candidate

CHIEF is the Founder Intelligence OS. PromptOS is an independent instruction-engineering product; FCR governs authorized execution. A CHIEF account role never grants execution authority.

This branch builds on merged visual baseline a5296d8. It retains all existing app, MCP, provider and FCR paths; it does not automatically migrate or delete legacy local storage. The new first-client workspace is a personal account slice, not feature parity, full team collaboration or a complete AI runtime.

## Account routes

/login, /signup, /workspace, /account/request-code, /account/verify, /account/me, /account/start, /account/record, /account/logout. All fail closed unless CHIEF_ACCOUNTS_ENABLED=true and a dedicated verified CHIEF identity project is configured. CHIEF_PUBLIC_SIGNUP_ENABLED stays unset during the founder pilot. Founder role binds to the verified immutable provider UUID (CHIEF_FOUNDER_SUBJECT); never infer from email or metadata. The public signup flag is not a provider-side registration restriction: close signup in the identity provider too.

## Before activation

- Confirm a dedicated CHIEF auth/data project; do not reuse FCR or another product database. No paid resource creation without exact approval.
- Configure provider email OTP, confirmation, delivery, abuse controls, disable anonymous sign-in and public signup for pilot; use supported provider admin/invite process for the real founder account. Never commit passwords, tokens, actual founder ID or email.
- Apply the reviewed additive schema in supabase/chief-first-client-schema.sql; prove owner-only RLS with two verified identities and anonymous requests. No hosted migration has been executed by this branch.
- Configure CHIEF_AUTH_URL, CHIEF_AUTH_PUBLISHABLE_KEY, CHIEF_FOUNDER_SUBJECT server-side. Founder must complete their own verified sign-in. Restrict access until provider-side identity and data policy are proven.
- Verify exact-head CI, live Playwright login/logout, OTP delivery, account isolation and first-client persistence. Existing legacy app routes are deliberately not replaced; review full route inventory, migrate browser-local data with user consent, and enforce account admission for all customer app paths before public signup.
- Verify public crawler access for /, /robots.txt, /sitemap.xml and /llms.txt through existing Cloudflare routing. Do not widen Access bypass or public routes without separate approval. Optional llms.txt is not an indexing guarantee.
- Review the exact candidate and obtain required merge/deployment approval. Revert source commits rather than delete customer data if rollback is needed.

## Proof limitations

Source candidate only. No account created, hosted migration, secret mutation, deployment, search-console submission, indexing proof, provider charge or production authorization. Existing legacy workspace remains subject to its existing access rules, which are not proven by this branch. No claim of complete customer account enforcement or working founder login until live proof. The first-client seed objectives are proposals, not achieved results.
