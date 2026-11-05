import { describe, expect, it } from 'vitest';
import {
  evaluateToolCandidate,
  rankToolCandidates,
} from './tool-source-policy.js';

const NOW = new Date('2026-09-23T04:54:00.000Z');

function activeFreeCandidate(overrides = {}) {
  return {
    id: 'active-free-tool',
    maintenanceState: 'active',
    licenseClass: 'open-source',
    selfHostable: true,
    requiresPaidService: false,
    lastVerifiedAt: '2026-09-20T00:00:00.000Z',
    sourceRef: 'github:example/active-free-tool@abc123',
    ...overrides,
  };
}

describe('free-first tool source policy', () => {
  it('prefers a maintained, freshly verified, open-source self-hosted option', () => {
    const result = evaluateToolCandidate(activeFreeCandidate(), { now: NOW });

    expect(result.decision).toBe('prefer');
    expect(result.evidenceFreshness).toBe('fresh');
    expect(result.reasons).toEqual(['maintained-open-source-self-hosted-free-path']);
  });

  it('blocks an archived repository from becoming a new runtime dependency', () => {
    const result = evaluateToolCandidate({
      id: 'flowise-archived-snapshot',
      maintenanceState: 'archived',
      licenseClass: 'open-source',
      selfHostable: true,
      requiresPaidService: false,
      lastVerifiedAt: '2026-08-13T12:38:19.000Z',
      sourceRef: 'github:FlowiseAI/Flowise@9291856d1ea4a4ceea9f8fef8ce14f4f6c81e8eb',
    }, { now: NOW });

    expect(result.decision).toBe('avoid-new-dependency');
    expect(result.reasons).toContain('maintenance:archived');
  });

  it('permits archived code only as bounded migration or salvage evidence', () => {
    const result = evaluateToolCandidate({
      ...activeFreeCandidate({ id: 'archived-reference', maintenanceState: 'archived' }),
    }, { now: NOW, purpose: 'migration-salvage' });

    expect(result.decision).toBe('salvage-only');
    expect(result.reasons).toContain('bounded-salvage-allowed-without-new-runtime-reliance');
  });

  it('ranks a maintained free option ahead of paid, stale, or archived alternatives', () => {
    const ranked = rankToolCandidates([
      activeFreeCandidate({ id: 'maintained-free' }),
      activeFreeCandidate({
        id: 'paid-provider',
        requiresPaidService: true,
      }),
      activeFreeCandidate({
        id: 'stale-open-source',
        lastVerifiedAt: '2025-01-01T00:00:00.000Z',
      }),
      activeFreeCandidate({
        id: 'archived-open-source',
        maintenanceState: 'archived',
      }),
    ], { now: NOW });

    expect(ranked.map((candidate) => candidate.id)).toEqual([
      'maintained-free',
      'stale-open-source',
      'paid-provider',
      'archived-open-source',
    ]);
    expect(ranked.at(-1)?.decision).toBe('avoid-new-dependency');
  });
});
