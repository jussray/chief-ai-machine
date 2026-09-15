// Legacy relay v1 is intentionally retired.
//
// The unsigned v1 transport cannot establish authenticated sender identity and
// therefore must never mint continuity receipts. Signed durable relay traffic
// belongs on /api/federated-relay/v3, whose envelope signature, source key,
// exact-head identity, durability, and authority-smuggling checks are part of
// the active protocol.

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function handleFederatedRelay(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  return json({
    error: 'relay_v1_retired',
    replacement: '/api/federated-relay/v3',
    executionAuthorized: false,
    authorityTransferred: false,
    approvalCarriedForward: false,
  }, 410);
}
