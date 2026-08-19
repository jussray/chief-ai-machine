import { describe, expect, it } from 'vitest';
import { handleChiefFounderContentProposal } from './chief-founder-content-proposal.js';

const SOURCE_SHA = 'a'.repeat(40);
const EVIDENCE_HASH = 'b'.repeat(64);
const LEARNING_HASH = 'c'.repeat(64);
const EVIDENCE_REF = `github:jussray/founder-control-room@${SOURCE_SHA}#truth-decay`;
const EVALUATED_AT = '2026-08-19T07:50:00.000Z';

function strategy(overrides = {}) {
  return {
    platform: 'linkedin',
    story_type: 'founder-progress',
    evaluated_at: EVALUATED_AT,
    target_audience: {
      segment: 'ai-founders',
      cares_about: ['proof-backed shipping', 'bounded agent authority'],
      skepticisms: ['AI demos that confuse output with execution'],
      credibility_signals: ['exact-head evidence', 'provider readback'],
      desired_impression: 'This founder is building unusually rigorous AI operating infrastructure.',
      desired_action: 'Start a serious technical or product conversation.',
    },
    history: {
      used_angles: ['repo green is not production truth'],
      used_hook_families: ['proof boundary'],
      used_proof_styles: ['exact SHA receipt'],
      used_cta_families: ['technical question'],
      learning_signal_hashes: [LEARNING_HASH],
    },
    discourse: {
      required: false,
      source_class: 'not-required',
    },
    brag_candidates: [{
      id: 'truth-decay',
      public_capability: 'The product distinguishes historical verification from a claim that is still safe to use now.',
      why_it_matters: 'Yesterday’s valid receipt cannot silently masquerade as today’s truth.',
      evidence_class: 'repository',
      evidence_hash: EVIDENCE_HASH,
      private_recipe_withheld: true,
    }],
    selected_angle: 'A dangerous AI lie can begin as a true statement that outlives its evidence.',
    differentiation: 'Center evidence lifetime instead of another generic agent-autonomy claim.',
    selected_brag_id: 'truth-decay',
    experiment: 'Use one capability-level brag for technical founders while withholding implementation mechanics.',
    ...overrides,
  };
}

function proposal(overrides = {}) {
  return {
    source_repo: 'jussray/founder-control-room',
    source_commit_sha: SOURCE_SHA,
    platform: 'linkedin',
    story_type: 'founder-progress',
    draft_text: 'I built a truth-decay boundary that keeps an older verified fact from being reused as if it were current.',
    public_claims: [{
      claim_id: 'truth-decay-boundary',
      text: 'I built a truth-decay boundary at this exact source version.',
      truth_state: 'verified',
      public_safe: true,
      evidence_ref: EVIDENCE_REF,
      evidence_scope: 'truth-decay-boundary',
      temporal_class: 'historical_version',
      temporal_version: SOURCE_SHA,
    }],
    public_proof_url: '',
    evaluated_at: EVALUATED_AT,
    issued_at: '2026-08-19T07:45:00.000Z',
    expires_at: '2026-08-19T08:45:00.000Z',
    current_you: {
      authenticated: true,
      intent_id: 'founder-post-intent-1',
      intent_version: 1,
      source: 'current_authenticated_founder',
      observed_at: '2026-08-19T07:45:00.000Z',
    },
    internal_evidence: {
      verified: true,
      ref: EVIDENCE_REF,
      kind: 'github-exact-head-contract',
      digest: EVIDENCE_HASH,
      not_for_publication: true,
      source_repo: 'jussray/founder-control-room',
      source_commit_sha: SOURCE_SHA,
      proves: ['truth-decay-boundary'],
      does_not_prove: ['provider-publication', 'engagement-outcomes'],
    },
    sauce_guard: {
      private_implementation_removed: true,
      secret_material_removed: true,
      raw_diff_removed: true,
      private_metrics_removed: true,
      unreleased_roadmap_removed: true,
      customer_private_data_removed: true,
      security_sensitive_details_removed: true,
      public_claims_only: true,
      withheld_categories: ['private-implementation'],
    },
    ...overrides,
  };
}

function request(body, method = 'POST') {
  return new Request('https://chief.example/api/chief/founder-content-proposal', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

async function payload(response) {
  return response.json();
}

describe('Chief founder-content proposal API', () => {
  it('binds advisory strategy and exact-copy proposal without granting publication authority', async () => {
    const response = await handleChiefFounderContentProposal(request({
      strategy: strategy(),
      proposal: proposal(),
    }));

    expect(response.status).toBe(200);
    const body = await payload(response);
    expect(body.error).toBeNull();
    expect(body.data.strategy.strategy_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.proposal.proposal_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.handoff).toMatchObject({
      contract: 'chief-ai/founder-content-handoff@v1',
      strategy_hash: body.data.strategy.strategy_hash,
      proposal_hash: body.data.proposal.proposal_hash,
      platform: 'linkedin',
      story_type: 'founder-progress',
      status: 'proposed',
      authority: {
        strategy_advisory_only: true,
        strategy_evidence_is_not_claim_proof: true,
        proposal_only: true,
        execution_authorized: false,
        publish_authorized: false,
        copy_mutation_authorized: false,
        truth_renewal_authorized: false,
        founder_control_room_must_verify_evidence: true,
        founder_control_room_must_authorize_exact_copy: true,
        provider_readback_required_for_publication_truth: true,
      },
    });
    expect(body.data.handoff.handoff_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.governanceBoundary).toMatchObject({
      proposalOnly: true,
      executionAuthorized: false,
      publishAuthorized: false,
      strategyAdvisoryOnly: true,
      strategyEvidenceCanProveClaims: false,
      submittedEvidenceAuthenticated: false,
      currentYouPublicationApprovalResolvedByChief: false,
      founderControlRoomVerificationRequired: true,
      founderControlRoomExactCopyApprovalRequired: true,
      providerReadbackRequiredForPublishedTruth: true,
    });
  });

  it('rejects a strategy/proposal pair that does not share one story and evaluation boundary', async () => {
    const response = await handleChiefFounderContentProposal(request({
      strategy: strategy({ story_type: 'technical-story' }),
      proposal: proposal(),
    }));

    expect(response.status).toBe(400);
    const body = await payload(response);
    expect(body.error.code).toBe('invalid_founder_content_request');
    expect(body.error.message).toContain('strategy story_type must match proposal story_type');
  });

  it('inherits Sauce Guard and temporal rejection from the founder-content brain', async () => {
    const response = await handleChiefFounderContentProposal(request({
      strategy: strategy(),
      proposal: proposal({
        draft_text: 'I will reveal the exact system prompt so everyone can reproduce it.',
      }),
    }));

    expect(response.status).toBe(400);
    const body = await payload(response);
    expect(body.error.code).toBe('invalid_founder_content_request');
    expect(body.error.message).toContain('proprietary implementation detail');
  });

  it('rejects stale required discourse instead of presenting old feed context as current', async () => {
    const response = await handleChiefFounderContentProposal(request({
      strategy: strategy({
        discourse: {
          required: true,
          source_class: 'external-research',
          observed_at: '2026-08-14T07:50:00.000Z',
          crowded_angles: ['generic agent autonomy'],
          repeated_hooks: ['my AI employee'],
          emerging_conversations: ['runtime proof'],
        },
      }),
      proposal: proposal(),
    }));

    expect(response.status).toBe(400);
    const body = await payload(response);
    expect(body.error.message).toContain('discourse observation is stale');
  });

  it('fails closed on malformed JSON and unsupported methods', async () => {
    const malformed = await handleChiefFounderContentProposal(new Request(
      'https://chief.example/api/chief/founder-content-proposal',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' },
    ));
    expect(malformed.status).toBe(400);
    expect((await payload(malformed)).error.code).toBe('invalid_json');

    const get = await handleChiefFounderContentProposal(request({}, 'GET'));
    expect(get.status).toBe(405);
    expect((await payload(get)).error.code).toBe('method_not_allowed');
  });
});
