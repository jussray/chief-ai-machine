# Chief public front door / protected application

Historical evidence from 2026-10-22: the homepage serves a presentation-only Worker and private application/administration/API paths remain protected by Cloudflare Access.

## Cloudflare configuration

- `chief.foundercontrolroom.org/` routes to the presentation-only Worker `chief-public-front-door`.
- `chief.foundercontrolroom.org/__frontdoor_home*` also routes to `chief-public-front-door` for internal query-root rewriting. The Worker responds on `/` or `/__frontdoor_home` only, for GET/HEAD. Other paths, mutations, and arbitrary hostnames must fail closed.
- Zone `foundercontrolroom.org` has a scoped URL Rewrite Rule in `http_request_transform`, ref `chief_public_root_query_path` and expression `(http.host eq "chief.foundercontrolroom.org" and http.request.uri.path eq "/" and http.request.uri.query ne "")`. It internally rewrites the path to `/__frontdoor_home` while leaving the original query string intact.
- No `/*` public catchall was created for Chief and no private Access app or original `chief-ai` Worker was disabled, changed or deleted.
- The original Chief app and APIs continue to run through the existing `chief-ai` Worker and Cloudflare Access.

## Anonymous live browser proof

- `/`, `/?utm_source=review`, and `/?ref=founder&campaign=2026` display `Chief AI | Founder Intelligence OS` with no login.
- `/api/chief/runtime-proof` and `/admin` still display `Sign in · Cloudflare Access`.
- `app.chief.foundercontrolroom.org/` continues to display Cloudflare login.
- Presentation source was taken from `public-face.html` blob `f3ae0c01f5ae735392390b25e47f63ae2311958f`.

## Review, safety and rollback

Tests: `npx vitest run tests/front-door.test.mjs`. Manual public-Worker deployment, only after review: `npx wrangler deploy --config wrangler.front-door.jsonc`.

Rule source of truth for Cloudflare rewrite: `http_request_transform` zone rule `chief_public_root_query_path`. Changes to the rule must be backed up and versioned at the IaC/provider level; the Wrangler file only covers Workers routes. Browser checks establish anonymous edge access and do not prove fully authenticated owner or cross-tenant authorization.

Rollback the newly created rewrite if it malfunctions while preserving the original `/` public route, private Worker Access and app/API routes. Do not create a broad public catchall for Chief.


## November 5, 2026 — welcome and onboarding source candidate

The public document now opens on Welcome. Its primary link opens a script-free onboarding panel at `#onboarding`; the next action links to the existing `./index.html` application asset. Native fragment navigation provides back/forward behavior. No visitor input is collected, browser storage is changed, JavaScript permission is added, public route is widened, or private Worker access policy is changed. The original product definition, COUNSEL and recorded Site links remain available below Welcome. Public document and embedded Worker HTML stay byte-identical.

Scoped provider configuration readback on November 5 returned exact `/` and `/__frontdoor_home*` routes bound to `chief-public-front-door`, and the enabled `chief.foundercontrolroom.org` custom domain bound to `chief-ai` production. Main Worker source forwards `/index.html` to its asset binding. This establishes the intended route owner, not live app rendering. No matching Chief domain appeared in the available account Access-application readback; current protection is UNKNOWN and the older October browser proof is historical. Do not claim current Cloudflare Access, authenticated delivery, or a working live workspace from source inspection.

The entry change is an unmerged source candidate carried on existing PR #232 after preserving current main and the original front-door additions. New exact-head checks remain required; earlier branch proof is historical. Browser proof is required for desktop/mobile Welcome → Onboarding → existing workspace and retained capabilities. The local Playwright browser executable is unavailable. No deployment, secret, provider, domain or Access mutation was performed. Rollback only this entry document/embedded HTML and its corresponding tests; preserve all current-main and original feature history.


## November 23, 2026 — dual-domain Chief surface contract

The product identity and hostname roles are distinct:

- `chief.jussco.company` is the standalone Chief public front door. Its root is served by the presentation-only `chief-public-front-door` Worker; application and API paths are served by the shared `chief-ai` Worker under Worker-level Cloudflare Access.
- `chief.foundercontrolroom.org` is the FCR-branded Chief integration. Its root is served by the same presentation-only front-door Worker with FCR-specific branding; application and API paths reach the same `chief-ai` Worker under the same Worker-level Access boundary.
- Both hostnames use one Chief runtime and must return the same exact `/version` SHA. Neither hostname transfers identity, governance, execution authority, or receipts to the other system.
- No `app.chief.*` or `api.chief.*` subdomains are part of this design.
- Public routes are exact root-only routes. Do not add a public catchall. `/app`, `/api/*`, and `/mcp` remain behind the Chief Worker Access boundary.

The November 23 provider readback found that `chief.jussco.company` was still a proxied CNAME to `chief.foundercontrolroom.org`, and a Juss&Co redirect rule sent both the apex and `www` host to the FCR hostname. That made the standalone hostname an alias rather than an independent front door. The repair must remove only the apex alias/redirect behavior, bind the standalone hostname to the existing `chief-ai` Worker, and route its exact root to `chief-public-front-door`. Keep `www.chief.jussco.company` as a redirect to the standalone apex. Preserve the FCR custom domain, its root-only front-door routes, and the Worker-level Access application.

Source verification is not provider verification. The live domain migration is complete only after Cloudflare readback confirms both Worker domains and root routes, the old apex CNAME/redirect are gone, anonymous root requests show their distinct brands, and authenticated `/app` plus `/version` checks prove the same exact Worker SHA on both hosts.
