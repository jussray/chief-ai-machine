import { expect, test } from 'vitest';
import { handleProofModeMcp } from './proofmode-mcp.js';

function requestForAudit(id = 1) {
  return new Request('https://proofmode.example/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'audit_repository',
        arguments: { owner: 'acme', repo: 'app' },
      },
    }),
  });
}

test('returns a machine-readable bounded provider error code', async () => {
  const failure = Object.assign(
    new Error('GitHub refused the evidence request.'),
    { code: 'source_forbidden' },
  );

  const response = await handleProofModeMcp(
    requestForAudit(),
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

test('redacts unexpected internal exception messages', async () => {
  const response = await handleProofModeMcp(
    requestForAudit(2),
    {
      loadPublicRepositoryEvidence: async () => {
        throw new Error('internal path /srv/proofmode and secret-shaped diagnostic');
      },
      classifyRepositoryEvidence: () => {
        throw new Error('classifier should not run');
      },
    },
  );

  const payload = await response.json();
  expect(payload.result.isError).toBe(true);
  expect(payload.result.structuredContent).toEqual({
    errorCode: 'audit_failed',
    message: 'ProofMode audit failed without exposing internal details.',
  });
  expect(JSON.stringify(payload)).not.toContain('/srv/proofmode');
  expect(JSON.stringify(payload)).not.toContain('secret-shaped');
});
