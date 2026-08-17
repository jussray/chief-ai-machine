import { expect, test } from 'vitest';
import { handleProofModeMcp } from './proofmode-mcp.js';

test('returns a machine-readable evidence error code', async () => {
  const failure = Object.assign(
    new Error('GitHub refused the evidence request.'),
    { code: 'source_forbidden' },
  );

  const response = await handleProofModeMcp(
    new Request('https://proofmode.example/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'audit_repository',
          arguments: { owner: 'acme', repo: 'app' },
        },
      }),
    }),
    {
      loadPublicRepositoryEvidence: async () => {
        throw failure;
      },
      classifyRepositoryEvidence: () => {
        throw new Error('classifier should not run');
      },
    },
  );

  const payload = await response.json();
  expect(payload.result.isError).toBe(true);
  expect(payload.result.structuredContent).toEqual({
    errorCode: 'source_forbidden',
    message: 'GitHub refused the evidence request.',
  });
});
