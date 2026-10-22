Chief public landing: deployed on 2026-10-22.

The exact route chief.foundercontrolroom.org/ reaches front-door/worker.mjs, sourced from public-face.html Git blob f3ae0c01f5ae735392390b25e47f63ae2311958f. The existing chief-ai Worker and its Cloudflare Access policy remain unchanged.

Live unauthenticated browser proof: / rendered Chief AI | Founder Intelligence OS. /api/chief/runtime-proof required Cloudflare Access. /?source=test still required Cloudflare Access (OPEN query-string routing gap, do not fix by broad auth bypass).

Tests: npx vitest run tests/front-door.test.mjs (aligned with repository Quality Gate)
Deploy after review: npx wrangler deploy --config wrangler.front-door.jsonc
Rollback: operator changes only new exact root route, keeping the private chief-ai Worker Access policy. Never use /* or the hostname itself to make the protected Worker public.
