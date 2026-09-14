import { describe, expect, it } from 'vitest';
import {
  CURRENT_TRUTH_END,
  CURRENT_TRUTH_START,
  evaluatePrCurrentTruth,
  PR_CURRENT_TRUTH_CONTRACT,
} from './pr-current-truth.mjs';

const repository = 'jussray/chief-ai-machine';
const prNumber = 143;
const headRef = 'fix/proofmode-main-audit-20260828';
const headSha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function bodyFor({
  declaredRepository = repository,
  declaredPr = prNumber,
  declaredRef = headRef,
  declaredSha = headSha,
  suffix = '',
} = {}) {
  return `${CURRENT_TRUTH_START}
## CURRENT TRUTH
- repository: \`${declaredRepository}\`
- pull_request: \`#${declaredPr}\`
- live_head: \`${declaredRef}@${declaredSha}\`
${CURRENT_TRUTH_END}
${suffix}`;
}

describe(PR_CURRENT_TRUTH_CONTRACT, () => {
  it('treats GitHub metadata plus exact-head ledger as authority even when body matches', () => {
    const receipt = evaluatePrCurrentTruth({ body: bodyFor(), repository, prNumber, headRef, headSha });
    expect(receipt.classification).toBe('CURRENT');
    expect(receipt.prBodyAuthoritative).toBe(false);
    expect(receipt.machineCurrentTruthAuthority).toBe('github-pr-metadata+exact-head-ledger');
    expect(receipt.mergeAuthority).toBe(false);
  });

  it('classifies a predecessor SHA in the current block as STALE', () => {
    const receipt = evaluatePrCurrentTruth({
      body: bodyFor({ declaredSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }),
      repository,
      prNumber,
      headRef,
      headSha,
    });
    expect(receipt.classification).toBe('STALE');
    expect(receipt.reasons).toContain('head_sha_moved');
    expect(receipt.reacquireRequired).toBe(true);
  });

  it('classifies a different head branch in the current block as STALE', () => {
    const receipt = evaluatePrCurrentTruth({
      body: bodyFor({ declaredRef: 'some-other-branch' }),
      repository,
      prNumber,
      headRef,
      headSha,
    });
    expect(receipt.classification).toBe('STALE');
    expect(receipt.reasons).toContain('head_ref_moved');
  });

  it('rejects malformed or duplicated current-truth markers', () => {
    const duplicate = `${bodyFor()}\n${bodyFor()}`;
    const receipt = evaluatePrCurrentTruth({ body: duplicate, repository, prNumber, headRef, headSha });
    expect(receipt.classification).toBe('INVALID');
    expect(receipt.reasons).toContain('current_truth_markers_must_be_unique');
  });

  it('does not let historical SHA prose outside the block make a current receipt stale', () => {
    const receipt = evaluatePrCurrentTruth({
      body: bodyFor({ suffix: 'Historical predecessor: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }),
      repository,
      prNumber,
      headRef,
      headSha,
    });
    expect(receipt.classification).toBe('CURRENT');
    expect(receipt.historicalTruthPreserved).toBe(true);
  });

  it('allows a PR with no current-truth claim without manufacturing authority', () => {
    const receipt = evaluatePrCurrentTruth({ body: 'ordinary PR body', repository, prNumber, headRef, headSha });
    expect(receipt.classification).toBe('ABSENT');
    expect(receipt.prBodyAuthoritative).toBe(false);
    expect(receipt.mergeAuthority).toBe(false);
  });
});
