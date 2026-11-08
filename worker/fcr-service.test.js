import { describe, expect, it, vi } from 'vitest';
import { createCapabilityRegistry } from '../src/domain/capability-registry.js';
import { sha256Hex } from '../src/domain/capability-plan.js';
import { createGoalPlan } from '../src/domain/goal-plan.js';
import { AnthropicProviderError } from './anthropic-provider.js';
import {
  CHIEF_CAPABILITY_PLAN_CONTRACT,
  CHIEF_FCR_RPC_CONTRACT,
  CHIEF_PROVIDER_RUN_CONTRACT,
  createFounderControlRoomCapabilityPlan,
  getArtifactReleaseSha,
  getFounderControlRoomServiceVersion,
  runFounderControlRoomProviderMessage,
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

function providerRequest(overrides = {}) {
  return {
    contract: CHIEF_PROVIDER_RUN_CONTRACT,
    workspace_id: 'founder-control-room',
    project_id: 'chief-ai-machine',
    asset_id: 'friend-mode-session-001',
    asset_version: 'v1',
    context_fingerprint: 'b'.repeat(64),
    audience_segment: 'founder',
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    max_tokens: 256,
    timeout_ms: 5000,
    messages: [{ role: 'user', content: 'Choose the next bounded step.' }],
    approval: {
      source_system: 'founder-control-room',
      founder_approved: true,
      execution_authorized: true,
      consequence: 'provider-billing',
      receipt_id: 'fcr-provider-approval-1',
      approved_at: '2026-09-15T22:00:00.000Z',
    },
    ...overrides,
  };
}

function providerResult() {
  return {
    provider: 'anthropic',
    api: 'messages',
    api_version: '2023-06-01',
    request_id: 'req_1',
    provider_message_id: 'msg_1',
    requested_model: 'claude-sonnet-5',
    resolved_model: 'claude-sonnet-5',
    output_text: 'Use the existing learning carrier.',
    content_types: ['text'],
    stop_reason: 'end_turn',
    usage: { input_tokens: 20, output_tokens: 7 },
    latency_ms: 500,
    observed_at: '2026-09-15T22:00:01.000Z',
    provenance_locked: true,
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
      providerRunContract: CHIEF_PROVIDER_RUN_CONTRACT,
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

  it('rejects an unapproved billed provider call before contacting Anthropic', async () => {
    const runAnthropicMessage = vi.fn();
    const input = providerRequest({
      approval: {
        ...providerRequest().approval,
        founder_approved: false,
      },
    });

    const response = await runFounderControlRoomProviderMessage(
      { ANTHROPIC_API_KEY: 'server-only-fixture' },
      input,
      releaseSha,
      { runAnthropicMessage },
    );

    expect(response.ok).toBe(false);
    expect(response.status).toBe(400);
    expect(response.releaseSha).toBe(releaseSha);
    expect(response.error.code).toBe('provider_run_rejected');
    expect(runAnthropicMessage).not.toHaveBeenCalled();
  });

  it('executes an approved provider call and returns only quarantined learning authority', async () => {
    const runAnthropicMessage = vi.fn(async () => providerResult());
    const response = await runFounderControlRoomProviderMessage(
      { ANTHROPIC_API_KEY: 'server-only-fixture', RELEASE_SHA: spoofedRuntimeSha },
      providerRequest(),
      releaseSha,
      { runAnthropicMessage },
    );

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.releaseSha).toBe(releaseSha);
    expect(runAnthropicMessage).toHaveBeenCalledTimes(1);
    expect(response.result.output).toMatchObject({
      provider: 'anthropic',
      requestId: 'req_1',
      messageId: 'msg_1',
      text: 'Use the existing learning carrier.',
    });
    expect(response.result.learningReceipt).toMatchObject({
      state: 'QUARANTINED',
      provider: 'anthropic',
      authority: {
        provider_output_approved: false,
        promotion_allowed: false,
        learning_authority: 'advisory_only',
        may_increase_authority: false,
        may_execute_external_action: false,
        founder_review_required_for_promotion: true,
      },
    });
  });

  it('does not leak provider credentials when a provider error crosses the RPC boundary', async () => {
    const runAnthropicMessage = vi.fn(async () => {
      throw new AnthropicProviderError('provider_timeout', 'Anthropic request timed out.', 504, 'req_timeout');
    });
    const response = await runFounderControlRoomProviderMessage(
      { ANTHROPIC_API_KEY: 'never-return-this-fixture' },
      providerRequest(),
      releaseSha,
      { runAnthropicMessage },
    );

    expect(response).toMatchObject({
      ok: false,
      status: 504,
      releaseSha,
      error: {
        code: 'provider_timeout',
        message: 'Anthropic request timed out.',
        requestId: 'req_timeout',
      },
    });
    expect(JSON.stringify(response)).not.toContain('never-return-this-fixture');
  });
});
