import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { test } from 'vitest';

function normalize(mode, input) {
  const result = spawnSync(
    process.execPath,
    ['scripts/proofmode-scope-normalize.mjs', mode],
    { input, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('wrangler normalization ignores only the bounded GitHub worker-first route', () => {
  const base = JSON.stringify({ assets: { run_worker_first: ['/api/*', '/version', '/mcp'] } });
  const githubOnly = JSON.stringify({ assets: { run_worker_first: ['/api/*', '/github/*', '/version', '/mcp'] } });
  assert.equal(normalize('wrangler', base), normalize('wrangler', githubOnly));

  const proofModeChanged = JSON.stringify({ assets: { run_worker_first: ['/api/*', '/github/*', '/version'] } });
  assert.notEqual(normalize('wrangler', base), normalize('wrangler', proofModeChanged));
});

test('http-worker normalization ignores only the exact GitHub App import and route block', () => {
  const base = `import { handleProofModeMcp } from './proofmode-mcp.js';\n\nconst httpWorker = {\n  async fetch(request, env) {\n    const url = new URL(request.url);\n\n    if (url.pathname === '/mcp') {\n      return handleProofModeMcp(request, env);\n    }\n\n    return env.ASSETS.fetch(request);\n  },\n};\n`;
  const githubOnly = `import { handleGitHubAppRequest } from './github-app.js';\nimport { handleProofModeMcp } from './proofmode-mcp.js';\n\nconst httpWorker = {\n  async fetch(request, env) {\n    const url = new URL(request.url);\n\n    if (url.pathname === '/mcp') {\n      return handleProofModeMcp(request, env);\n    }\n\n    if (url.pathname.startsWith('/github/')) {\n      return handleGitHubAppRequest(request, env);\n    }\n\n    return env.ASSETS.fetch(request);\n  },\n};\n`;
  assert.equal(normalize('http-worker', base), normalize('http-worker', githubOnly));

  const proofModeChanged = githubOnly.replace("url.pathname === '/mcp'", "url.pathname === '/mcp-v2'");
  assert.notEqual(normalize('http-worker', base), normalize('http-worker', proofModeChanged));
});
