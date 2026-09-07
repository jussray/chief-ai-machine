import { describe, expect, it } from 'vitest';
import {
  AUTHORITY_MARKER,
  assertAuthoritySnapshot,
  consumptionMarker,
} from '../scripts/proofmode-production-authority.mjs';

const sha = 'a'.repeat(40);
const baseEnv = {
  EXPECTED_HEAD_SHA: sha,
  REPOSITORY_OWNER: 'jussray',
  GITHUB_ACTOR: 'jussray',
  TRIGGERING_ACTOR: 'jussray',
  GITHUB_RUN_ATTEMPT: '1',
  AUTHORIZE_PRODUCTION: 'true',
  AUTHORITY_PR: '145',
  AUTHORITY_RECEIPT: '5129412189',
  GITHUB_REPOSITORY: 'jussray/chief-ai-machine',
};
const pr = {
  number: 145,
  state: 'open',
  user: { login: 'jussray' },
  head: {
    sha,
    repo: { full_name: 'jussray/chief-ai-machine' },
  },
};
const review = {
  id: 5129412189,
  user: { login: 'jussray' },
  author_association: 'OWNER',
  commit_id: sha,
  body: [
    `Founder production-proof authority granted for exact head \`${sha}\`.`,
    AUTHORITY_MARKER,
  ].join('\n'),
};

describe('production authority receipt', () => {
  it('accepts an unconsumed owner-authored receipt on the exact open PR head', () => {
    expect(
      assertAuthoritySnapshot({ pr, review, comments: [], env: baseEnv }),
    ).toMatchObject({
      expectedSha: sha,
      authorityPr: '145',
      authorityReceipt: '5129412189',
    });
  });

  it('rejects head movement', () => {
    expect(() =>
      assertAuthoritySnapshot({
        pr: { ...pr, head: { ...pr.head, sha: 'b'.repeat(40) } },
        review,
        comments: [],
        env: baseEnv,
      }),
    ).toThrow('Authority PR head moved');
  });

  it('rejects a stale review receipt', () => {
    expect(() =>
      assertAuthoritySnapshot({
        pr,
        review: { ...review, commit_id: 'b'.repeat(40) },
        comments: [],
        env: baseEnv,
      }),
    ).toThrow('Authority receipt is stale');
  });

  it('rejects a non-owner actor or triggering actor', () => {
    expect(() =>
      assertAuthoritySnapshot({
        pr,
        review,
        comments: [],
        env: { ...baseEnv, GITHUB_ACTOR: 'someone-else' },
      }),
    ).toThrow('Workflow actor is not the repository owner');

    expect(() =>
      assertAuthoritySnapshot({
        pr,
        review,
        comments: [],
        env: { ...baseEnv, TRIGGERING_ACTOR: 'someone-else' },
      }),
    ).toThrow('Triggering actor is not the repository owner');
  });

  it('rejects workflow reruns', () => {
    expect(() =>
      assertAuthoritySnapshot({
        pr,
        review,
        comments: [],
        env: { ...baseEnv, GITHUB_RUN_ATTEMPT: '2' },
      }),
    ).toThrow('Workflow reruns cannot reuse production authority');
  });

  it('rejects a second new dispatch after durable consumption', () => {
    const marker = consumptionMarker(baseEnv.AUTHORITY_RECEIPT, sha);
    expect(() =>
      assertAuthoritySnapshot({
        pr,
        review,
        comments: [{ body: marker }],
        env: baseEnv,
      }),
    ).toThrow('Authority receipt has already been consumed');
  });

  it('rejects a receipt that lacks the exact one-shot authority marker', () => {
    expect(() =>
      assertAuthoritySnapshot({
        pr,
        review: { ...review, body: `Founder production-proof authority granted for exact head \`${sha}\`.` },
        comments: [],
        env: baseEnv,
      }),
    ).toThrow('Authority receipt lacks the one-shot marker');
  });
});
