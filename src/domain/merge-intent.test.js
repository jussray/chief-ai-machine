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

  it('blocks numbered keep-draft status directives after provider metadata is flipped ready', () => {
    const decision = evaluateMergeIntent({
      baseRef: 'main',
      title: 'feat(chief): fingerprint authority handoff to FCR',
      body: [
        '## NEXT GATE',
        '',
        '1. Obtain fresh independent semantic/security review.',
        '4. Keep DRAFT until current review/authority gates are satisfied.',
      ].join('\n'),
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
