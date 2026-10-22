# Chief public front door / protected application

Verified on 2026-10-22: the homepage serves a presentation-only Worker and private application/administration/API paths remain protected by Cloudflare Access.

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
