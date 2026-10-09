import { createHash } from 'node:crypto';

export const PRESENTER_PROVIDER_CONTRACT = 'chief-ai/presenter-request@v1';
const FORMATS = new Set(['9:16', '1:1', '16:9']);

export function preparePresenterRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { kind: 'REJECTED', reason: 'request must be an object' };
  const { provider, script, avatarId, aspectRatio = '9:16', durationSeconds, consentReceipt, estimatedCostUsd, spendingApprovalUsd } = input;
  if (provider !== 'heygen') return { kind: 'REJECTED', reason: 'unsupported provider' };
  if (typeof script !== 'string' || !script.trim() || script.length > 3000) return { kind: 'REJECTED', reason: 'script is required (max 3000 characters)' };
  if (typeof avatarId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(avatarId)) return { kind: 'REJECTED', reason: 'invalid avatar ID' };
  if (!FORMATS.has(aspectRatio)) return { kind: 'REJECTED', reason: 'unsupported aspect ratio' };
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 60) return { kind: 'REJECTED', reason: 'duration must be 1-60 seconds' };
  if (typeof consentReceipt !== 'string' || !consentReceipt.trim()) return { kind: 'REJECTED', reason: 'avatar authorization receipt required' };
  if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd < 0 || !Number.isFinite(spendingApprovalUsd) || spendingApprovalUsd < estimatedCostUsd) return { kind: 'REJECTED', reason: 'cost estimate and sufficient spending approval required' };
  const request = { provider, script: script.trim(), avatarId, aspectRatio, durationSeconds };
  const fingerprint = createHash('sha256').update(JSON.stringify(request)).digest('hex');
  return { kind: 'READY_FOR_PROVIDER', contract: PRESENTER_PROVIDER_CONTRACT, request, fingerprint, publishAuthority: false, providerExecutionAuthority: false, consentReceipt };
}
