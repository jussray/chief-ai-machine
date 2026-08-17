// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { describe, expect, it } from 'vitest';
import * as publicSignal from './public-signal.js';
import {
  createFcrPublishRequest,
  createPublicSignalObservation,
  createPublicSignalPacket,
  computeFcrPublicSignalHash,
  publicSignalHash,
} from './public-signal.js';

const INTENT_HASH = 'a'.repeat(64);
const SOURCE_HASH = 'b'.repeat(64);
const SOURCE_SHA = '1'.repeat(40);

function draft(overrides = {}) {
  return createPublicSignalPacket({
    public: {
      product: 'Chief AI',
      hook: 'Built a sharper proof loop.',
      body: 'Chief can now turn verified progress into a public-safe story without publishing the machinery behind it.',
      cta: 'Follow the build.',
      channels: ['linkedin'],
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

function request(packet = draft(), overrides = {}) {
  return createFcrPublishRequest(packet, {
    destination: 'linkedin',
    sourceRepo: 'jussray/chief-ai-machine',
    sourceCommitSha: SOURCE_SHA,
    proofUrl: '',
    ...overrides,
  });
}

describe('public-safe progress signal', () => {
  it('removes effectful approval and provider-payload minting from Chief', () => {
    const exportedNames = Object.keys(publicSignal);
    expect(exportedNames).not.toContain('createPublishApproval');
    expect(exportedNames).not.toContain('evaluatePublishApproval');
    expect(exportedNames).not.toContain('toPublisherPayload');

    const outbound = request();
    expect(outbound).not.toHaveProperty('founder_approval_id');
    expect(outbound).not.toHaveProperty('publish_allowed');
    expect(outbound).not.toHaveProperty('authorization_receipt_verified');
    expect(outbound.authority_request).toBe('fcr-standing-policy-or-current-you');
  });

  it('keeps raw internal evidence out of the FCR-bound public request', () => {
    const packet = draft();
    const outbound = request(packet);
    const serialized = JSON.stringify(outbound);

    expect(outbound.content_field).toBe('linkedin_draft');
    expect(outbound.channel).toBe('juss_rayy_linkedin');
    expect(outbound.evidence_count).toBe(1);
    expect(outbound.evidence_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(serialized).not.toContain(packet.privateEvidence.refs[0]);
    expect(serialized).not.toContain('privateEvidence');
    expect(serialized).not.toContain('sensitiveLabels');
  });

  it('allows public proof to be absent while private evidence remains mandatory', () => {
    const outbound = request();
    expect(outbound.proof_url).toBe('');
    expect(outbound.evidence_count).toBe(1);
    expect(draft({ evidenceRefs: [] }).status).toBe('blocked');
  });

  it('requires exact Current-You and source-context bindings', () => {
    expect(draft({ currentIntentHash: '' }).blockedReasons).toContain('missing_current_intent_binding');
    expect(draft({ sourceContextHash: '' }).blockedReasons).toContain('missing_source_context_binding');
  });

  it('blocks sensitive source classes before an FCR request can exist', () => {
    const packet = draft({ sensitiveLabels: ['raw_runtime_log', 'proprietary_logic'] });
    expect(packet.status).toBe('blocked');
    expect(packet.blockedReasons).toContain('sensitive_source_requires_redaction');
    expect(() => request(packet)).toThrow('PUBLIC_SIGNAL_BLOCKED');
  });

  it('creates field-order invariant packet hashes', () => {
    const left = { public: { product: 'Chief AI', body: 'Progress' }, authority: { source: 'one', intent: 'two' } };
    const right = { authority: { intent: 'two', source: 'one' }, public: { body: 'Progress', product: 'Chief AI' } };
    expect(publicSignalHash(left)).toBe(publicSignalHash(right));
  });

  it('matches the FCR public-signal context hash contract', () => {
    const outbound = request();
    expect(outbound.evidence_hash).toBe('e589f17ebda6e284d9f85d5b7e2687c9fe7a961fd8c7c532fc5f91384e74bd64');
    expect(outbound.public_signal_hash).toBe('58ecdafa615a55c8131b26c73d2f55b21a4993297a44162b8404f9bcf0d17de4');
    expect(computeFcrPublicSignalHash(outbound)).toBe(outbound.public_signal_hash);
  });

  it.each([
    ['public copy', (packet) => draft({ public: { ...packet.public, body: 'Changed after approval.' } })],
    ['Current-You intent', (packet) => draft({ public: packet.public, currentIntentHash: 'c'.repeat(64) })],
    ['source evidence context', (packet) => draft({ public: packet.public, sourceContextHash: 'd'.repeat(64) })],
    ['policy version', (packet) => draft({ public: packet.public, policyVersion: 'public-progress-v2' })],
    ['private evidence lineage', (packet) => draft({ public: packet.public, evidenceRefs: [...packet.privateEvidence.refs, 'github:extra@abc:check/test'] })],
  ])('changes the FCR context hash when %s changes', (_label, mutate) => {
    const original = draft();
    const changed = mutate(original);
    expect(request(changed).public_signal_hash).not.toBe(request(original).public_signal_hash);
  });

  it('does not bind irrelevant FutureYou advisory text', () => {
    const original = draft({ futureYouAdvice: 'Make it punchier.' });
    const changedAdvice = draft({ futureYouAdvice: 'Maybe keep it calmer.' });
    expect(request(original).public_signal_hash).toBe(request(changedAdvice).public_signal_hash);
  });

  it('binds to an explicit audience destination rather than provider plumbing', () => {
    const packet = draft({ public: { channels: ['facebook_founder'] } });
    const outbound = request(packet, { destination: 'facebook_founder' });
    expect(outbound.channel).toBe('juss_and_co_facebook');
    expect(outbound.content_field).toBe('facebook_founder_draft');
    expect(() => request(packet, { destination: 'linkedin' })).toThrow('PUBLIC_SIGNAL_DESTINATION_NOT_IN_DRAFT');
  });

  it('requires an owned repo and exact source SHA before handing off', () => {
    expect(() => request(draft(), { sourceRepo: 'someone-else/chief-ai-machine' })).toThrow('PUBLIC_SIGNAL_SOURCE_REPO_REQUIRED');
    expect(() => request(draft(), { sourceCommitSha: 'abc123' })).toThrow('PUBLIC_SIGNAL_EXACT_SHA_REQUIRED');
    expect(() => request(draft(), { proofUrl: 'http://example.com' })).toThrow('PUBLIC_SIGNAL_PROOF_URL_INVALID');
  });

  it('emits sanitized analytics without post copy or evidence refs', () => {
    const packet = draft();
    const outbound = request(packet);
    const observation = createPublicSignalObservation('social_signal_handoff_ready', packet, outbound);
    const serialized = JSON.stringify(observation);

    expect(observation.event).toBe('social_signal_handoff_ready');
    expect(observation.evidenceCount).toBe(1);
    expect(observation.publicSignalHash).toBe(outbound.public_signal_hash);
    expect(serialized).not.toContain(packet.public.body);
    expect(serialized).not.toContain(packet.privateEvidence.refs[0]);
  });
});
