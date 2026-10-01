export function makeRelayFetch(env, fetchImpl = fetch) {
  const token = typeof env?.GITHUB_TOKEN === 'string' ? env.GITHUB_TOKEN.trim() : '';

  return async function relayFetch(input, init = {}) {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    const url = new URL(rawUrl);

    if (url.hostname !== 'api.github.com') return fetchImpl(input, init);

    if (!token) {
      return new Response(JSON.stringify({ error: 'relay_github_auth_unconfigured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    return fetchImpl(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'chief-federated-relay-v31',
      },
    });
  };
}
