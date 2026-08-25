import { describe, expect, it } from 'vitest';
import { createCapabilityPlan } from './capability-plan.js';
import {
  createFounderAuthorityHandoff,
  founderAuthorityHandoffFingerprint,
  validateFounderAuthorityHandoff,
} from './founder-authority-handoff.js';

function plan() {
  return createCapabilityPlan({
    goal: 'Prepare a bounded release plan without granting execution authority.',
    projectSlug: 'founder-control-room',
    expectedHeadSha: 'a'.repeat(40),
    registryHash: 'b'.repeat(64),
    requestedAuthority: 'privileged',
    strategicLenses: ['l99', 'ooda', 'redteam'],
    routingReason: 'Founder requested an exact-state release plan with proof before action.',
    capabilities: [
      {
        id: 'repo-release-plan',
        version: '1.0.0',
        origin: 'founder-native',
        owner: 'jussray',
        sourceHash: 'c'.repeat(64),
        authorityCeiling: 'privileged',
      },
    ],
    proofRequirements: ['exact-head CI', 'founder review', 'runtime witness'],
    outcomeSignals: ['release remains reversible', 'runtime matches approved head'],
    rollback: 'Do not execute. If the plan becomes stale, regenerate it from current repository truth.',
  });
}

describe('founder authority handoff', () => {
  it('creates a deterministic fingerprinted proposal bound to the exact capability plan', () => {
    const capabilityPlan = plan();
    const handoff = createFounderAuthorityHandoff(capabilityPlan);

    expect(validateFounderAuthorityHandoff(handoff, capabilityPlan)).toEqual({ valid: true, errors: [] });
    expect(handoff.capabilityPlanHash).toBe(capabilityPlan.planHash);
    expect(handoff.expectedHeadSha).toBe(capabilityPlan.expectedHeadSha);
    expect(handoff.authority.permitsApproval).toBe(false);
    expect(handoff.authority.permitsExecution).toBe(false);
    expect(handoff.authority.cookieAuthority).toBe('forbidden');
    expect(handoff.fingerprint).toBe(founderAuthorityHandoffFingerprint(handoff));
  });

  it('rejects stale or mismatched repository state', () => {
    const capabilityPlan = plan();
    const handoff = createFounderAuthorityHandoff(capabilityPlan);

    const stale = { ...handoff, expectedHeadSha: 'd'.repeat(40) };
    stale.fingerprint = founderAuthorityHandoffFingerprint(stale);

    expect(validateFounderAuthorityHandoff(stale, capabilityPlan).errors)
      .toContain('Founder authority handoff head SHA does not match capability plan');
  });

  it('rejects a forged fingerprint even when the rest of the payload looks valid', () => {
    const capabilityPlan = plan();
    const handoff = createFounderAuthorityHandoff(capabilityPlan);

    expect(validateFounderAuthorityHandoff({ ...handoff, fingerprint: 'f'.repeat(64) }, capabilityPlan).errors)
      .toContain('Founder authority handoff fingerprint does not match content');
  });

  it('refuses to let Chief claim founder identity or decision authority', () => {
    const capabilityPlan = plan();
    const handoff = createFounderAuthorityHandoff(capabilityPlan);
    const forged = { ...handoff, founderId: 'jussray', decisionReceiptId: 'founder-decision-receipt-v0:fake' };
    forged.fingerprint = founderAuthorityHandoffFingerprint(forged);

    expect(validateFounderAuthorityHandoff(forged, capabilityPlan).errors)
      .toContain('Chief authority handoff cannot claim founder identity or decision authority');
  });

  it('rejects any attempt to turn browser-cookie state into authority', () => {
    const capabilityPlan = plan();
    const handoff = createFounderAuthorityHandoff(capabilityPlan);
    const forged = {
      ...handoff,
      authority: { ...handoff.authority, cookieAuthority: 'allowed' },
    };
    forged.fingerprint = founderAuthorityHandoffFingerprint(forged);

    expect(validateFounderAuthorityHandoff(forged, capabilityPlan).errors)
      .toContain('Founder authority handoff must remain proposal-only and cookie-free for authority');
  });
});
