// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { createHash } from 'node:crypto';

export const CAPABILITY_IDENTITY_CONTRACT = 'juss-fcr/capability-identity@v1';
export const AUTHORITY_ENVELOPE_CONTRACT = 'juss-fcr/authority-envelope@v1';

const CAPABILITY_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SHA256 = /^[0-9a-f]{64}$/i;
const CONSEQUENCE_CLASSES = new Set(['informational', 'reversible', 'consequential', 'irreversible']);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function capabilityIdentity(id) {
  const normalized = typeof id === 'string' ? id.trim().toLowerCase() : '';
  if (!CAPABILITY_ID.test(normalized) || normalized.split('.').length < 3) {
    throw new Error('capability identity must use provider.domain.action');
  }
  return Object.freeze({ contract: CAPABILITY_IDENTITY_CONTRACT, id: normalized });
}

export function authorityEnvelopeHash(envelope) {
  return sha256(JSON.stringify([
    envelope.contract,
    envelope.intentId?.trim(),
    envelope.actor?.trim(),
    envelope.capability?.contract,
    envelope.capability?.id?.trim().toLowerCase(),
    envelope.authorityScope?.trim(),
    envelope.proposalHash?.trim().toLowerCase(),
    envelope.argumentsHash?.trim().toLowerCase(),
    envelope.stateFingerprint?.trim().toLowerCase(),
    envelope.consequenceClass,
    envelope.toolCallId?.trim(),
    envelope.issuedAt,
    envelope.expiresAt,
    envelope.approvedBy?.trim(),
    envelope.idempotencyKey?.trim(),
  ]));
}

export function createAuthorityEnvelope(input) {
  const envelope = {
    contract: AUTHORITY_ENVELOPE_CONTRACT,
    intentId: input.intentId?.trim() || '',
    actor: input.actor?.trim() || '',
    capability: capabilityIdentity(input.capabilityId),
    authorityScope: input.authorityScope?.trim() || '',
    proposalHash: input.proposalHash?.trim().toLowerCase() || '',
    argumentsHash: input.argumentsHash?.trim().toLowerCase() || '',
    stateFingerprint: input.stateFingerprint?.trim().toLowerCase() || '',
    consequenceClass: input.consequenceClass,
    toolCallId: input.toolCallId?.trim() || '',
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    approvedBy: input.approvedBy?.trim() || '',
    idempotencyKey: input.idempotencyKey?.trim() || '',
  };
  const result = { ...envelope, envelopeHash: authorityEnvelopeHash(envelope) };
  const validation = validateAuthorityEnvelope(result, {
    now: input.issuedAt,
    capabilityId: result.capability.id,
    proposalHash: result.proposalHash,
    argumentsHash: result.argumentsHash,
    stateFingerprint: result.stateFingerprint,
    toolCallId: result.toolCallId,
  });
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return Object.freeze(result);
}

export function validateAuthorityEnvelope(envelope, context) {
  const errors = [];
  if (!envelope || typeof envelope !== 'object') return { valid: false, errors: ['Authority envelope must be an object'] };
  if (envelope.contract !== AUTHORITY_ENVELOPE_CONTRACT) errors.push('Unsupported authority envelope contract');
  try { capabilityIdentity(envelope.capability?.id); } catch { errors.push('Invalid capability identity'); }
  if (envelope.capability?.contract !== CAPABILITY_IDENTITY_CONTRACT) errors.push('Unsupported capability identity contract');
  if (!CONSEQUENCE_CLASSES.has(envelope.consequenceClass)) errors.push('Unsupported consequence class');
  for (const [name, value] of [['proposalHash', envelope.proposalHash], ['argumentsHash', envelope.argumentsHash], ['stateFingerprint', envelope.stateFingerprint], ['envelopeHash', envelope.envelopeHash]]) {
    if (!SHA256.test(value || '')) errors.push(`${name} must be sha256`);
  }
  if (!envelope.intentId || !envelope.actor || !envelope.authorityScope || !envelope.approvedBy || !envelope.idempotencyKey || !envelope.toolCallId) {
    errors.push('Authority envelope identity and scope fields are required');
  }
  const now = Date.parse(context.now);
  const issuedAt = Date.parse(envelope.issuedAt);
  const expiresAt = Date.parse(envelope.expiresAt);
  if (![now, issuedAt, expiresAt].every(Number.isFinite)) errors.push('Authority envelope timestamps must be valid');
  else {
    if (issuedAt > now) errors.push('Authority envelope is not active yet');
    if (expiresAt <= now) errors.push('Authority envelope is expired');
    if (expiresAt <= issuedAt) errors.push('Authority envelope expiry must follow issuance');
  }
  if (envelope.capability?.id !== context.capabilityId?.trim().toLowerCase()) errors.push('Capability identity changed after approval');
  if (envelope.proposalHash?.toLowerCase() !== context.proposalHash?.toLowerCase()) errors.push('Proposal changed after approval');
  if (envelope.argumentsHash?.toLowerCase() !== context.argumentsHash?.toLowerCase()) errors.push('Tool arguments changed after approval');
  if (envelope.stateFingerprint?.toLowerCase() !== context.stateFingerprint?.toLowerCase()) errors.push('Execution state changed after approval');
  if (envelope.toolCallId !== context.toolCallId) errors.push('Tool call changed after approval');
  if (SHA256.test(envelope.envelopeHash || '') && authorityEnvelopeHash(envelope) !== envelope.envelopeHash.toLowerCase()) errors.push('Authority envelope hash does not match content');
  return { valid: errors.length === 0, errors };
}
