import { describe, expect, it } from 'vitest';
import { buildFounderContentProposal } from './founder-content-brain.js';

const base = {
  source_repo: 'jussray/chief-ai-machine',
  source_commit_sha: 'a'.repeat(40),
  platform: 'linkedin',
  story_type: 'founder-progress',
  issued_at: '2026-08-17T07:45:00.000Z',
  expires_at: '2026-08-18T07:45:00.000Z',
  draft_text: 'I found a bug in my AI system that had nothing to do with code. It was a bug in time.',
  public_claims: [
    {
      claim_id: 'current-intent-wins',
      text: 'Current authenticated intent now outranks stale content intent.',
      truth_state: 'verified',
      public_safe: true,
      evidence_refs: ['proof:current-intent-contract'],
    },
    {
      claim_id: 'futureyou-advisory',
      text: 'FutureYou remains advisory for publishing decisions.',
      truth_state: 'verified',
      public_safe: true,
      evidence_refs: ['proof:futureyou-authority-contract'],
    },
  ],
  internal_evidence: {
    verified: true,
    ref: 'github:chief-ai-machine@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#quality-gate',
    digest: '1'.repeat(64),
    not_for_publication: true,
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
  },
  current_you: {
    authenticated: true,
    intent_id: 'content-intent-2026-08-17-current',
    source: 'current_authenticated_founder',
    supersedes_stale_content_intent: true,
  },
};

describe('first-party founder content brain', () => {
  it('keeps internal proof private while public proof links remain editorially optional', () => {
    const proposal = buildFounderContentProposal(base);

    expect(proposal.kind).toBe('chief-ai/founder-content-proposal');
    expect(proposal.internal_evidence).toMatchObject({
      verified: true,
      not_for_publication: true,
      digest: '1'.repeat(64),
    });
    expect(proposal.internal_evidence.ref).toContain('quality-gate');
    expect(proposal.public_payload.proof_link).toBeNull();
    expect(proposal.public_payload.proof_link_policy).toBe('editorial_optional');
    expect(JSON.stringify(proposal.public_payload)).not.toContain('quality-gate');
    expect(JSON.stringify(proposal.public_payload)).not.toContain('proof:current-intent-contract');
  });

  it('allows a public proof link when editorially selected without requiring one', () => {
    const proposal = buildFounderContentProposal({
      ...base,
      public_proof_url: 'https://github.com/jussray/chief-ai-machine/commit/' + 'a'.repeat(40),
    });

    expect(proposal.public_payload.proof_link).toContain('github.com');
  });

  it('requires every public product-progress claim to be verified and internally evidence-bound', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      public_claims: [{
        claim_id: 'guess',
        text: 'This probably improves conversion.',
        truth_state: 'inferred',
        public_safe: true,
        evidence_refs: ['analytics:unverified'],
      }],
    })).toThrow(/truth_state must be verified/);

    expect(() => buildFounderContentProposal({
      ...base,
      public_claims: [{
        claim_id: 'no-proof',
        text: 'The feature shipped.',
        truth_state: 'verified',
        public_safe: true,
        evidence_refs: [],
      }],
    })).toThrow(/evidence_refs/);
  });

  it('fails closed when internal evidence is unverified or publishable', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      internal_evidence: { ...base.internal_evidence, verified: false },
    })).toThrow(/internal_evidence\.verified must be true/);

    expect(() => buildFounderContentProposal({
      ...base,
      internal_evidence: { ...base.internal_evidence, not_for_publication: false },
    })).toThrow(/not_for_publication must be true/);
  });

  it('refuses stale or predicted intent as current publishing intent', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      current_you: { ...base.current_you, source: 'future_you' },
    })).toThrow(/current_authenticated_founder/);
  });

  it('caps proposal freshness so old Current You cannot silently become Future You authority', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      expires_at: '2026-08-21T07:45:00.000Z',
    })).toThrow(/may not exceed 72 hours/);
  });

  it('fails closed when any sauce-removal boundary is incomplete', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      sauce_guard: { ...base.sauce_guard, unreleased_roadmap_removed: false },
    })).toThrow(/sauce_guard\.unreleased_roadmap_removed must be true/);

    expect(() => buildFounderContentProposal({
      ...base,
      sauce_guard: { ...base.sauce_guard, customer_private_data_removed: false },
    })).toThrow(/sauce_guard\.customer_private_data_removed must be true/);
  });

  it('refuses secret-like material in public copy', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      draft_text: 'Here is the token ghp_abcdefghijklmnopqrstuvwxyz1234567890',
    })).toThrow(/secret-like material/);
  });

  it('binds proposal identity to public copy, proof identity, and freshness', () => {
    const first = buildFounderContentProposal(base);
    const copyChanged = buildFounderContentProposal({ ...base, draft_text: base.draft_text + ' Updated.' });
    const proofChanged = buildFounderContentProposal({
      ...base,
      internal_evidence: { ...base.internal_evidence, digest: '2'.repeat(64) },
    });
    const freshnessChanged = buildFounderContentProposal({
      ...base,
      expires_at: '2026-08-18T08:45:00.000Z',
    });

    expect(copyChanged.proposal_hash).not.toBe(first.proposal_hash);
    expect(proofChanged.proposal_hash).not.toBe(first.proposal_hash);
    expect(freshnessChanged.proposal_hash).not.toBe(first.proposal_hash);
  });

  it('keeps analytics observational and outside publication authority', () => {
    const proposal = buildFounderContentProposal(base);

    expect(proposal.authority).toMatchObject({
      proposal_only: true,
      publish_authorized: false,
      future_you_advisory_only: true,
      historical_content_intent_authoritative: false,
      analytics_feedback_authority: 'observation-only',
      analytics_can_authorize_publish: false,
      external_feedback_trusted_for_authority: false,
    });
  });
});
