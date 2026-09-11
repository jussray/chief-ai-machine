import { describe, expect, it } from 'vitest';
import {
  createAuthorityEnvelope,
  validateAuthorityEnvelope,
  capabilityIdentity,
} from './authority-envelope.js';

const proposalHash = 'a'.repeat(64);
const argumentsHash = 'b'.repeat(64);
const stateFingerprint = 'c'.repeat(64);

function approved() {
  return createAuthorityEnvelope({
    intentId: 'intent-1',
    actor: 'founder',
    capabilityId: 'github.issue.create',
    authorityScope: 'repo:jussray/chief-ai-machine',
    proposalHash,
    argumentsHash,
    stateFingerprint,
    consequenceClass: 'consequential',
    toolCallId: 'call-1',
    issuedAt: '2026-09-11T07:00:00.000Z',
    expiresAt: '2026-09-11T07:10:00.000Z',
    approvedBy: 'founder',
    idempotencyKey: 'intent-1:call-1',
  });
}

const context = {
  now: '2026-09-11T07:05:00.000Z',
  capabilityId: 'github.issue.create',
  proposalHash,
  argumentsHash,
  stateFingerprint,
  toolCallId: 'call-1',
};

describe('authority envelope', () => {
  it('normalizes one canonical provider.domain.action capability identity', () => {
    expect(capabilityIdentity(' GitHub.Issue.Create ').id).toBe('github.issue.create');
    expect(() => capabilityIdentity('create_issue')).toThrow(/provider\.domain\.action/);
  });

  it('accepts only a fresh envelope bound to current execution state', () => {
    expect(validateAuthorityEnvelope(approved(), context)).toEqual({ valid: true, errors: [] });
  });

  it('invalidates approval when arguments or state drift', () => {
    const result = validateAuthorityEnvelope(approved(), {
      ...context,
      argumentsHash: 'd'.repeat(64),
      stateFingerprint: 'e'.repeat(64),
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'Tool arguments changed after approval',
      'Execution state changed after approval',
    ]));
  });

  it('rejects expiry and replay onto another tool call', () => {
    const result = validateAuthorityEnvelope(approved(), {
      ...context,
      now: '2026-09-11T07:11:00.000Z',
      toolCallId: 'call-2',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'Authority envelope is expired',
      'Tool call changed after approval',
    ]));
  });
});
