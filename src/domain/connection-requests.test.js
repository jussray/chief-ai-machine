import { describe, expect, it } from 'vitest';
import {
  CONNECTION_REQUEST_CONTRACT,
  createConnectionHandoff,
  normalizeConnectionRequests,
} from './connection-requests.js';

describe('Chief FCR connection requests', () => {
  it('normalizes credential-free connection requirements', () => {
    expect(normalizeConnectionRequests([
      {
        connectionType: 'github',
        environment: 'production',
        capabilities: ['inspect_repos', 'inspect_repos', 'read_actions'],
      },
    ])).toEqual([
      {
        connectionType: 'github',
        environment: 'production',
        capabilities: ['inspect_repos', 'read_actions'],
      },
    ]);
  });

  it('rejects credential-bearing or otherwise unknown request fields', () => {
    expect(() => normalizeConnectionRequests([
      {
        connectionType: 'cloudflare',
        environment: 'production',
        capabilities: ['workers_read'],
        token: 'never-accept-this',
      },
    ])).toThrow(/forbidden fields: token/);

    expect(() => normalizeConnectionRequests([
      {
        connectionType: 'github',
        environment: 'production',
        capabilities: ['inspect_repos'],
        secretRef: 'also-not-chief-authority',
      },
    ])).toThrow(/forbidden fields: secretRef/);
  });

  it('creates an opaque FCR handoff instead of a credential bundle', () => {
    const handoff = createConnectionHandoff([
      {
        connectionType: 'github',
        environment: 'production',
        capabilities: ['inspect_repos'],
      },
    ]);

    expect(handoff.contract).toBe(CONNECTION_REQUEST_CONTRACT);
    expect(handoff.selectedBy).toBe('chief-ai-machine');
    expect(handoff.resolvedBy).toBe('founder-control-room');
    expect(handoff.rawCredentialsAccepted).toBe(false);
    expect(handoff.rawCredentialsReturned).toBe(false);
    expect(handoff.resolver).toBe('/mcp/vault/resolve');
  });
});
