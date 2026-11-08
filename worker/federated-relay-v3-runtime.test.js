import { describe, expect, it } from 'vitest';
import { handleFederatedRelayV3BoundToRuntime } from './federated-relay-v3-runtime.js';

const CHIEF_SHA = 'b'.repeat(40);

function requestWith(body) {
  return new Request('https://chief.example/api/federated-relay/v3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('federated relay v3 runtime provenance guard', () => {
  it('rejects a signed-envelope target branch that disagrees with the deployed branch before durable relay execution', async () => {
    const response = await handleFederatedRelayV3BoundToRuntime(
      requestWith({ target: { branch: 'main' } }),
      {},
      CHIEF_SHA,
      'policy/necessary-fix-default',
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'relay_target_identity_stale',
      executionAuthorized: false,
      authorityTransferred: false,
      approvalCarriedForward: false,
    });
  });

  it('fails closed when deployed branch identity is unavailable', async () => {
    const response = await handleFederatedRelayV3BoundToRuntime(
      requestWith({ target: { branch: 'main' } }),
      {},
      CHIEF_SHA,
      'unknown',
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: 'relay_runtime_branch_unavailable',
      executionAuthorized: false,
    });
  });

  it('bounds the outer request before branch inspection', async () => {
    const response = await handleFederatedRelayV3BoundToRuntime(
      requestWith({ target: { branch: 'main' }, padding: 'x'.repeat(70_000) }),
      {},
      CHIEF_SHA,
      'main',
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: 'relay_envelope_too_large',
      executionAuthorized: false,
    });
  });
});
