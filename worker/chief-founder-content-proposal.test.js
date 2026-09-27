import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { handleChiefFounderContentProposal } from './chief-founder-content-proposal.js';

const SOURCE_SHA = 'a'.repeat(40);
const EVIDENCE_HASH = 'b'.repeat(64);
const LEARNING_HASH = 'c'.repeat(64);
const HISTORY_DIGEST = 'd'.repeat(64);
const V4_SUBJECT_HASH = '2'.repeat(64);
const V4_OBSERVATION_HASH = '3'.repeat(64);
const V4_LEARNING_HASH = createHash('sha256')
  .update(`ultrathink/v4-advisory-handoff@v0\n${V4_SUBJECT_HASH}\n${V4_OBSERVATION_HASH}\nATTESTED`)
  .digest('hex');
const V4_HANDOFF = Object.freeze({
  schema: 'ultrathink/v4-advisory-handoff@v0',
  evidenceLevel: 'ATTESTED',
  subjectHash: V4_SUBJECT_HASH,
  observationHash: V4_OBSERVATION_HASH,
  learningHash: V4_LEARNING_HASH,
});
const EVIDENCE_REF = `github:jussray/founder-control-room@${SOURCE_SHA}#truth-decay`;
const EVALUATED_AT = '2026-08-19T07:50:00.000Z';

const VISUAL_DIRECTION = Object.freeze({
  creative_mode: 'cinematic-proof',
  form: 'short-video-9x16',
  emotional_intent: ['wonder', 'revelation'],
  visual_hook: 'A proof signal crosses a dark system and stops at an unresolved boundary.',
  scene_concept: 'A quiet verification signal moves through a system, stops at a boundary, and reveals the difference between output and proven outcome.',
  motion_language: 'Slow drift, restrained stop, then a quiet pull-back.',
  memory_line: 'Stopping correctly is a capability.',
  human_outcome: 'Help the viewer distinguish task completion from verified outcome.',
  proof_object: 'Exact-version evidence receipt',
  proof_truth_boundary: 'The receipt proves source-level exact-version behavior, not production outcome.',
  targets: ['linkedin'],
  preserves_human_agency: true,
  uses_manipulative_dark_patterns: false,
});

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

function strategyAwareInput(legacyStrategy, proposalInput) {
  const discourse = legacyStrategy.discourse || {};
  const observedAt = proposalInput.current_you?.observed_at || legacyStrategy.evaluated_at;
  const lastPublishedAt = new Date(Date.parse(observedAt) - 60_000).toISOString();
  const claimId = proposalInput.public_claims?.[0]?.claim_id || 'truth-decay-boundary';
  return {
    evaluated_at: legacyStrategy.evaluated_at,
    audience: {
      primary_segment: legacyStrategy.target_audience?.segment || 'ai-founders',
      cares_about: legacyStrategy.target_audience?.cares_about || ['proof-backed shipping'],
      skepticisms: legacyStrategy.target_audience?.skepticisms || [],
      credibility_signals: legacyStrategy.target_audience?.credibility_signals || ['exact-head evidence'],
      desired_impression: legacyStrategy.target_audience?.desired_impression || 'Trust the proof boundary.',
      desired_action: legacyStrategy.target_audience?.desired_action || 'Start a technical conversation.',
    },
    own_history: {
      observed_at: observedAt,
      history_digest: HISTORY_DIGEST,
      post_count: 1,
      last_published_at: lastPublishedAt,
      recent_pattern_signatures: [],
      learning_signal_hashes: legacyStrategy.history?.learning_signal_hashes || [],
      recent_draft_fingerprints: [],
    },
    market_context: discourse.required === true
      ? {
          required: true,
          source_class: discourse.source_class,
          observed_at: discourse.observed_at,
          feed_digest: EVIDENCE_HASH,
          source_count: 1,
          crowded_patterns: discourse.crowded_angles || [],
          repeated_hooks: discourse.repeated_hooks || [],
          emerging_conversations: discourse.emerging_conversations || [],
        }
      : { required: false, source_class: 'not-required' },
    verified_public_claim_ids: [claimId],
    strategy: {
      selected_angle: legacyStrategy.selected_angle,
      hook_pattern: 'failure-confession',
      frame_pattern: 'evidence-lifetime-frame',
      proof_pattern: 'exact-version-proof',
      closing_pattern: 'technical-invitation',
      counter_position: false,
      brag_claim_ids: [claimId],
      retired_patterns: ['generic-ai-agent-hook'],
      improvement_experiment: legacyStrategy.experiment,
    },
  };
}

function runtimeInput(body) {
  const proposalInput = body.proposal || {};
  const legacyStrategy = body.strategy || {};
  const strategyInput = strategyAwareInput(legacyStrategy, proposalInput);
  return {
    ...body,
    strategy: strategyInput,
    visual_direction: VISUAL_DIRECTION,
    use_context: {
      bound_at: strategyInput.evaluated_at,
      current_history_digest: HISTORY_DIGEST,
    },
  };
}

function rawRequest(body, method = 'POST') {
  return new Request('https://chief.example/api/chief/founder-content-proposal', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

function request(body, method = 'POST') {
  return rawRequest(method === 'POST' ? runtimeInput(body) : body, method);
}

async function payload(response) {
  return response.json();
}

describe('Chief founder-content proposal API', () => {
  it('routes the live API through the strategy-aware package without granting publication authority', async () => {
    const response = await handleChiefFounderContentProposal(request({
      strategy: strategy(),
      proposal: proposal(),
    }));

    expect(response.status).toBe(200);
    const body = await payload(response);
    expect(body.error).toBeNull();
    expect(body.data.strategy.strategy_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.strategyLease.kind).toBe('chief-ai/founder-content-strategy-lease');
    expect(body.data.visualDirection.kind).toBe('chief-ai/founder-content-visual-direction');
    expect(body.data.strategyBinding.kind).toBe('chief-ai/founder-content-strategy-binding');
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
        submitted_current_you_trust: 'submitted-unverified',
        proposal_only: true,
        execution_authorized: false,
        publish_authorized: false,
        copy_mutation_authorized: false,
        truth_renewal_authorized: false,
        founder_control_room_must_authenticate_current_you: true,
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
      submittedCurrentYouAuthenticated: false,
      submittedCurrentYouTrust: 'submitted-unverified',
      currentYouPublicationApprovalResolvedByChief: false,
      founderControlRoomMustAuthenticateCurrentYou: true,
      founderControlRoomVerificationRequired: true,
      founderControlRoomExactCopyApprovalRequired: true,
      providerReadbackRequiredForPublishedTruth: true,
    });
  });

  it('fails closed instead of accepting the weaker legacy route payload', async () => {
    const response = await handleChiefFounderContentProposal(rawRequest({
      strategy: strategy(),
      proposal: proposal(),
    }));
    expect(response.status).toBe(400);
    const body = await payload(response);
    expect(body.error.message).toContain('visual_direction');
    expect(body.error.message).toContain('use_context');
  });

  it('consumes a valid FCR V4 advisory handoff as hash-only strategy memory', async () => {
    const response = await handleChiefFounderContentProposal(request({
      strategy: strategy(),
      proposal: proposal(),
      v4_advisory_handoff: V4_HANDOFF,
    }));

    expect(response.status).toBe(200);
    const body = await payload(response);
    expect(body.data.strategy.history.learning_signal_hashes).toEqual([
      LEARNING_HASH,
      V4_LEARNING_HASH,
    ]);
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain(V4_SUBJECT_HASH);
    expect(encoded).not.toContain(V4_OBSERVATION_HASH);
  });

  it('deduplicates a V4 learning hash already present in runtime history', async () => {
    const response = await handleChiefFounderContentProposal(request({
      strategy: strategy({
        history: {
          ...strategy().history,
          learning_signal_hashes: [LEARNING_HASH, V4_LEARNING_HASH],
        },
      }),
      proposal: proposal(),
      v4_advisory_handoff: V4_HANDOFF,
    }));

    expect(response.status).toBe(200);
    const body = await payload(response);
    expect(body.data.strategy.history.learning_signal_hashes).toEqual([
      LEARNING_HASH,
      V4_LEARNING_HASH,
    ]);
  });

  it('rejects V4 authority laundering, tampering, and raw-payload smuggling on the worker path', async () => {
    const attempts = [
      { handoff: { ...V4_HANDOFF, evidenceLevel: 'VERIFIED_CURRENT' }, message: 'ATTESTED ceiling' },
      { handoff: { ...V4_HANDOFF, learningHash: 'd'.repeat(64) }, message: 'integrity failure' },
      { handoff: { ...V4_HANDOFF, raw_metrics: { impressions: 999 } }, message: 'non-advisory fields' },
    ];

    for (const attempt of attempts) {
      const response = await handleChiefFounderContentProposal(request({
        strategy: strategy(),
        proposal: proposal(),
        v4_advisory_handoff: attempt.handoff,
      }));
      expect(response.status).toBe(400);
      const body = await payload(response);
      expect(body.error.code).toBe('invalid_founder_content_request');
      expect(body.error.message).toContain(attempt.message);
    }
  });

  it('rejects a strategy/proposal pair that does not share one evaluation boundary', async () => {
    const response = await handleChiefFounderContentProposal(request({
      strategy: strategy({ evaluated_at: '2026-08-19T07:49:00.000Z' }),
      proposal: proposal(),
    }));

    expect(response.status).toBe(400);
    const body = await payload(response);
    expect(body.error.code).toBe('invalid_founder_content_request');
    expect(body.error.message).toContain('must share the same evaluated_at boundary');
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

  it('rejects stale required market context instead of presenting old feed context as current', async () => {
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
    expect(body.error.message).toContain('market_context is stale');
  });

  it('fails closed on malformed JSON and unsupported methods', async () => {
    const malformed = await handleChiefFounderContentProposal(new Request(
      'https://chief.example/api/chief/founder-content-proposal',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' },
    ));
    expect(malformed.status).toBe(400);
    expect((await payload(malformed)).error.code).toBe('invalid_json');

    const get = await handleChiefFounderContentProposal(rawRequest({}, 'GET'));
    expect(get.status).toBe(405);
    expect((await payload(get)).error.code).toBe('method_not_allowed');
  });
});
