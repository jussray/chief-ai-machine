// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { describe, expect, it } from 'vitest';
import {
  createPublicSignalObservation,
  createPublicSignalPacket,
  createPublishApproval,
  evaluatePublishApproval,
  publicSignalHash,
  toPublisherPayload,
} from './public-signal.js';

const INTENT_HASH = 'a'.repeat(64);
const SOURCE_HASH = 'b'.repeat(64);

function draft(overrides = {}) {
  return createPublicSignalPacket({
    public: {
      product: 'Chief AI',
      hook: 'Built a sharper proof loop.',
      body: 'Chief can now turn verified progress into a public-safe story without publishing the machinery behind it.',
      cta: 'Follow the build.',
      channels: ['linkedin', 'buffer'],
      ...(overrides.public || {}),
    },
    evidenceRefs: ['github:chief-ai-machine@abc123:check/ci'],
    currentIntentHash: INTENT_HASH,
    sourceContextHash: SOURCE_HASH,
    policyVersion: 'public-progress-v1',
    confidence: 'high',
    ...overrides,
  });
}

function approve(packet, overrides = {}) {
  return createPublishApproval(packet, {
    actor: 'current-you',
    destination: 'linkedin',
    approvedAt: '2026-08-17T07:30:00Z',
    ...overrides,
  });
}

describe('public-safe progress signal', () => {
  it('keeps internal evidence out of the publisher payload', () => {
    const packet = draft();
    const approval = approve(packet);
    const published = toPublisherPayload(packet, approval);

    expect(published.channel).toBe('linkedin');
    expect(published.text).toContain('Built a sharper proof loop.');
    expect(JSON.stringify(published)).not.toContain('github:chief-ai-machine');
    expect(JSON.stringify(published)).not.toContain('privateEvidence');
  });

  it('requires internal evidence and exact Current-You/source context bindings', () => {
    expect(draft({ evidenceRefs: [] }).status).toBe('blocked');
    expect(draft({ currentIntentHash: '' }).blockedReasons).toContain('missing_current_intent_binding');
    expect(draft({ sourceContextHash: '' }).blockedReasons).toContain('missing_source_context_binding');
  });

  it('blocks sensitive source classes before publishing authority exists', () => {
    const packet = draft({ sensitiveLabels: ['raw_runtime_log', 'proprietary_logic'] });
    expect(packet.status).toBe('blocked');
    expect(packet.blockedReasons).toContain('sensitive_source_requires_redaction');
    expect(() => approve(packet)).toThrow('PUBLIC_SIGNAL_BLOCKED');
  });

  it('never lets FutureYou approve an effectful publish action', () => {
    const packet = draft();
    expect(() => approve(packet, { actor: 'future-you' })).toThrow('PUBLIC_SIGNAL_CURRENT_YOU_REQUIRED');
  });

  it('creates field-order invariant hashes', () => {
    const left = { public: { product: 'Chief AI', body: 'Progress' }, authority: { source: 'one', intent: 'two' } };
    const right = { authority: { intent: 'two', source: 'one' }, public: { body: 'Progress', product: 'Chief AI' } };
    expect(publicSignalHash(left)).toBe(publicSignalHash(right));
  });

  it.each([
    ['public copy', (packet) => draft({ public: { ...packet.public, body: 'Changed after approval.' } })],
    ['Current-You intent', (packet) => draft({ public: packet.public, currentIntentHash: 'c'.repeat(64) })],
    ['source evidence context', (packet) => draft({ public: packet.public, sourceContextHash: 'd'.repeat(64) })],
    ['policy version', (packet) => draft({ public: packet.public, policyVersion: 'public-progress-v2' })],
  ])('invalidates approval when %s changes', (_label, mutate) => {
    const original = draft();
    const approval = approve(original);
    const changed = mutate(original);
    expect(evaluatePublishApproval(changed, approval)).toEqual({
      allowed: false,
      reason: 'decision_context_drift',
    });
  });

  it('does not bind irrelevant FutureYou advisory text', () => {
    const original = draft({ futureYouAdvice: 'Make it punchier.' });
    const changedAdvice = draft({ futureYouAdvice: 'Maybe keep it calmer.' });
    expect(original.bindingHash).toBe(changedAdvice.bindingHash);
  });

  it('binds approval to an explicit destination', () => {
    const packet = draft();
    const approval = approve(packet);
    expect(evaluatePublishApproval(packet, { ...approval, destination: 'zapier' })).toEqual({
      allowed: false,
      reason: 'destination_drift',
    });
  });

  it('emits sanitized analytics without post copy or evidence refs', () => {
    const packet = draft();
    const approval = approve(packet);
    const observation = createPublicSignalObservation('social_signal_approved', packet, approval);
    const serialized = JSON.stringify(observation);

    expect(observation.event).toBe('social_signal_approved');
    expect(observation.evidenceCount).toBe(1);
    expect(serialized).not.toContain(packet.public.body);
    expect(serialized).not.toContain(packet.privateEvidence.refs[0]);
  });
});
