import { describe, expect, it } from 'vitest';
import {
  createContinuityFingerprint,
  evaluateContinuityCookie,
  mintContinuityCookie,
} from './continuity-fingerprint.mjs';

const NOW = '2026-08-31T16:30:00.000Z';
const MINTED_AT = '2026-08-31T16:20:00.000Z';
const EXPIRES_AT = '2026-08-31T16:40:00.000Z';

function observation(overrides = {}) {
  return {
    project: 'founder-control-room',
    repository: 'jussray/founder-control-room',
    targetBranch: 'main',
    targetSha: 'a'.repeat(40),
    prNumber: 733,
    baseSha: 'b'.repeat(40),
    headSha: 'c'.repeat(40),
    scopeFingerprint: '1'.repeat(64),
    proofFingerprint: '2'.repeat(64),
    reviewFingerprint: '3'.repeat(64),
    providerFingerprint: '4'.repeat(64),
    runtimeFingerprint: '5'.repeat(64),
    authorityFingerprint: '6'.repeat(64),
    observedAt: MINTED_AT,
    ...overrides,
  };
}

function cookie(overrides = {}) {
  return mintContinuityCookie({
    fingerprint: createContinuityFingerprint(observation()),
    mintedAt: MINTED_AT,
    expiresAt: EXPIRES_AT,
    issuer: 'chief-proofmode',
    issuerIdentityState: 'verified',
    ...overrides,
  });
}

describe('Chief continuity fingerprint + cookie mirror', () => {
  it('matches the FCR canonical SHA-256 test vector', () => {
    expect(createContinuityFingerprint(observation()).digest).toBe(
      '78f478e422bd731b0dbf45b1acd47c555bb4315ba7d6b618bf6219ee28afc02e',
    );
  });

  it('accepts an unchanged, fresh cookie without granting authority', () => {
    expect(evaluateContinuityCookie(cookie(), createContinuityFingerprint(observation()), NOW)).toMatchObject({
      state: 'current',
      reasons: [],
      reacquireRequired: false,
      continuityMayAuthorizeAction: false,
    });
  });

  it('revokes inherited green when target/base/head/scope/proof/review/provider/runtime/authority changes', () => {
    const variants = [
      [{ targetSha: 'd'.repeat(40) }, 'target_sha_moved'],
      [{ baseSha: 'd'.repeat(40) }, 'base_sha_moved'],
      [{ headSha: 'e'.repeat(40) }, 'head_sha_moved'],
      [{ scopeFingerprint: '7'.repeat(64) }, 'scope_moved'],
      [{ proofFingerprint: '8'.repeat(64) }, 'proof_moved'],
      [{ reviewFingerprint: '9'.repeat(64) }, 'review_moved'],
      [{ providerFingerprint: 'a'.repeat(64) }, 'provider_moved'],
      [{ runtimeFingerprint: 'b'.repeat(64) }, 'runtime_moved'],
      [{ authorityFingerprint: 'c'.repeat(64) }, 'authority_moved'],
    ];

    for (const [change, reason] of variants) {
      const result = evaluateContinuityCookie(cookie(), createContinuityFingerprint(observation(change)), NOW);
      expect(result.state, reason).toBe('stale');
      expect(result.reasons, reason).toContain(reason);
      expect(result.reacquireRequired, reason).toBe(true);
      expect(result.continuityMayAuthorizeAction, reason).toBe(false);
    }
  });

  it('treats unknown provider/runtime evidence becoming observed as a stale-cookie event', () => {
    const prior = createContinuityFingerprint(observation({ providerFingerprint: null, runtimeFingerprint: null }));
    const continuityCookie = mintContinuityCookie({
      fingerprint: prior,
      mintedAt: MINTED_AT,
      expiresAt: EXPIRES_AT,
      issuer: 'chief-proofmode',
      issuerIdentityState: 'verified',
    });
    const result = evaluateContinuityCookie(continuityCookie, createContinuityFingerprint(observation()), NOW);
    expect(result.reasons).toEqual(expect.arrayContaining(['provider_moved', 'runtime_moved']));
    expect(result.state).toBe('stale');
  });

  it('expires old cookies and fails closed on unverified issuers', () => {
    const expired = evaluateContinuityCookie(
      cookie(),
      createContinuityFingerprint(observation()),
      '2026-08-31T16:40:00.001Z',
    );
    expect(expired.state).toBe('stale');
    expect(expired.reasons).toContain('cookie_expired');

    const unverified = evaluateContinuityCookie(
      cookie({ issuerIdentityState: 'unverified' }),
      createContinuityFingerprint(observation()),
      NOW,
    );
    expect(unverified.state).toBe('invalid');
    expect(unverified.reasons).toContain('cookie_issuer_unverified');
  });

  it('detects tampering and cannot be converted into an authority grant', () => {
    const original = cookie();
    const tampered = {
      ...original,
      fingerprint: {
        ...original.fingerprint,
        observation: { ...original.fingerprint.observation, headSha: 'd'.repeat(40) },
      },
    };
    const tamperedResult = evaluateContinuityCookie(tampered, createContinuityFingerprint(observation()), NOW);
    expect(tamperedResult.state).toBe('invalid');
    expect(tamperedResult.reasons).toEqual(expect.arrayContaining([
      'fingerprint_integrity_mismatch',
      'cookie_integrity_mismatch',
    ]));

    const forgedAuthority = { ...original, authority: true };
    const authorityResult = evaluateContinuityCookie(
      forgedAuthority,
      createContinuityFingerprint(observation()),
      NOW,
    );
    expect(authorityResult.state).toBe('invalid');
    expect(authorityResult.reasons).toContain('cookie_authority_invalid');
    expect(authorityResult.continuityMayAuthorizeAction).toBe(false);
  });
});
