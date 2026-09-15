import { expect, test } from '@playwright/test';

const baseURL = process.env.PROOFMODE_BASE_URL;

if (!baseURL) throw new Error('PROOFMODE_BASE_URL is required');

test('legacy unsigned relay v1 remains retired and cannot mint authority or continuity receipts', async ({ request }) => {
  const response = await request.post(`${baseURL}/api/federated-relay`, {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    data: {
      contract: 'juss/federated-agent-relay@v1',
      from: 'founder-control-room',
      to: 'chief-ai-machine',
      founderApproval: true,
      mergeApproved: true,
      executionAuthorized: true,
    },
  });

  expect(response.status()).toBe(410);
  const body = await response.json();
  expect(body).toMatchObject({
    error: 'relay_v1_retired',
    replacement: '/api/federated-relay/v3',
    executionAuthorized: false,
    authorityTransferred: false,
    approvalCarriedForward: false,
  });
  expect(body).not.toHaveProperty('receipt');
  expect(body).not.toHaveProperty('replyEnvelope');
});
