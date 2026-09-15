import { describe, expect, it } from 'vitest';
import { createCapabilityRegistry } from '../src/domain/capability-registry.js';
import { sha256Hex } from '../src/domain/capability-plan.js';
import { createGoalPlan } from '../src/domain/goal-plan.js';
import {
  CHIEF_CAPABILITY_PLAN_CONTRACT,
  CHIEF_FCR_RPC_CONTRACT,
  createFounderControlRoomCapabilityPlan,
  getArtifactReleaseSha,
  getFounderControlRoomServiceVersion,
} from './fcr-service.js';

const releaseSha = '73c36e61dae96bf1bb94990d3b5e5a6a0bb70b24';
const spoofedRuntimeSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function requestInput() {
  const registrySnapshot = createCapabilityRegistry({
    registryId: 'fcr-rpc-registry',
    version: '2026-08-19.1',
    approvedBy: 'founder-fixture',
    capabilities: [{
      id: 'goalfix-v1',
      version: '1.0.0',
      origin: 'repo-native',
      owner: 'jussray/chief-ai-machine',
      sourceHash: sha256Hex('goalfix-v1-fixture'),
      authorityCeiling: 'draft',
    }],
  });

  return {
    goalPlan: createGoalPlan({
      goal: 'Prepare one bounded Cloudflare-bound capability plan',
      project: 'founder-control-room',
      definitionOfDone: 'FCR receives a non-authorizing Chief proposal over the private binding',
      strategicLenses: ['truthmode', 'redteam', 'ooda'],
      capabilities: ['goalfix-v1'],
      proofRequirements: ['exact-head tests are green'],
      rollback: 'remove the FCR service binding and named entrypoint',
      nextGate: 'Founder Control Room resolves registry and exact-head authority',
    }),
    registrySnapshot,
    expectedHeadSha: releaseSha,
    requestedAuthority: 'draft',
  };
}

describe('Founder Control Room RPC service contract', () => {
  it('binds service identity and contracts to the baked artifact SHA', () => {
    expect(getFounderControlRoomServiceVersion(
      { RELEASE_SHA: spoofedRuntimeSha },
      releaseSha,
    )).toEqual({
      ok: true,
      service: 'chief-ai',
      rpcContract: CHIEF_FCR_RPC_CONTRACT,
      capabilityPlanContract: CHIEF_CAPABILITY_PLAN_CONTRACT,
      releaseSha,
    });
  });

  it('does not invent an authority-bearing artifact SHA', () => {
    expect(getArtifactReleaseSha('unknown')).toBe('unknown');
    expect(getArtifactReleaseSha(spoofedRuntimeSha)).toBe(spoofedRuntimeSha);
  });

  it('returns the existing proposal-only capability plan envelope through the RPC adapter', async () => {
    const response = await createFounderControlRoomCapabilityPlan(
      { RELEASE_SHA: spoofedRuntimeSha },
      requestInput(),
      releaseSha,
    );

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.service).toBe('chief-ai');
    expect(response.releaseSha).toBe(releaseSha);
    expect(response.rpcContract).toBe('juss-v10/chief-fcr-rpc@v1');
    expect(response.capabilityPlanContract).toBe('juss-v10/capability-plan@v1');
    expect(response.result.data.capabilityPlan.contract).toBe('juss-v10/capability-plan@v1');
    expect(response.result.data.governanceBoundary).toMatchObject({
      proposalOnly: true,
      executionAuthorized: false,
      founderApprovalRequired: true,
    });
  });
});
