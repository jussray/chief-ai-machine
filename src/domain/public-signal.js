// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { sha256Hex } from './capability-plan.js';

export const PUBLIC_SIGNAL_CONTRACT = 'chief-ai/public-signal@v2';
export const FCR_PUBLIC_SIGNAL_REQUEST_CONTRACT = 'chief-ai/fcr-public-signal-request@v1';
export const FCR_PUBLIC_SIGNAL_CONTEXT_VERSION = 'fcr/public-signal-context@v1';
export const PUBLIC_SIGNAL_POLICY_VERSION = 'public-progress-v1';

export const PUBLIC_SIGNAL_CHANNELS = Object.freeze([
  'linkedin',
  'facebook_founder',
  'facebook_brand',
]);

export const PUBLIC_SIGNAL_CHANNEL_CONFIG = Object.freeze({
  linkedin: Object.freeze({ fcrChannel: 'juss_rayy_linkedin', contentField: 'linkedin_draft' }),
  facebook_founder: Object.freeze({ fcrChannel: 'juss_and_co_facebook', contentField: 'facebook_founder_draft' }),
  facebook_brand: Object.freeze({ fcrChannel: 'juss_beautiful_hair_facebook', contentField: 'facebook_brand_draft' }),
});

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
const EXACT_COMMIT_SHA = /^[0-9a-f]{40}$/i;
const OWNED_REPO = /^jussray\/[A-Za-z0-9._-]+$/;
const HTTPS_URL = /^https:\/\//i;

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
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
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
    channels: cleanList(source.channels, CHANNEL_SET, 3, 40),
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
  const refs = cleanEvidenceRefs(input?.evidenceRefs);
  return {
    refs,
    evidenceHash: refs.length > 0 ? sha256Hex(JSON.stringify(refs)) : null,
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
  if (privateEvidence.refs.length === 0 || !HASH.test(privateEvidence.evidenceHash || '')) reasons.push('missing_internal_evidence');
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
  return {
    contract: PUBLIC_SIGNAL_CONTRACT,
    public: publicPayload,
    privateEvidence,
    authority,
    confidence,
    status: blockedReasons.length === 0 ? 'draft' : 'blocked',
    blockedReasons,
    bindingHash: publicSignalHash({ contract: PUBLIC_SIGNAL_CONTRACT, publicPayload, authority, evidenceHash: privateEvidence.evidenceHash }),
  };
}

function publicPostText(packet) {
  return [packet.public.hook, packet.public.body, packet.public.cta].filter(Boolean).join('\n\n');
}

export function computeFcrPublicSignalHash(input = {}) {
  const context = {
    version: FCR_PUBLIC_SIGNAL_CONTEXT_VERSION,
    post_text: cleanText(input.post_text, 4000),
    channel: cleanText(input.channel, 80),
    source_commit_sha: cleanText(input.source_commit_sha, 40).toLowerCase(),
    proof_url: cleanText(input.proof_url, 1000) || null,
    current_intent_hash: cleanText(input.current_intent_hash, 64).toLowerCase(),
    source_context_hash: cleanText(input.source_context_hash, 64).toLowerCase(),
    evidence_hash: cleanText(input.evidence_hash, 64).toLowerCase(),
    evidence_count: Number.isInteger(input.evidence_count) ? input.evidence_count : Number.parseInt(String(input.evidence_count ?? ''), 10),
    policy_version: cleanText(input.policy_version, 80),
  };
  return sha256Hex(JSON.stringify(context));
}

export function createFcrPublishRequest(packet, input = {}) {
  if (!packet || packet.contract !== PUBLIC_SIGNAL_CONTRACT) throw new Error('PUBLIC_SIGNAL_INVALID_PACKET');
  if (packet.status !== 'draft') throw new Error('PUBLIC_SIGNAL_BLOCKED');

  const destination = cleanText(input.destination, 40).toLowerCase();
  if (!packet.public.channels.includes(destination)) throw new Error('PUBLIC_SIGNAL_DESTINATION_NOT_IN_DRAFT');
  const channelConfig = PUBLIC_SIGNAL_CHANNEL_CONFIG[destination];
  if (!channelConfig) throw new Error('PUBLIC_SIGNAL_DESTINATION_UNSUPPORTED');

  const sourceRepo = cleanText(input.sourceRepo, 180);
  const sourceCommitSha = cleanText(input.sourceCommitSha, 40).toLowerCase();
  const proofUrl = cleanText(input.proofUrl, 1000);
  if (!OWNED_REPO.test(sourceRepo)) throw new Error('PUBLIC_SIGNAL_SOURCE_REPO_REQUIRED');
  if (!EXACT_COMMIT_SHA.test(sourceCommitSha)) throw new Error('PUBLIC_SIGNAL_EXACT_SHA_REQUIRED');
  if (proofUrl && !HTTPS_URL.test(proofUrl)) throw new Error('PUBLIC_SIGNAL_PROOF_URL_INVALID');

  const postText = publicPostText(packet);
  const context = {
    post_text: postText,
    channel: channelConfig.fcrChannel,
    source_commit_sha: sourceCommitSha,
    proof_url: proofUrl,
    current_intent_hash: packet.authority.currentIntentHash,
    source_context_hash: packet.authority.sourceContextHash,
    evidence_hash: packet.privateEvidence.evidenceHash,
    evidence_count: packet.privateEvidence.refs.length,
    policy_version: packet.authority.policyVersion,
  };

  return {
    contract: FCR_PUBLIC_SIGNAL_REQUEST_CONTRACT,
    product: packet.public.product,
    destination,
    content_field: channelConfig.contentField,
    source_repo: sourceRepo,
    ...context,
    public_signal_hash: computeFcrPublicSignalHash(context),
    authority_request: 'fcr-standing-policy-or-current-you',
  };
}

export function createPublicSignalObservation(event, packet, request = null) {
  return {
    event: cleanText(event, 80),
    contract: PUBLIC_SIGNAL_CONTRACT,
    status: packet?.status === 'draft' ? 'draft' : 'blocked',
    confidence: ['medium', 'high'].includes(packet?.confidence) ? packet.confidence : 'low',
    channelCount: Array.isArray(packet?.public?.channels) ? packet.public.channels.length : 0,
    evidenceCount: Array.isArray(packet?.privateEvidence?.refs) ? packet.privateEvidence.refs.length : 0,
    blockedReasons: Array.isArray(packet?.blockedReasons) ? [...packet.blockedReasons] : [],
    bindingHash: HASH.test(packet?.bindingHash || '') ? packet.bindingHash : null,
    publicSignalHash: HASH.test(request?.public_signal_hash || '') ? request.public_signal_hash : null,
  };
}
