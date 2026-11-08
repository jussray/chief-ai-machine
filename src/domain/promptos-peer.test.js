import { describe, expect, it } from 'vitest';
import {
  PROMPTOS_CHIEF_FCR_COMMAND_HANDOFF_CONTRACT,
  PROMPTOS_COMMAND_NEXT_CONTRACT,
  PROMPTOS_PUBLIC_COMMAND_INTENT_CONTRACT,
  createPromptOSChiefCommandHandoff,
  promptOSPublicCommandIntentFingerprint,
  validatePromptOSPublicCommandIntent,
} from './promptos-peer.js';

function publicIntent(overrides = {}) {
  return {
    schema: PROMPTOS_PUBLIC_COMMAND_INTENT_CONTRACT,
    command: { id: 'fix', token: '/fix', category: 'Build', label: 'Fix' },
    arguments: 'checkout',
    project: "Se'kret Bip",
    capabilityId: 'repair',
    route: {
      owner: 'promptos',
      reasoningPlane: 'chief-ai-machine',
      specialistProduct: 'se-kret-bip',
      authorityPlane: 'founder-control-room',
    },
    authorityCeiling: 'advisory-only',
    execution: { status: 'not-executed', mutationAuthorized: false },
    evidence: { contract: 'source-and-runtime', staleOnStateChange: true },
    catalogQuery: 'repo audit',
    ...overrides,
  };
}

describe('PromptOS public command peer handoff', () => {
  it('accepts one advisory public command and emits a non-authorizing FCR handoff', () => {
    const intent = publicIntent();
    expect(validatePromptOSPublicCommandIntent(intent)).toMatchObject({ valid: true, errors: [] });

    const handoff = createPromptOSChiefCommandHandoff(intent);
    expect(handoff.contract).toBe(PROMPTOS_CHIEF_FCR_COMMAND_HANDOFF_CONTRACT);
    expect(handoff.sourceIntentFingerprint).toBe(promptOSPublicCommandIntentFingerprint(intent));
    expect(handoff.acceptedBy).toBe('chief-ai-machine');
    expect(handoff.status).toBe('accepted-for-capability-planning');
    expect(handoff.project).toBe("Se'kret Bip");
    expect(handoff.capabilityId).toBe('repair');
    expect(handoff.specialistProduct).toBe('se-kret-bip');
    expect(handoff.actionAuthority).toBe(false);
    expect(handoff.executionAuthorized).toBe(false);
    expect(handoff.authorityResolution).toBe('unresolved');
    expect(handoff.nextRequiredContract).toBe(PROMPTOS_COMMAND_NEXT_CONTRACT);
    expect(handoff.handoffFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('allows Chief to add project context only when PromptOS did not already supply one', () => {
    const intent = publicIntent({ project: null });
    const handoff = createPromptOSChiefCommandHandoff(intent, { resolvedProject: 'founder-control-room' });
    expect(handoff.project).toBe('founder-control-room');
    expect(handoff.projectSource).toBe('chief-context');
    expect(handoff.sourceIntent.project).toBeNull();
  });

  it('fails closed when project context remains unresolved', () => {
    expect(() => createPromptOSChiefCommandHandoff(publicIntent({ project: null })))
      .toThrow('project context is required');
  });

  it('rejects public-command attempts to expose internal control modes or self-authorize execution', () => {
    expect(validatePromptOSPublicCommandIntent(publicIntent({
      command: { id: 'ultrathink', token: '/ultrathink', category: 'Build', label: 'ULTRATHINK' },
    })).errors).toContain('system-owned control modes are not valid public command ids');

    expect(validatePromptOSPublicCommandIntent(publicIntent({
      execution: { status: 'executed', mutationAuthorized: true },
    })).errors).toEqual(expect.arrayContaining([
      'PromptOS command intent cannot claim execution',
      'PromptOS command intent cannot authorize mutation',
    ]));
  });

  it('rejects route drift away from Chief reasoning and FCR authority', () => {
    expect(validatePromptOSPublicCommandIntent(publicIntent({
      route: {
        owner: 'promptos',
        reasoningPlane: 'promptos',
        specialistProduct: 'se-kret-bip',
        authorityPlane: 'promptos',
      },
    })).errors).toEqual(expect.arrayContaining([
      'Chief AI must remain the reasoning plane',
      'Founder Control Room must remain the authority plane',
    ]));
  });
});
