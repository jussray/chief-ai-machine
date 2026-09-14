import { describe, expect, it } from 'vitest';
import { assertEnvelopeV31 } from './federated-relay-v31.js';
import { assertRelayFreshnessRuntimeV31 } from './federated-relay-v31-runtime.js';
import { generateRelayAttack6000V31, RELAY_V31_MUTATIONS } from './federated-relay-v31-redteam.js';

const NOW = new Date('2026-09-13T15:01:00.000Z');

function baseEnvelope() {
  return {
    contract: 'juss/federated-agent-relay@v3.1',
    messageId: '11111111-1111-4111-8111-111111111111',
    ordering: {
      chainId: '33333333-3333-4333-8333-333333333333',
      sourceSequence: 0,
      chainPosition: 0,
      logicalOperationId: '44444444-4444-4444-8444-444444444444',
      relation: { type: 'root' },
    },
    source: {
      member: 'founder-control-room',
      repository: 'jussray/founder-control-room',
      branch: 'main',
      headSha: 'a'.repeat(40),
    },
    target: {
      member: 'chief-ai-machine',
      repository: 'jussray/chief-ai-machine',
      branch: 'main',
      headSha: 'b'.repeat(40),
    },
    issuedAt: '2026-09-13T15:00:00.000Z',
    expiresAt: '2026-09-13T15:04:00.000Z',
    nonce: '22222222-2222-4222-8222-222222222222',
    disposition: 'observe',
    subject: 'v3.1 deterministic attack fixture',
    payload: {
      contentType: 'application/json',
      body: '{"note":"hello"}',
      sha256: 'd'.repeat(64),
    },
    contextFingerprint: 'c'.repeat(64),
    predecessorProofCookie: 'Q4R:v3.1:genesis',
    evidence: [{
      locator: { provider: 'github', ref: `jussray/founder-control-room@${'a'.repeat(40)}` },
      state: 'verified',
    }],
    supersedesMessageIds: [],
    signature: {
      algorithm: 'Ed25519',
      keyId: 'founder-control-room:relay-v3.1:attack6000',
      valueBase64Url: 'A'.repeat(86),
    },
  };
}

describe('federated relay v3.1 ATTACK-6000 twin', () => {
  it('pins the shared mutation manifest at 32 adversarial primitives', () => {
    expect(RELAY_V31_MUTATIONS).toHaveLength(32);
  });

  it('rejects exactly 6,000 deterministic malformed and freshness permutations', () => {
    let count = 0;
    for (const attack of generateRelayAttack6000V31(baseEnvelope())) {
      count += 1;
      expect(() => {
        assertEnvelopeV31(attack.envelope);
        assertRelayFreshnessRuntimeV31(attack.envelope, NOW);
      }, attack.name).toThrow();
    }
    expect(count).toBe(6000);
  });
});
