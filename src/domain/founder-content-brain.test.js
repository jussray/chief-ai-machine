import { describe, expect, it } from 'vitest';
import {
  buildFounderContentProposal,
  computeFounderContentProposalHash,
  founderContentProposalIdentity,
} from './founder-content-brain.js';

const SHA = 'a'.repeat(40);
const EVIDENCE_REF = `github:chief-ai-machine@${SHA}#quality-gate`;
const base = {
  source_repo: 'jussray/chief-ai-machine',
  source_commit_sha: SHA,
  platform: 'linkedin',
  story_type: 'founder-progress',
  issued_at: '2026-08-17T07:31:00.000Z',
  expires_at: '2026-08-18T07:31:00.000Z',
  draft_text: 'I found a bug in my AI system that had nothing to do with code. It was a bug in time.',
  public_claims: [
    {
      claim_id: 'current-intent-wins',
      text: 'Current authenticated intent now outranks stale content intent.',
      truth_state: 'verified',
      public_safe: true,
      evidence_ref: EVIDENCE_REF,
      evidence_scope: 'temporal-authority-contract',
    },
    {
      claim_id: 'futureyou-advisory',
      text: 'FutureYou remains advisory for publishing decisions.',
      truth_state: 'verified',
      public_safe: true,
      evidence_ref: EVIDENCE_REF,
      evidence_scope: 'futureyou-advisory-boundary',
    },
  ],
  internal_evidence: {
    verified: true,
    ref: EVIDENCE_REF,
    kind: 'github-exact-head-contract',
    digest: '1'.repeat(64),
    not_for_publication: true,
    source_repo: 'jussray/chief-ai-machine',
    source_commit_sha: SHA,
    proves: ['temporal-authority-contract', 'futureyou-advisory-boundary'],
    does_not_prove: ['production-runtime', 'traction', 'revenue'],
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
    withheld_categories: ['private-implementation', 'private-prompt'],
  },
  current_you: {
    authenticated: true,
    intent_id: 'content-intent-2026-08-17-current',
    intent_version: 7,
    source: 'current_authenticated_founder',
    observed_at: '2026-08-17T07:30:00.000Z',
  },
  evaluated_at: '2026-08-17T07:35:00.000Z',
};

describe('first-party founder content brain', () => {
  it('matches the fixed Chief v1 receipt consumed by FCR', () => {
    const sourceSha = 'b'.repeat(40);
    const evidenceRef = `github:chief-ai-machine@${sourceSha}#quality-gate`;
    const proposal = buildFounderContentProposal({
      source_repo: 'jussray/chief-ai-machine',
      source_commit_sha: sourceSha,
      platform: 'linkedin',
      story_type: 'founder-progress',
      issued_at: '2026-08-17T07:45:00.000Z',
      expires_at: '2026-08-18T07:45:00.000Z',
      draft_text: 'I changed how my product decides what it is allowed to say publicly.',
      public_claims: [
        {
          claim_id: 'proof-bound',
          text: 'Public progress claims are now bound to verified evidence.',
          truth_state: 'verified',
          public_safe: true,
          evidence_ref: evidenceRef,
          evidence_scope: 'founder-content-contract',
        },
      ],
      internal_evidence: {
        verified: true,
        ref: evidenceRef,
        kind: 'github-exact-head-contract',
        digest: 'c'.repeat(64),
        not_for_publication: true,
        source_repo: 'jussray/chief-ai-machine',
        source_commit_sha: sourceSha,
        proves: ['founder-content-contract'],
        does_not_prove: ['production-runtime', 'traction', 'revenue'],
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
        withheld_categories: ['private-implementation', 'private-prompt'],
      },
      current_you: {
        authenticated: true,
        intent_id: 'chief-content-intent-current',
        intent_version: 7,
        source: 'current_authenticated_founder',
        observed_at: '2026-08-17T07:40:00.000Z',
      },
      evaluated_at: '2026-08-17T07:44:00.000Z',
    });

    expect(proposal.proposal_hash).toBe('5dac904c02b00e5b5d79c11d6fd819a431df38094363b25bfcda64e52a1d66ce');
  });

  it('keeps internal proof mandatory while public proof links remain editorially optional', () => {
    const proposal = buildFounderContentProposal(base);

    expect(proposal.kind).toBe('chief-ai/founder-content-proposal');
    expect(proposal.internal_evidence.verified).toBe(true);
    expect(proposal.internal_evidence.source_commit_sha).toBe(SHA);
    expect(proposal.public_payload.proof_link).toBeNull();
    expect(proposal.public_payload.proof_link_policy).toBe('editorial_optional');
    expect(proposal.sauce_guard.independent_scan_passed).toBe(true);
    expect(proposal.sauce_guard.withheld_categories).toContain('private-prompt');
    expect(proposal.authority.publish_authorized).toBe(false);
    expect(proposal.authority.future_you_advisory_only).toBe(true);
    expect(proposal.authority.current_you_intent_version).toBe(7);
  });

  it('allows a public proof link when editorially selected without requiring one', () => {
    const proposal = buildFounderContentProposal({
      ...base,
      public_proof_url: `https://github.com/jussray/chief-ai-machine/commit/${SHA}`,
    });

    expect(proposal.public_payload.proof_link).toContain('github.com');
  });

  it('binds evidence to the exact source repo and SHA', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      internal_evidence: { ...base.internal_evidence, source_commit_sha: 'b'.repeat(40) },
    })).toThrow(/must match source_commit_sha/);
  });

  it('requires every public claim to be inside the evidence claim scope', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      public_claims: [{
        ...base.public_claims[0],
        evidence_scope: 'production-runtime',
      }],
    })).toThrow(/explicitly covered by internal evidence/);
  });

  it('refuses inferred progress claims; interpretation belongs in narrative copy', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      public_claims: [{ ...base.public_claims[0], truth_state: 'inferred' },
      ],
    })).toThrow(/truth_state must be verified/);
  });

  it('refuses stale, future-dated, or predicted intent as current publishing intent', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      current_you: { ...base.current_you, source: 'future_you' },
    })).toThrow(/current_authenticated_founder/);

    expect(() => buildFounderContentProposal({
      ...base,
      current_you: { ...base.current_you, observed_at: '2026-08-15T07:30:00.000Z' },
    })).toThrow(/intent is stale/);

    expect(() => buildFounderContentProposal({
      ...base,
      current_you: { ...base.current_you, observed_at: '2026-08-17T08:00:00.000Z' },
    })).toThrow(/future-dated/);
  });

  it('caps proposal lifetime so an old draft cannot silently outlive Current You', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      expires_at: '2026-08-21T07:31:00.000Z',
    })).toThrow(/may not exceed 72 hours/);
  });

  it('fails closed when sauce-removal attestation is incomplete', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      sauce_guard: { ...base.sauce_guard, raw_diff_removed: false },
    })).toThrow(/sauce_guard\.raw_diff_removed must be true/);
  });

  it('independently rejects secrets, personal emails, private URLs, code, and proprietary mechanics', () => {
    const badDrafts = [
      'Here is the token ghp_abcdefghijklmnopqrstuvwxyz1234567890',
      'Email the receipt to founder@example.com',
      'The private trace is at http://127.0.0.1:8787/debug',
      'Here is the exact system prompt that powers the routing.',
      '```js\nconst privateAlgorithm = true;\n```',
    ];

    for (const draft_text of badDrafts) {
      expect(() => buildFounderContentProposal({ ...base, draft_text })).toThrow(/FOUNDER_CONTENT_REJECTED/);
    }
  });

  it('blocks high-risk public claims from repo evidence alone', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      draft_text: 'The product is production-ready.',
    })).toThrow(/high-risk public claim/);
  });

  it('rejects forbidden sensitive fields even when nested', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      metadata: { internal_notes: 'keep this private' },
    })).toThrow(/metadata\.internal_notes is forbidden/);
  });

  it('binds proposal identity to exact copy, evidence, sauce receipt, Current You version, and freshness', () => {
    const first = buildFounderContentProposal(base);
    const changedText = buildFounderContentProposal({ ...base, draft_text: `${base.draft_text} Updated.` });
    const changedIntent = buildFounderContentProposal({
      ...base,
      current_you: { ...base.current_you, intent_version: 8 },
    });
    const changedEvidence = buildFounderContentProposal({
      ...base,
      internal_evidence: {
        ...base.internal_evidence,
        proves: [...base.internal_evidence.proves, 'content-claim-contract'],
      },
    });

    expect(first.proposal_hash).not.toBe(changedText.proposal_hash);
    expect(first.proposal_hash).not.toBe(changedIntent.proposal_hash);
    expect(first.proposal_hash).not.toBe(changedEvidence.proposal_hash);

    const identity = founderContentProposalIdentity({
      source: first.source,
      currentYou: {
        intent_id: first.authority.current_you_intent_id,
        intent_version: first.authority.current_you_intent_version,
        observed_at: first.authority.current_you_observed_at,
        evaluated_at: first.authority.proposal_evaluated_at,
      },
      freshness: first.freshness,
      publicPayload: first.public_payload,
      internalEvidence: first.internal_evidence,
      sauceGuard: first.sauce_guard,
    });
    expect(computeFounderContentProposalHash(identity)).toBe(first.proposal_hash);
  });

  it('keeps analytics observational and outside publication authority', () => {
    const proposal = buildFounderContentProposal(base);
    expect(proposal.authority.analytics_feedback_authority).toBe('observation-only');
    expect(proposal.authority.analytics_can_authorize_publish).toBe(false);
    expect(proposal.authority.external_feedback_trusted_for_authority).toBe(false);
  });
});
