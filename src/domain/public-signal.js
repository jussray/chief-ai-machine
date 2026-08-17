// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { sha256Hex } from './capability-plan.js';

export const PUBLIC_SIGNAL_CONTRACT = 'chief-ai/public-signal@v1';
export const PUBLIC_SIGNAL_POLICY_VERSION = 'public-progress-v1';

export const PUBLIC_SIGNAL_CHANNELS = Object.freeze([
  'linkedin',
  'buffer',
  'zapier',
]);

export const PUBLIC_SIGNAL_SENSITIVE_LABELS = Object.freeze([
  'credentials',
  'customer_data',
  'incident_detail',
  'internal_prompt',
  'proprietary_logic',
  'raw_runtime_log',
  'secret',
]);

const CHANNEL_SET = new Set(PUBLIC_SIGNAL_CHANNELS);
const SENSITIVE_SET = new Set(PUBLIC_SIGNAL_SENSITIVE_LABELS);
const HASH = /^[0-9a-f]{64}$/i;

function cleanText(value, maxLength = 3000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanList(values, allowed, maxItems = 20, maxLength = 160) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .map((value) => cleanText(value, maxLength).toLowerCase())
    .filter((value) => value && (!allowed || allowed.has(value))))]
    .sort()
    .slice(0, maxItems);
}

function cleanEvidenceRefs(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .map((value) => cleanText(value, 240))
    .filter(Boolean))]
    .sort()
    .slice(0, 40);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function publicSignalHash(value) {
  return sha256Hex(JSON.stringify(canonicalize(value)));
}

function normalizePublicPayload(input) {
  const source = input?.public ?? input ?? {};
  return {
    product: cleanText(source.product, 160),
    hook: cleanText(source.hook, 500),
    body: cleanText(source.body, 3000),
    cta: cleanText(source.cta, 500),
    channels: cleanList(source.channels, CHANNEL_SET, 3, 30),
  };
}

function normalizeAuthority(input) {
  return {
    currentIntentHash: cleanText(input?.currentIntentHash, 64).toLowerCase(),
    sourceContextHash: cleanText(input?.sourceContextHash, 64).toLowerCase(),
    policyVersion: cleanText(input?.policyVersion, 80) || PUBLIC_SIGNAL_POLICY_VERSION,
  };
}

function normalizePrivateEvidence(input) {
  return {
    refs: cleanEvidenceRefs(input?.evidenceRefs),
    sensitiveLabels: cleanList(input?.sensitiveLabels, SENSITIVE_SET, 20, 40),
  };
}

function validationReasons(publicPayload, authority, privateEvidence, confidence) {
  const reasons = [];
  if (!publicPayload.product) reasons.push('missing_product');
  if (!publicPayload.body) reasons.push('missing_public_body');
  if (publicPayload.channels.length === 0) reasons.push('missing_destination');
  if (!HASH.test(authority.currentIntentHash)) reasons.push('missing_current_intent_binding');
  if (!HASH.test(authority.sourceContextHash)) reasons.push('missing_source_context_binding');
  if (privateEvidence.refs.length === 0) reasons.push('missing_internal_evidence');
  if (confidence === 'low') reasons.push('low_confidence');
  if (privateEvidence.sensitiveLabels.length > 0) reasons.push('sensitive_source_requires_redaction');
  return [...new Set(reasons)].sort();
}

export function createPublicSignalPacket(input = {}) {
  const publicPayload = normalizePublicPayload(input);
  const authority = normalizeAuthority(input);
  const privateEvidence = normalizePrivateEvidence(input);
  const confidence = ['medium', 'high'].includes(input?.confidence) ? input.confidence : 'low';
  const blockedReasons = validationReasons(publicPayload, authority, privateEvidence, confidence);
  const bindingSeed = {
    contract: PUBLIC_SIGNAL_CONTRACT,
    publicPayload,
    authority,
  };

  return {
    contract: PUBLIC_SIGNAL_CONTRACT,
    public: publicPayload,
    privateEvidence,
    authority,
    confidence,
    status: blockedReasons.length === 0 ? 'draft' : 'blocked',
    blockedReasons,
    bindingHash: publicSignalHash(bindingSeed),
  };
}

export function createPublishApproval(packet, input = {}) {
  if (!packet || packet.contract !== PUBLIC_SIGNAL_CONTRACT) {
    throw new Error('PUBLIC_SIGNAL_INVALID_PACKET');
  }
  if (packet.status !== 'draft') {
    throw new Error('PUBLIC_SIGNAL_BLOCKED');
  }

  const actor = cleanText(input.actor, 40).toLowerCase();
  if (actor !== 'current-you') {
    throw new Error('PUBLIC_SIGNAL_CURRENT_YOU_REQUIRED');
  }

  const destination = cleanText(input.destination, 30).toLowerCase();
  if (!packet.public.channels.includes(destination)) {
    throw new Error('PUBLIC_SIGNAL_DESTINATION_NOT_IN_DRAFT');
  }

  const approval = {
    contract: 'chief-ai/public-signal-approval@v1',
    actor: 'current-you',
    destination,
    bindingHash: packet.bindingHash,
    approvedAt: cleanText(input.approvedAt, 40),
  };

  return {
    ...approval,
    approvalHash: publicSignalHash(approval),
  };
}

export function evaluatePublishApproval(packet, approval) {
  if (!packet || packet.contract !== PUBLIC_SIGNAL_CONTRACT) {
    return { allowed: false, reason: 'invalid_packet' };
  }
  if (packet.status !== 'draft') {
    return { allowed: false, reason: 'packet_blocked' };
  }
  if (!approval || approval.actor !== 'current-you') {
    return { allowed: false, reason: 'current_you_required' };
  }
  if (!packet.public.channels.includes(approval.destination)) {
    return { allowed: false, reason: 'destination_drift' };
  }
  if (approval.bindingHash !== packet.bindingHash) {
    return { allowed: false, reason: 'decision_context_drift' };
  }
  return { allowed: true, reason: 'approved_exact_context' };
}

export function toPublisherPayload(packet, approval) {
  const decision = evaluatePublishApproval(packet, approval);
  if (!decision.allowed) throw new Error(`PUBLIC_SIGNAL_NOT_APPROVED:${decision.reason}`);

  return {
    channel: approval.destination,
    product: packet.public.product,
    text: [packet.public.hook, packet.public.body, packet.public.cta].filter(Boolean).join('\n\n'),
    publicSignalHash: packet.bindingHash,
  };
}

export function createPublicSignalObservation(event, packet, approval = null) {
  return {
    event: cleanText(event, 80),
    contract: PUBLIC_SIGNAL_CONTRACT,
    status: packet?.status === 'draft' ? 'draft' : 'blocked',
    confidence: ['medium', 'high'].includes(packet?.confidence) ? packet.confidence : 'low',
    channelCount: Array.isArray(packet?.public?.channels) ? packet.public.channels.length : 0,
    evidenceCount: Array.isArray(packet?.privateEvidence?.refs) ? packet.privateEvidence.refs.length : 0,
    blockedReasons: Array.isArray(packet?.blockedReasons) ? [...packet.blockedReasons] : [],
    bindingHash: HASH.test(packet?.bindingHash || '') ? packet.bindingHash : null,
    approvalHash: HASH.test(approval?.approvalHash || '') ? approval.approvalHash : null,
  };
}
