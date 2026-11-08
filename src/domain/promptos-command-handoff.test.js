import { describe, expect, it } from 'vitest';
import {
  PROMPTOS_PUBLIC_COMMAND_INTENT_CONTRACT,
  PROMPTOS_CHIEF_FCR_COMMAND_HANDOFF_CONTRACT,
  createPromptOSChiefCommandHandoff,
} from './promptos-command-handoff.js';

function intent() {
  return {
    schema: PROMPTOS_PUBLIC_COMMAND_INTENT_CONTRACT,
    command: { id: 'contract', token: '/contract', category: 'Legal', label: 'Contract' },
    arguments: 'private-DATA-MARKER',
    project: 'truth-weaver',
    capabilityId: 'legal-navigation',
    route: {
      owner: 'promptos',
      reasoningPlane: 'chief-ai-machine',
      specialistProduct: 'truth-weaver',
      authorityPlane: 'founder-control-room',
    },
    authorityCeiling: 'advisory-only',
    execution: { status: 'not-executed', mutationAuthorized: false },
    evidence: { contract: 'current-authority', staleOnStateChange: true },
    catalogQuery: 'contract',
  };
}

describe('private PromptOS to Chief FCR command handoff', () => {
  it('produces a non-authorizing metadata-only handoff without leaking caller arguments', () => {
    const result = createPromptOSChiefCommandHandoff(intent());
    expect(result).toMatchObject({
      schema: PROMPTOS_CHIEF_FCR_COMMAND_HANDOFF_CONTRACT,
      acceptedBy: 'chief-ai-machine',
      project: 'truth-weaver',
      capabilityId: 'legal-navigation',
      specialistProduct: 'truth-weaver',
      authorityResolution: 'unresolved',
      authorityPlane: 'founder-control-room',
      executionAuthorized: false,
      actionAuthority: false,
      nextRequiredContract: 'juss-v10/capability-plan@v1',
    });
    expect(JSON.stringify(result)).not.toContain('private-DATA-MARKER');
  });

  it('rejects caller-provided execution authority and mutated route ownership', () => {
    expect(() => createPromptOSChiefCommandHandoff({
      ...intent(),
      execution: { status: 'executed', mutationAuthorized: true },
    })).toThrow();
    expect(() => createPromptOSChiefCommandHandoff({
      ...intent(),
      route: { ...intent().route, authorityPlane: 'chief-ai-machine' },
    })).toThrow();
  });

  it('rejects ambiguous or cross-project resolved scope', () => {
    expect(() => createPromptOSChiefCommandHandoff({ ...intent(), project: '' })).toThrow();
    expect(() => createPromptOSChiefCommandHandoff(intent(), {
      resolvedProject: 'different-project',
    })).toThrow();
  });
});
