import { describe, expect, it } from 'vitest';
import {
  AUTHORITY_MARKER,
  BRIDGE_WORKFLOW_PATH,
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
  ACTIVATION_RUN_ID: '',
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
const activation = {
  id: 777,
  path: BRIDGE_WORKFLOW_PATH,
  event: 'pull_request',
  status: 'in_progress',
  run_attempt: 1,
  actor: { login: 'jussray' },
  triggering_actor: { login: 'jussray' },
  repository: { full_name: 'jussray/chief-ai-machine' },
  head_repository: { full_name: 'jussray/chief-ai-machine' },
  head_sha: sha,
  pull_requests: [{ number: 145, head: { sha } }],
};

describe('production authority receipt', () => {
  it('accepts an unconsumed owner-authored receipt on the exact open PR head', () => {
    expect(
      assertAuthoritySnapshot({ pr, review, comments: [], env: baseEnv }),
    ).toMatchObject({
      expectedSha: sha,
      authorityPr: '145',
      authorityReceipt: '5129412189',
      authenticatedBy: 'direct-founder',
    });
  });

  it('accepts a bot-dispatched child only when exact founder bridge activation is proven', () => {
    expect(
      assertAuthoritySnapshot({
        pr,
        review,
        comments: [],
        activation,
        env: {
          ...baseEnv,
          GITHUB_ACTOR: 'github-actions[bot]',
          TRIGGERING_ACTOR: 'github-actions[bot]',
          ACTIVATION_RUN_ID: '777',
        },
      }),
    ).toMatchObject({ authenticatedBy: 'founder-bridge' });
  });

  it('rejects bot execution without a founder activation witness', () => {
    expect(() =>
      assertAuthoritySnapshot({
        pr,
        review,
        comments: [],
        env: {
          ...baseEnv,
          GITHUB_ACTOR: 'github-actions[bot]',
          TRIGGERING_ACTOR: 'github-actions[bot]',
        },
      }),
    ).toThrow('Execution is not authenticated by founder actor or founder bridge activation');
  });

  it('rejects an activation from the wrong workflow, actor, PR, or SHA', () => {
    const bridgeEnv = {
      ...baseEnv,
      GITHUB_ACTOR: 'github-actions[bot]',
      TRIGGERING_ACTOR: 'github-actions[bot]',
      ACTIVATION_RUN_ID: '777',
    };
    expect(() => assertAuthoritySnapshot({
      pr, review, comments: [], env: bridgeEnv,
      activation: { ...activation, path: '.github/workflows/other.yml' },
    })).toThrow('Activation workflow mismatch');
    expect(() => assertAuthoritySnapshot({
      pr, review, comments: [], env: bridgeEnv,
      activation: { ...activation, actor: { login: 'someone-else' } },
    })).toThrow('Activation actor is not founder');
    expect(() => assertAuthoritySnapshot({
      pr, review, comments: [], env: bridgeEnv,
      activation: { ...activation, pull_requests: [{ number: 146, head: { sha } }] },
    })).toThrow('Activation PR/head binding mismatch');
    expect(() => assertAuthoritySnapshot({
      pr, review, comments: [], env: bridgeEnv,
      activation: { ...activation, head_sha: 'b'.repeat(40) },
    })).toThrow('Activation exact head mismatch');
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
