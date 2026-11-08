// Chief AI Worker entry point.
//
// Serves the static SPA (index.html, styles/, src/) via the ASSETS binding.
// /api/* is routed here first (see wrangler.jsonc run_worker_first) so
// authenticated API routes and private prompt storage have somewhere to
// live without a routing/config change. No API routes exist yet — this
// intentionally returns 501 instead of silently 404ing through to assets,
// so it's obvious the route is reserved, not missing.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not implemented', { status: 501 });
    }

    return env.ASSETS.fetch(request);
  },
};
