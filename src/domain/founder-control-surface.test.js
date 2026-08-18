import { describe, expect, it } from 'vitest';
import {
  FOUNDER_CONTROL_ORCHESTRATORS,
  FOUNDER_CONTROL_SURFACES,
  founderControlHandoff,
} from './founder-control-surface.js';

describe('founder control handoff', () => {
  it('exposes the same founder surfaces and live orchestrators without granting authority', () => {
    const handoff = founderControlHandoff({ planHash: 'a'.repeat(64) });
    expect(handoff.surfaces).toEqual(['fcr', 'chatgpt', 'claude', 'perplexity']);
    expect(handoff.orchestrators).toEqual(['n8n', 'zapier']);
    expect(FOUNDER_CONTROL_SURFACES).toEqual(handoff.surfaces);
    expect(FOUNDER_CONTROL_ORCHESTRATORS).toEqual(handoff.orchestrators);
    expect(handoff).toMatchObject({
      founderDecisionRequired: true,
      explicitDecisionOnly: true,
      proposalMutationInvalidatesApproval: true,
      surfaceMaySelfAuthorize: false,
      chiefMaySelfAuthorize: false,
      executionAuthorized: false,
      receiptRequiredAfterExecution: true,
    });
  });

  it('fails closed when no exact capability-plan identity exists', () => {
    expect(() => founderControlHandoff({ planHash: '' }))
      .toThrow('Chief capability plan hash must be a 64-character SHA-256 hash.');
  });
});
