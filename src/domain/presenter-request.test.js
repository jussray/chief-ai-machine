import { describe, expect, it } from 'vitest';
import { preparePresenterRequest } from './presenter-request.js';

const valid = { provider: 'heygen', script: 'Meet our collection.', avatarId: 'public_avatar_1', aspectRatio: '9:16', durationSeconds: 15, consentReceipt: 'approved-avatar-usage', estimatedCostUsd: 1, spendingApprovalUsd: 1 };
describe('presenter request boundary', () => {
  it('produces stable fingerprints without granting execution or publication', () => {
    const a = preparePresenterRequest(valid);
    expect(a.kind).toBe('READY_FOR_PROVIDER');
    expect(a.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(preparePresenterRequest({ ...valid }).fingerprint).toBe(a.fingerprint);
    expect(a.publishAuthority).toBe(false);
    expect(a.providerExecutionAuthority).toBe(false);
  });
  it('binds approval evidence and cost authority to the fingerprint', () => {
    const baseline = preparePresenterRequest(valid);
    expect(baseline.authority).toEqual({ consentReceipt: valid.consentReceipt, estimatedCostUsd: 1, spendingApprovalUsd: 1 });
    for (const change of [
      { consentReceipt: 'different-consent' },
      { estimatedCostUsd: 0.5 },
      { spendingApprovalUsd: 2 },
    ]) {
      expect(preparePresenterRequest({ ...valid, ...change }).fingerprint).not.toBe(baseline.fingerprint);
    }
  });
  it.each([
    [{ ...valid, consentReceipt: '' }, 'avatar authorization'],
    [{ ...valid, spendingApprovalUsd: 0 }, 'spending approval'],
    [{ ...valid, provider: 'unknown' }, 'unsupported provider'],
    [{ ...valid, durationSeconds: 61 }, 'duration'],
    [{ ...valid, avatarId: '../secret' }, 'avatar ID'],
  ])('rejects invalid authorization and input', (input, reason) => {
    expect(preparePresenterRequest(input)).toMatchObject({ kind: 'REJECTED' });
    expect(preparePresenterRequest(input).reason).toContain(reason);
  });
});
