#!/usr/bin/env node
// push-parts.js
// Splits a file into N parts and pushes each to a GitHub repo via the
// Contents API. JS twin of push-parts.py — same interface, same behavior.
//
// Requires Node 18+ (built-in fetch). No dependencies.
//
// Usage:
//   node scripts/push-parts.js --owner jussray --repo promptos --file index.html
//   GITHUB_TOKEN=ghp_xxx node scripts/push-parts.js --owner jussray --repo chief-ai-machine --file some-large-file.txt
//
// Prefer the GITHUB_TOKEN env var over --token — a token passed as a CLI
// flag lands in shell history and process listings. --token is supported
// only as a fallback for parity with push_parts.py.

function parseArgs(argv) {
  const args = { branch: 'main', parts: 12, prefix: 'parts/p', pad: 2, ext: '.txt', file: 'index.html' };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const value = argv[i + 1];
    args[name] = value;
    i++;
  }
  return args;
}

function usageAndExit(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    'Usage: node scripts/push-parts.js --owner OWNER --repo REPO [--branch main]\n' +
    '         [--file index.html] [--parts 12] [--prefix parts/p] [--pad 2] [--ext .txt]\n' +
    '         [--token TOKEN]  (prefer GITHUB_TOKEN env var instead)'
  );
  process.exit(1);
}

async function ghRequest(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  return res;
}

async function getSha(owner, repo, branch, path, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const res = await ghRequest(url, token);
  if (res.status === 200) {
    const body = await res.json();
    return body.sha;
  }
  return null;
}

async function pushFile(owner, repo, branch, path, contentStr, message, token) {
  const encoded = Buffer.from(contentStr, 'utf8').toString('base64');
  const sha = await getSha(owner, repo, branch, path, token);
  const body = { message, content: encoded, branch };
  if (sha) body.sha = sha;

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await ghRequest(url, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 200 || res.status === 201) {
    const json = await res.json();
    console.log(`  ✓  ${path}  →  commit ${json.commit.sha.slice(0, 8)}`);
  } else {
    const text = await res.text();
    console.error(`  ✗  ${path}  →  ${res.status}: ${text.slice(0, 200)}`);
    process.exit(1);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = process.env.GITHUB_TOKEN || args.token;

  if (!token) usageAndExit('missing token (set GITHUB_TOKEN or pass --token)');
  if (!args.owner) usageAndExit('missing --owner');
  if (!args.repo) usageAndExit('missing --repo');

  const fs = await import('node:fs');
  if (!fs.existsSync(args.file)) usageAndExit(`file not found: ${args.file}`);

  const content = fs.readFileSync(args.file, 'utf8');
  const total = content.length;
  const parts = Number(args.parts);
  const chunkSize = Math.ceil(total / parts);
  const pad = Number(args.pad);

  console.log(`Source: ${args.file}  (${total.toLocaleString()} chars)`);
  console.log(`Splitting into ${parts} parts of ~${chunkSize.toLocaleString()} chars each\n`);

  for (let i = 0; i < parts; i++) {
    const chunk = content.slice(i * chunkSize, (i + 1) * chunkSize);
    const partNo = String(i + 1).padStart(pad, '0');
    const path = `${args.prefix}${partNo}${args.ext}`;
    const from = i * chunkSize;
    const to = Math.min((i + 1) * chunkSize, total);
    const message = `feat: ${path} (chars ${from.toLocaleString()}–${to.toLocaleString()})`;
    await pushFile(args.owner, args.repo, args.branch, path, chunk, message, token);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  console.log(`\n✅  All ${parts} parts pushed.`);
  console.log(`If an assemble workflow watches ${args.prefix}*${args.ext}, it will pick these up automatically.`);
  console.log(`Watch it at: https://github.com/${args.owner}/${args.repo}/actions`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
