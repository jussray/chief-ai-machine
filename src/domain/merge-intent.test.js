import { describe, expect, it } from 'vitest';
import { evaluateMergeIntent } from './merge-intent.js';

describe('merge intent gate', () => {
  it('blocks draft PRs targeting main', () => {
    const decision = evaluateMergeIntent({
      baseRef: 'main',
      title: 'feat: candidate',
      body: 'Work is still under review.',
      isDraft: true,
    });

    expect(decision).toMatchObject({
      applies: true,
      mergeIntentClear: false,
      reasons: ['draft'],
    });
  });

  it.each([
    ['DO NOT MERGE this PR', 'explicit-do-not-merge'],
    ['KEEP DRAFT until exact-head proof completes', 'keep-draft'],
    ['## DOWNSTREAM / STALE CANDIDATE', 'stale-candidate'],
    ['## STALE / PROVIDER-BLOCKED CANDIDATE', 'stale-candidate'],
    ['[SUPERSEDED] old candidate', 'superseded'],
    ['This PR is superseded pending rebuild.', 'superseded'],
    ['## VERIFICATION ONLY', 'verification-only'],
    ['MERGE BLOCKED until provider proof', 'merge-blocked'],
  ])('blocks explicit negative merge directive %s', (body, reason) => {
    const decision = evaluateMergeIntent({
      baseRef: 'main',
      title: 'feat: candidate',
      body,
      isDraft: false,
    });

    expect(decision.mergeIntentClear).toBe(false);
    expect(decision.reasons).toContain(reason);
  });

  it('blocks keep-draft intent even after provider metadata is flipped ready', () => {
    const decision = evaluateMergeIntent({
      baseRef: 'main',
      title: 'test(governance): provider preflight',
      body: 'KEEP DRAFT. Passing source checks do not authorize merge.',
      isDraft: false,
    });

    expect(decision).toMatchObject({
      applies: true,
      mergeIntentClear: false,
    });
    expect(decision.reasons).toContain('keep-draft');
  });

  it('blocks the exact stale wording that was present on merged PR #113', () => {
    const decision = evaluateMergeIntent({
      baseRef: 'main',
      title: 'feat(v10): connect Chief to FCR credential-free connection handoff',
      body: '## DOWNSTREAM / STALE CANDIDATE\n\n**DO NOT MERGE this PR.**',
      isDraft: false,
    });

    expect(decision.mergeIntentClear).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining([
      'explicit-do-not-merge',
      'stale-candidate',
    ]));
  });

  it('does not let historical explanation text silently become merge authority', () => {
    const decision = evaluateMergeIntent({
      baseRef: 'main',
      title: 'fix(governance): prevent stale merge incidents',
      body: [
        'This fixes the incident where a stale candidate was merged even though its body said `DO NOT MERGE`.',
        '',
        '- Historical marker: `KEEP DRAFT`',
        '> DO NOT MERGE was the old quoted state.',
        '',
        '```text',
        'MERGE BLOCKED',
        '[SUPERSEDED]',
        '```',
        '',
        'Exact-head proof and review are handled by independent gates.',
      ].join('\n'),
      isDraft: false,
    });

    expect(decision).toMatchObject({
      applies: true,
      mergeIntentClear: true,
      reasons: [],
    });
  });

  it('still blocks a real directive next to historical examples', () => {
    const decision = evaluateMergeIntent({
      baseRef: 'main',
      title: 'fix(governance): candidate',
      body: [
        'Historical example: `DO NOT MERGE` was previously ignored.',
        '',
        '## CURRENT GATE',
        'MERGE BLOCKED until independent review lands.',
      ].join('\n'),
      isDraft: false,
    });

    expect(decision.mergeIntentClear).toBe(false);
    expect(decision.reasons).toContain('merge-blocked');
  });

  it('does not let a clean marker check impersonate merge approval', () => {
    const decision = evaluateMergeIntent({
      baseRef: 'main',
      title: 'feat: current candidate',
      body: 'Exact-head proof and review are handled by independent gates.',
      isDraft: false,
    });

    expect(decision).toMatchObject({
      applies: true,
      mergeIntentClear: true,
    });
    expect(decision.nextGate).toContain('all independent source, review, proof, and provider gates still apply');
  });

  it('fails closed when machine current truth names a predecessor head', () => {
    const currentHead = '8e3d606d837caaa4bd295cfd2643d9c84635cffd';
    const staleHead = '34d01ab1bb365839289a3f83f507d5af99781eda';
    const decision = evaluateMergeIntent({
      baseRef: 'main',
      title: 'fix(proofmode): harden exact-head evidence and MCP proof',
      body: [
        '<!-- chief-current-truth:start -->',
        '## CURRENT TRUTH',
        `- live_head: \`fix/proofmode-main-audit-20260828@${staleHead}\``,
        '- merge_intent: **BLOCKED / explicit-do-not-merge / INTENTIONAL**',
        '<!-- chief-current-truth:end -->',
        '',
        '**DO NOT MERGE YET.**',
      ].join('\n'),
      isDraft: false,
      headSha: currentHead,
    });

    expect(decision).toMatchObject({
      applies: true,
      mergeIntentClear: false,
      reasons: ['current_truth_stale'],
    });
    expect(decision.reasons).not.toContain('explicit-do-not-merge');
    expect(decision.nextGate).toContain('exact current PR head');
  });

  it('fails closed on malformed machine current truth without inheriting body directives', () => {
    const decision = evaluateMergeIntent({
      baseRef: 'main',
      title: 'fix(governance): current receipt validation',
      body: [
        '<!-- chief-current-truth:start -->',
        '## CURRENT TRUTH',
        '- live_head: `fix/proofmode-main-audit-20260828@not-a-sha`',
        '**DO NOT MERGE YET.**',
        '<!-- chief-current-truth:end -->',
      ].join('\n'),
      isDraft: false,
      headSha: '8e3d606d837caaa4bd295cfd2643d9c84635cffd',
    });

    expect(decision).toMatchObject({
      applies: true,
      mergeIntentClear: false,
      reasons: ['current_truth_invalid'],
    });
    expect(decision.reasons).not.toContain('explicit-do-not-merge');
  });

  it('evaluates directives normally when machine current truth matches the authoritative head', () => {
    const headSha = '34d01ab1bb365839289a3f83f507d5af99781eda';
    const decision = evaluateMergeIntent({
      baseRef: 'main',
      title: 'fix(proofmode): harden exact-head evidence and MCP proof',
      body: [
        '<!-- chief-current-truth:start -->',
        '## CURRENT TRUTH',
        `- live_head: \`fix/proofmode-main-audit-20260828@${headSha}\``,
        '**DO NOT MERGE YET.**',
        '<!-- chief-current-truth:end -->',
      ].join('\n'),
      isDraft: false,
      headSha,
    });

    expect(decision.mergeIntentClear).toBe(false);
    expect(decision.reasons).toContain('explicit-do-not-merge');
    expect(decision.reasons).not.toContain('current_truth_stale');
  });

  it('preserves legacy body evaluation when no machine current truth block exists', () => {
    const decision = evaluateMergeIntent({
      baseRef: 'main',
      title: 'feat: current candidate',
      body: 'MERGE BLOCKED until independent review lands.',
      isDraft: false,
      headSha: '8e3d606d837caaa4bd295cfd2643d9c84635cffd',
    });

    expect(decision.mergeIntentClear).toBe(false);
    expect(decision.reasons).toContain('merge-blocked');
  });

  it('does not block working-branch integration', () => {
    const decision = evaluateMergeIntent({
      baseRef: 'feat/current-main-working-branch',
      title: 'chore(reacquire): internal integration',
      body: 'VERIFICATION ONLY language may exist here without claiming main merge readiness.',
      isDraft: false,
    });

    expect(decision).toMatchObject({
      applies: false,
      mergeIntentClear: true,
      reasons: [],
    });
  });
});
