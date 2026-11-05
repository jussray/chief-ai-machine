import process from 'node:process';

export const AUTHORITY_MARKER =
  'PRODUCTION_ACTION_AUTHORIZED / EXACT_HEAD_BOUND / ONE_SHOT / MERGE_HOLD.';
export const CONSUMPTION_PREFIX = 'proofmode-production-authority-consumed:v1';
export const BRIDGE_WORKFLOW_PATH = '.github/workflows/proofmode-production-authority-bridge.yml';

function requireValue(env, name) {
  const value = String(env[name] ?? '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function optionalValue(env, name) {
  return String(env[name] ?? '').trim();
}

function requirePositiveInteger(value, label) {
  if (!/^[1-9]\d*$/.test(String(value))) {
    throw new Error(`${label} must be a positive integer`);
  }
  return String(value);
}

export function consumptionMarker(receipt, sha) {
  return `<!-- ${CONSUMPTION_PREFIX} receipt=${receipt} sha=${sha} -->`;
}

export function assertBridgeActivation({ activation, env, authorityPr, expectedSha }) {
  const activationRunId = requirePositiveInteger(
    requireValue(env, 'ACTIVATION_RUN_ID'),
    'ACTIVATION_RUN_ID',
  );
  const repositoryOwner = requireValue(env, 'REPOSITORY_OWNER');
  const repository = requireValue(env, 'GITHUB_REPOSITORY');

  if (!activation || String(activation.id) !== activationRunId) {
    throw new Error('Activation run mismatch');
  }
  if (activation.path !== BRIDGE_WORKFLOW_PATH) throw new Error('Activation workflow mismatch');
  if (activation.event !== 'pull_request') throw new Error('Activation event is not a pull request');
  if (!['in_progress', 'completed'].includes(activation.status)) {
    throw new Error('Activation run is not active or completed');
  }
  if (String(activation.run_attempt) !== '1') throw new Error('Activation reruns cannot mint authority');
  if (activation.actor?.login !== repositoryOwner) throw new Error('Activation actor is not founder');
  if (activation.triggering_actor?.login !== repositoryOwner) {
    throw new Error('Activation triggering actor is not founder');
  }
  if (activation.repository?.full_name !== repository) throw new Error('Activation repository mismatch');
  if (activation.head_repository?.full_name !== repository) {
    throw new Error('Activation head repository mismatch');
  }
  if (activation.head_sha !== expectedSha) throw new Error('Activation exact head mismatch');
  const prMatch = (activation.pull_requests || []).some((item) =>
    String(item.number) === String(authorityPr)
    && item.head?.sha === expectedSha
  );
  if (!prMatch) throw new Error('Activation PR/head binding mismatch');
  return true;
}

export function assertAuthoritySnapshot({ pr, review, comments = [], activation = null, env }) {
  const expectedSha = requireValue(env, 'EXPECTED_HEAD_SHA');
  const repositoryOwner = requireValue(env, 'REPOSITORY_OWNER');
  const actor = requireValue(env, 'GITHUB_ACTOR');
  const triggeringActor = requireValue(env, 'TRIGGERING_ACTOR');
  const runAttempt = requireValue(env, 'GITHUB_RUN_ATTEMPT');
  const authorizeProduction = requireValue(env, 'AUTHORIZE_PRODUCTION');
  const authorityPr = requirePositiveInteger(requireValue(env, 'AUTHORITY_PR'), 'AUTHORITY_PR');
  const authorityReceipt = requirePositiveInteger(
    requireValue(env, 'AUTHORITY_RECEIPT'),
    'AUTHORITY_RECEIPT',
  );

  if (authorizeProduction !== 'true') throw new Error('Production authorization flag is not true');
  if (runAttempt !== '1') throw new Error('Workflow reruns cannot reuse production authority');

  const directFounder = actor === repositoryOwner && triggeringActor === repositoryOwner;
  const activationRunId = optionalValue(env, 'ACTIVATION_RUN_ID');
  const bridgeFounder = activationRunId
    ? assertBridgeActivation({ activation, env, authorityPr, expectedSha })
    : false;
  if (!directFounder && !bridgeFounder) {
    throw new Error('Execution is not authenticated by founder actor or founder bridge activation');
  }

  if (!pr || String(pr.number) !== authorityPr) throw new Error('Authority PR mismatch');
  if (pr.state !== 'open') throw new Error('Authority PR must remain open');
  if (pr.user?.login !== repositoryOwner) throw new Error('Authority PR is not founder-owned');
  if (pr.head?.repo?.full_name && pr.head.repo.full_name !== env.GITHUB_REPOSITORY) {
    throw new Error('Authority PR head must come from the canonical repository');
  }
  if (pr.head?.sha !== expectedSha) throw new Error('Authority PR head moved');

  if (!review || String(review.id) !== authorityReceipt) throw new Error('Authority receipt mismatch');
  if (review.user?.login !== repositoryOwner) throw new Error('Authority receipt is not founder-authored');
  if (review.author_association !== 'OWNER') throw new Error('Authority receipt is not owner-associated');
  if (review.commit_id !== expectedSha) throw new Error('Authority receipt is stale');
  const body = String(review.body ?? '');
  if (!body.includes(`Founder production-proof authority granted for exact head \`${expectedSha}\`.`)) {
    throw new Error('Authority receipt does not name the exact head');
  }
  if (!body.includes(AUTHORITY_MARKER)) throw new Error('Authority receipt lacks the one-shot marker');

  const consumed = consumptionMarker(authorityReceipt, expectedSha);
  if (comments.some((comment) => String(comment.body ?? '').includes(consumed))) {
    throw new Error('Authority receipt has already been consumed');
  }

  return {
    expectedSha,
    authorityPr,
    authorityReceipt,
    consumedMarker: consumed,
    authenticatedBy: directFounder ? 'direct-founder' : 'founder-bridge',
  };
}

async function requestJson(fetchImpl, env, path, options = {}) {
  const token = requireValue(env, 'GH_TOKEN');
  const response = await fetchImpl(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text.slice(0, 500)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function listAll(fetchImpl, env, path) {
  const all = [];
  for (let page = 1; page <= 20; page += 1) {
    const joiner = path.includes('?') ? '&' : '?';
    const batch = await requestJson(fetchImpl, env, `${path}${joiner}per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error(`Expected array from ${path}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

export async function loadAuthoritySnapshot(env = process.env, fetchImpl = globalThis.fetch) {
  const repository = requireValue(env, 'GITHUB_REPOSITORY');
  const authorityPr = requirePositiveInteger(requireValue(env, 'AUTHORITY_PR'), 'AUTHORITY_PR');
  const authorityReceipt = requirePositiveInteger(
    requireValue(env, 'AUTHORITY_RECEIPT'),
    'AUTHORITY_RECEIPT',
  );
  const activationRunId = optionalValue(env, 'ACTIVATION_RUN_ID');

  const [pr, review, comments, activation] = await Promise.all([
    requestJson(fetchImpl, env, `/repos/${repository}/pulls/${authorityPr}`),
    requestJson(fetchImpl, env, `/repos/${repository}/pulls/${authorityPr}/reviews/${authorityReceipt}`),
    listAll(fetchImpl, env, `/repos/${repository}/issues/${authorityPr}/comments`),
    activationRunId
      ? requestJson(fetchImpl, env, `/repos/${repository}/actions/runs/${requirePositiveInteger(activationRunId, 'ACTIVATION_RUN_ID')}`)
      : Promise.resolve(null),
  ]);
  return { pr, review, comments, activation };
}

export async function validateAuthority(env = process.env, fetchImpl = globalThis.fetch) {
  const snapshot = await loadAuthoritySnapshot(env, fetchImpl);
  return assertAuthoritySnapshot({ ...snapshot, env });
}

export async function discoverAuthority(env = process.env, fetchImpl = globalThis.fetch) {
  const repository = requireValue(env, 'GITHUB_REPOSITORY');
  const repositoryOwner = requireValue(env, 'REPOSITORY_OWNER');
  const triggeringActor = requireValue(env, 'TRIGGERING_ACTOR');
  const expectedSha = requireValue(env, 'EXPECTED_HEAD_SHA');
  const authorityPr = requirePositiveInteger(requireValue(env, 'AUTHORITY_PR'), 'AUTHORITY_PR');
  const actor = requireValue(env, 'GITHUB_ACTOR');

  if (actor !== repositoryOwner || triggeringActor !== repositoryOwner) {
    throw new Error('Authority bridge was not founder-triggered');
  }

  const pr = await requestJson(fetchImpl, env, `/repos/${repository}/pulls/${authorityPr}`);
  if (pr.state !== 'open') throw new Error('Authority PR must remain open');
  if (pr.user?.login !== repositoryOwner) throw new Error('Authority PR is not founder-owned');
  if (pr.head?.sha !== expectedSha) throw new Error('Authority PR head moved');
  if (pr.head?.repo?.full_name && pr.head.repo.full_name !== repository) {
    throw new Error('Authority PR head must come from the canonical repository');
  }

  const [reviews, comments] = await Promise.all([
    listAll(fetchImpl, env, `/repos/${repository}/pulls/${authorityPr}/reviews`),
    listAll(fetchImpl, env, `/repos/${repository}/issues/${authorityPr}/comments`),
  ]);

  const candidates = reviews
    .filter((item) =>
      item.user?.login === repositoryOwner
      && item.author_association === 'OWNER'
      && item.commit_id === expectedSha
      && String(item.body ?? '').includes(
        `Founder production-proof authority granted for exact head \`${expectedSha}\`.`,
      )
      && String(item.body ?? '').includes(AUTHORITY_MARKER)
    )
    .sort((a, b) => {
      const time = String(b.submitted_at ?? '').localeCompare(String(a.submitted_at ?? ''));
      return time || Number(b.id) - Number(a.id);
    });

  const receipt = candidates.find((item) => {
    const marker = consumptionMarker(String(item.id), expectedSha);
    return !comments.some((comment) => String(comment.body ?? '').includes(marker));
  });

  if (!receipt) throw new Error('No unconsumed exact-head founder authority receipt exists');
  return String(receipt.id);
}

export async function consumeAuthority(env = process.env, fetchImpl = globalThis.fetch) {
  const validated = await validateAuthority(env, fetchImpl);
  const repository = requireValue(env, 'GITHUB_REPOSITORY');
  const body = [
    validated.consumedMarker,
    `Production authority receipt \`${validated.authorityReceipt}\` consumed for exact head \`${validated.expectedSha}\`.`,
    `Authenticated by: ${validated.authenticatedBy}.`,
    'This marker prevents a second new dispatch from reusing the same one-shot founder authority.',
  ].join('\n\n');

  await requestJson(
    fetchImpl,
    env,
    `/repos/${repository}/issues/${validated.authorityPr}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
      headers: { 'Content-Type': 'application/json' },
    },
  );
  return validated;
}

async function main() {
  const command = process.argv[2];
  if (command === 'validate') {
    const result = await validateAuthority();
    process.stdout.write(`${result.authorityReceipt}\n`);
    return;
  }
  if (command === 'discover') {
    const receipt = await discoverAuthority();
    process.stdout.write(`${receipt}\n`);
    return;
  }
  if (command === 'consume') {
    const result = await consumeAuthority();
    process.stdout.write(`${result.consumedMarker}\n`);
    return;
  }
  throw new Error('Usage: node scripts/proofmode-production-authority.mjs <validate|discover|consume>');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
