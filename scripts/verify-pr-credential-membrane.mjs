import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const workflowPaths = [
  '.github/workflows/proofmode-mcp-playwright.yml',
  '.github/workflows/chief-capability-plan-playwright.yml',
];

const failures = [];
const requireValue = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const path of workflowPaths) {
  const text = await readFile(new URL(path, root), 'utf8');
  const jobsIndex = text.indexOf('\njobs:\n');
  const runtimeIndex = text.indexOf('\n  runtime-proof:\n');

  requireValue(jobsIndex >= 0, `${path}: jobs block missing`);
  requireValue(runtimeIndex >= 0, `${path}: runtime-proof job missing`);
  requireValue(text.includes('pull_request:'), `${path}: pull_request source-proof trigger missing`);
  requireValue(text.includes('workflow_dispatch:'), `${path}: founder manual runtime trigger missing`);

  if (jobsIndex < 0 || runtimeIndex < 0) continue;

  const globalScope = text.slice(0, jobsIndex);
  const preRuntime = text.slice(0, runtimeIndex);
  const runtime = text.slice(runtimeIndex);

  requireValue(
    !globalScope.includes('${{ secrets.'),
    `${path}: workflow-global secret reference would expose privileged material outside the manual runtime job`,
  );
  requireValue(
    preRuntime.includes('pr-runtime-gate:'),
    `${path}: PR fail-closed runtime gate missing`,
  );
  requireValue(
    preRuntime.includes('Fail closed before secret-bearing runtime proof'),
    `${path}: PR gate must stop before secret-bearing runtime proof`,
  );
  requireValue(
    preRuntime.includes('PR-authored workflow code is not permitted to enter proofmode-access-admin or receive Cloudflare Access credentials.'),
    `${path}: PR credential-membrane receipt text drifted`,
  );
  requireValue(
    !preRuntime.includes('${{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID }}')
      && !preRuntime.includes('${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}'),
    `${path}: Cloudflare Access secrets referenced before privileged runtime-proof job`,
  );
  requireValue(
    !preRuntime.includes('environment: proofmode-access-admin'),
    `${path}: PR/source job may not enter proofmode-access-admin`,
  );
  requireValue(
    runtime.includes("github.event_name == 'workflow_dispatch'"),
    `${path}: privileged runtime-proof must be workflow_dispatch-only`,
  );
  requireValue(
    runtime.includes('environment: proofmode-access-admin'),
    `${path}: privileged runtime-proof must use proofmode-access-admin`,
  );
  requireValue(
    runtime.includes('${{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID }}')
      && runtime.includes('${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}'),
    `${path}: privileged runtime-proof must bind both Access service-token secrets together`,
  );
}

if (failures.length > 0) {
  console.error('PR credential membrane verification failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('PR credential membrane verified for Chief MCP and capability-plan Playwright workflows.');
console.log('PR-authored code remains source-proof only; Cloudflare Access secrets are confined to founder-authorized workflow_dispatch runtime jobs.');
