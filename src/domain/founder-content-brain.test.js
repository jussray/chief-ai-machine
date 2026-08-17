import { describe, expect, it } from 'vitest';
import { buildFounderContentProposal } from './founder-content-brain.js';

const base = {
  source_repo: 'jussray/chief-ai-machine',
  source_commit_sha: 'a'.repeat(40),
  platform: 'linkedin',
  story_type: 'founder-progress',
  draft_text: 'I found a bug in my AI system that had nothing to do with code. It was a bug in time.',
  public_claims: [
    { text: 'Current authenticated intent now outranks stale content intent.', truth_state: 'verified', public_safe: true },
    { text: 'FutureYou remains advisory for publishing decisions.', truth_state: 'verified', public_safe: true },
  ],
  internal_evidence: {
    verified: true,
    ref: 'github:chief-ai-machine@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#quality-gate',
    public_safe_source: true,
  },
  sauce_guard: {
    private_implementation_removed: true,
    secret_material_removed: true,
    raw_diff_removed: true,
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
  it('keeps internal proof mandatory while public proof links remain editorially optional', () => {
    const proposal = buildFounderContentProposal(base);

    expect(proposal.kind).toBe('chief-ai/founder-content-proposal');
    expect(proposal.internal_evidence.verified).toBe(true);
    expect(proposal.internal_evidence.ref).toContain('quality-gate');
    expect(proposal.public_payload.proof_link).toBeNull();
    expect(proposal.public_payload.proof_link_policy).toBe('editorial_optional');
    expect(proposal.authority.publish_authorized).toBe(false);
    expect(proposal.authority.future_you_advisory_only).toBe(true);
  });

  it('allows a public proof link when editorially selected without requiring one', () => {
    const proposal = buildFounderContentProposal({
      ...base,
      public_proof_url: 'https://github.com/jussray/chief-ai-machine/commit/' + 'a'.repeat(40),
    });

    expect(proposal.public_payload.proof_link).toContain('github.com');
  });

  it('fails closed when internal evidence is not verified', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      internal_evidence: { ...base.internal_evidence, verified: false },
    })).toThrow(/internal_evidence\.verified must be true/);
  });

  it('refuses stale or predicted intent as current publishing intent', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      current_you: { ...base.current_you, source: 'future_you' },
    })).toThrow(/current_authenticated_founder/);
  });

  it('fails closed when sauce-removal proof is incomplete', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      sauce_guard: { ...base.sauce_guard, raw_diff_removed: false },
    })).toThrow(/sauce_guard\.raw_diff_removed must be true/);
  });

  it('refuses secret-like material in public copy', () => {
    expect(() => buildFounderContentProposal({
      ...base,
      draft_text: 'Here is the token ghp_abcdefghijklmnopqrstuvwxyz1234567890',
    })).toThrow(/secret-like material/);
  });

  it('binds proposal identity to the exact public copy', () => {
    const first = buildFounderContentProposal(base);
    const second = buildFounderContentProposal({ ...base, draft_text: base.draft_text + ' Updated.' });

    expect(first.proposal_hash).not.toBe(second.proposal_hash);
  });
});
