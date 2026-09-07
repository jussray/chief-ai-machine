import process from 'node:process';

export const AUTHORITY_MARKER =
  'PRODUCTION_ACTION_AUTHORIZED / EXACT_HEAD_BOUND / ONE_SHOT / MERGE_HOLD.';
export const CONSUMPTION_PREFIX = 'proofmode-production-authority-consumed:v1';

function requireValue(env, name) {
  const value = String(env[name] ?? '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
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

export function assertAuthoritySnapshot({ pr, review, comments = [], env }) {
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
  if (actor !== repositoryOwner) throw new Error('Workflow actor is not the repository owner');
  if (triggeringActor !== repositoryOwner) {
    throw new Error('Triggering actor is not the repository owner');
  }
  if (runAttempt !== '1') throw new Error('Workflow reruns cannot reuse production authority');

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

  const pr = await requestJson(fetchImpl, env, `/repos/${repository}/pulls/${authorityPr}`);
  const review = await requestJson(
    fetchImpl,
    env,
    `/repos/${repository}/pulls/${authorityPr}/reviews/${authorityReceipt}`,
  );
  const comments = await listAll(
    fetchImpl,
    env,
    `/repos/${repository}/issues/${authorityPr}/comments`,
  );
  return { pr, review, comments };
}

export async function validateAuthority(env = process.env, fetchImpl = globalThis.fetch) {
  const snapshot = await loadAuthoritySnapshot(env, fetchImpl);
  return assertAuthoritySnapshot({ ...snapshot, env });
}

export async function discoverAuthority(env = process.env, fetchImpl = globalThis.fetch) {
  const repository = requireValue(env, 'GITHUB_REPOSITORY');
  const repositoryOwner = requireValue(env, 'REPOSITORY_OWNER');
  const expectedSha = requireValue(env, 'EXPECTED_HEAD_SHA');
  const authorityPr = requirePositiveInteger(requireValue(env, 'AUTHORITY_PR'), 'AUTHORITY_PR');
  const actor = requireValue(env, 'GITHUB_ACTOR');

  if (actor !== repositoryOwner) throw new Error('Bridge actor is not the repository owner');

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
    .filter((review) =>
      review.user?.login === repositoryOwner
      && review.author_association === 'OWNER'
      && review.commit_id === expectedSha
      && String(review.body ?? '').includes(
        `Founder production-proof authority granted for exact head \`${expectedSha}\`.`,
      )
      && String(review.body ?? '').includes(AUTHORITY_MARKER)
    )
    .sort((a, b) => {
      const time = String(b.submitted_at ?? '').localeCompare(String(a.submitted_at ?? ''));
      return time || Number(b.id) - Number(a.id);
    });

  const receipt = candidates.find((review) => {
    const marker = consumptionMarker(String(review.id), expectedSha);
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
