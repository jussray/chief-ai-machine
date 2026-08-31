import { expect, test } from 'vitest';
import { ProofModeGitHubError } from '../plugins/proofmode/src/github.js';
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

test('returns a machine-readable bounded provider error code with a fixed sanitized message', async () => {
  const failure = new ProofModeGitHubError(
    'source_forbidden',
    'provider detail that must not become the public message',
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
    message: 'GitHub refused the anonymous public evidence request.',
  });
  expect(JSON.stringify(payload)).not.toContain('provider detail');
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

test('does not trust a generic internal Error that forges a provider code', async () => {
  const forged = Object.assign(
    new Error('secret=/srv/internal/token'),
    { code: 'source_error' },
  );

  const response = await handleProofModeMcp(
    requestForAudit(3),
    {
      loadPublicRepositoryEvidence: async () => {
        throw forged;
      },
      classifyRepositoryEvidence: () => {
        throw new Error('classifier should not run');
      },
    },
  );

  const payload = await response.json();
  expect(payload.result.structuredContent).toEqual({
    errorCode: 'audit_failed',
    message: 'ProofMode audit failed without exposing internal details.',
  });
  expect(JSON.stringify(payload)).not.toContain('secret=/srv/internal/token');
});