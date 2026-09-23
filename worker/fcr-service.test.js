import { describe, expect, it } from 'vitest';
import { createCapabilityRegistry } from '../src/domain/capability-registry.js';
import { sha256Hex } from '../src/domain/capability-plan.js';
import { createGoalPlan } from '../src/domain/goal-plan.js';
import { BIP_FCR_EVIDENCE_CONTRACT } from '../src/domain/bip-fcr-evidence.js';
import {
  CHIEF_CAPABILITY_PLAN_CONTRACT,
  CHIEF_FCR_RPC_CONTRACT,
  createFounderControlRoomCapabilityPlan,
  getArtifactReleaseSha,
  getFounderControlRoomServiceVersion,
  ingestFounderControlRoomBipEvidence,
} from './fcr-service.js';

const releaseSha = '73c36e61dae96bf1bb94990d3b5e5a6a0bb70b24';
const spoofedRuntimeSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const bipSha = '579342699fc7fb394cf9684643756cdc8c9342a8';

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

function bipEvidence() {
  return {
    schemaVersion: 1,
    id: 'bip-fcr-123e4567-e89b-42d3-a456-426614174000',
    workspaceId: 'juss',
    projectId: 'sekret-bip',
    sourceSystem: 'founder-control-room',
    sourceRecordId: '123e4567-e89b-42d3-a456-426614174000',
    sourceRevision: bipSha,
    kind: 'workflow',
    subjectType: 'sekret-bip-control-room-proof',
    subjectId: bipSha,
    subjectRef: `github:jussray/Sekret-Bip@${bipSha}`,
    state: 'verified',
    statement: `Se’kret Bip Control Room exact-head test ledger is verified for ${bipSha}.`,
    sourceRefs: [
      'juss-proof:123e4567-e89b-42d3-a456-426614174000',
      `github:jussray/Sekret-Bip@${bipSha}`,
    ],
    status: 'active',
    supersedesReceiptId: '',
    observedAt: '2026-09-23T04:10:00.000Z',
    recordedAt: '2026-09-23T04:10:01.000Z',
    authority: {
      scope: 'evidence-only',
      instructionPolicy: 'data-only',
      permitsRepositoryWrite: false,
      permitsExecution: false,
      permitsDeployment: false,
      permitsPublishing: false,
      permitsBilling: false,
      permitsApproval: false,
      permitsSecretMutation: false,
      permitsDestructiveAction: false,
    },
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
      bipEvidenceContract: BIP_FCR_EVIDENCE_CONTRACT,
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

  it('accepts FCR-issued Bip evidence through the private RPC without gaining authority', () => {
    const response = ingestFounderControlRoomBipEvidence(
      { RELEASE_SHA: spoofedRuntimeSha },
      bipEvidence(),
      releaseSha,
    );

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.releaseSha).toBe(releaseSha);
    expect(response.bipEvidenceContract).toBe(BIP_FCR_EVIDENCE_CONTRACT);
    expect(response.result.accepted).toBe(true);
    expect(response.result.authority.permitsExecution).toBe(false);
    expect(response.result.authority.permitsApproval).toBe(false);
  });

  it('fails closed when a non-FCR source tries to inject Bip evidence', () => {
    const response = ingestFounderControlRoomBipEvidence(
      {},
      { ...bipEvidence(), sourceSystem: 'sekret-bip-audit-mirror' },
      releaseSha,
    );

    expect(response.ok).toBe(false);
    expect(response.status).toBe(422);
    expect(response.error).toMatch(/invalid|Founder Control Room/i);
  });
});
