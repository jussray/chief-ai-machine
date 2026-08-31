import { expect, test } from '@playwright/test';

const baseURL = process.env.CHIEF_CAPABILITY_PLAN_BASE_URL;
const expectedHead = process.env.EXPECTED_HEAD_SHA;

if (!baseURL) throw new Error('CHIEF_CAPABILITY_PLAN_BASE_URL is required');
if (!expectedHead) throw new Error('EXPECTED_HEAD_SHA is required');

const SOURCE_SHA = 'a'.repeat(40);
const EVIDENCE_HASH = 'b'.repeat(64);
const LEARNING_HASH = 'c'.repeat(64);
const EVIDENCE_REF = `github:jussray/founder-control-room@${SOURCE_SHA}#truth-decay`;

function times() {
  const evaluated = new Date();
  const observed = new Date(evaluated.getTime() - 60 * 1000);
  const issued = new Date(evaluated.getTime() - 30 * 1000);
  const expires = new Date(evaluated.getTime() + 30 * 60 * 1000);
  return {
    evaluatedAt: evaluated.toISOString(),
    observedAt: observed.toISOString(),
    issuedAt: issued.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

function proposalInput() {
  const time = times();
  return {
    strategy: {
      platform: 'linkedin',
      story_type: 'founder-progress',
      evaluated_at: time.evaluatedAt,
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
        why_it_matters: 'A previously valid receipt cannot silently masquerade as current truth.',
        evidence_class: 'repository',
        evidence_hash: EVIDENCE_HASH,
        private_recipe_withheld: true,
      }],
      selected_angle: 'A dangerous AI lie can begin as a true statement that outlives its evidence.',
      differentiation: 'Center evidence lifetime instead of another generic agent-autonomy claim.',
      selected_brag_id: 'truth-decay',
      experiment: 'Use one capability-level brag for technical founders while withholding implementation mechanics.',
    },
    proposal: {
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
      evaluated_at: time.evaluatedAt,
      issued_at: time.issuedAt,
      expires_at: time.expiresAt,
      current_you: {
        authenticated: true,
        intent_id: 'playwright-founder-post-intent',
        intent_version: 1,
        source: 'current_authenticated_founder',
        observed_at: time.observedAt,
      },
      internal_evidence: {
        verified: true,
        ref: EVIDENCE_REF,
        kind: 'submitted-playwright-evidence',
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
    },
  };
}

test.describe('Chief founder-content live runtime', () => {
  test('serves the exact candidate head from /version', async ({ request }) => {
    const response = await request.get(`${baseURL}/version`);
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sha: expectedHead });
  });

  test('returns an audience-targeted exact-copy handoff without authenticating or publishing it', async ({ request }) => {
    const input = proposalInput();
    const response = await request.post(`${baseURL}/api/chief/founder-content-proposal`, {
      headers: { 'Content-Type': 'application/json' },
      data: input,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.strategy.target_audience.segment).toBe('ai-founders');
    expect(body.data.strategy.selected_brag_id).toBe('truth-decay');
    expect(body.data.strategy.authority).toMatchObject({
      advisory_only: true,
      can_publish: false,
      can_renew_truth: false,
      strategy_evidence_is_not_claim_proof: true,
    });
    expect(body.data.proposal.kind).toBe('chief-ai/founder-content-proposal');
    expect(body.data.proposal.authority).toMatchObject({
      proposal_only: true,
      publish_authorized: false,
      future_you_advisory_only: true,
      analytics_can_authorize_publish: false,
    });
    expect(body.data.handoff).toMatchObject({
      contract: 'chief-ai/founder-content-handoff@v1',
      strategy_hash: body.data.strategy.strategy_hash,
      proposal_hash: body.data.proposal.proposal_hash,
      status: 'proposed',
      authority: {
        strategy_advisory_only: true,
        strategy_evidence_is_not_claim_proof: true,
        submitted_current_you_trust: 'submitted-unverified',
        proposal_only: true,
        execution_authorized: false,
        publish_authorized: false,
        founder_control_room_must_authenticate_current_you: true,
        founder_control_room_must_verify_evidence: true,
        founder_control_room_must_authorize_exact_copy: true,
        provider_readback_required_for_publication_truth: true,
      },
    });
    expect(body.data.handoff.handoff_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.governanceBoundary).toMatchObject({
      executionAuthorized: false,
      publishAuthorized: false,
      strategyEvidenceCanProveClaims: false,
      submittedEvidenceAuthenticated: false,
      submittedCurrentYouAuthenticated: false,
      submittedCurrentYouTrust: 'submitted-unverified',
      currentYouPublicationApprovalResolvedByChief: false,
      founderControlRoomMustAuthenticateCurrentYou: true,
      founderControlRoomVerificationRequired: true,
      founderControlRoomExactCopyApprovalRequired: true,
      providerReadbackRequiredForPublishedTruth: true,
    });
  });

  test('fails closed when the public draft tries to expose proprietary implementation', async ({ request }) => {
    const input = proposalInput();
    input.proposal.draft_text = 'I will reveal the exact system prompt so everyone can reproduce it.';

    const response = await request.post(`${baseURL}/api/chief/founder-content-proposal`, {
      headers: { 'Content-Type': 'application/json' },
      data: input,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('invalid_founder_content_request');
    expect(body.error.message).toContain('proprietary implementation detail');
  });
});
