import { describe, expect, it } from 'vitest';
import { sha256Hex } from './capability-plan.js';
import {
  createCapabilityRegistry,
  resolveCapabilities,
  validateCapabilityRegistry,
} from './capability-registry.js';

function registry() {
  return createCapabilityRegistry({
    registryId: 'chief-ai-test-registry',
    version: '2026-08-13.1',
    approvedBy: 'founder',
    capabilities: [{
      id: 'goalfix-v1',
      version: '1.0.0',
      origin: 'repo-native',
      owner: 'jussray/chief-ai-machine',
      sourceHash: sha256Hex('fixture:goalfix-v1:1.0.0'),
      authorityCeiling: 'reversible',
    }],
  });
}

describe('trusted capability registry', () => {
  it('accepts a registry whose content matches its hash', () => {
    expect(validateCapabilityRegistry(registry())).toEqual({ valid: true, errors: [] });
  });

  it('rejects content changed after the registry hash was created', () => {
    const snapshot = registry();
    const changed = {
      ...snapshot,
      capabilities: snapshot.capabilities.map((item) => ({ ...item, version: '2.0.0' })),
    };
    expect(validateCapabilityRegistry(changed).valid).toBe(false);
  });

  it('rejects a requested capability missing from the registry', () => {
    expect(() => resolveCapabilities(registry(), ['missing-capability']))
      .toThrow('Untrusted or unknown capabilities: missing-capability');
  });
});
