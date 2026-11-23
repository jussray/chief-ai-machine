import { Buffer } from 'node:buffer';
import http from 'node:http';
import process from 'node:process';
import worker from '../worker/index.js';

const host = '127.0.0.1';
const port = Number(process.env.CHIEF_PROVIDER_WORKER_PROOF_PORT || 4179);
const expectedSha = process.env.EXPECTED_HEAD_SHA || 'synthetic-exact-head';
const expectedBranch = process.env.EXPECTED_HEAD_BRANCH || 'synthetic-branch';
const observations = { protect2Calls: 0, providerCalls: 0, protect2PayloadOnlyTool: true, providerReceivedPrompt: false };
let activePrompt = '';

const completed = {
  id: 'resp_chief_fixture',
  status: 'completed',
  output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Synthetic remixed draft.' }] }],
};

globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const body = typeof init.body === 'string' ? init.body : '';
  if (url === 'https://protect2.jussco.company/gateway/check') {
    observations.protect2Calls += 1;
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    observations.protect2PayloadOnlyTool &&= JSON.stringify(parsed) === JSON.stringify({ tool: 'chief.draft.generate' });
    if (activePrompt.includes('DENY_FIXTURE')) {
      return Response.json({ decision: 'block', reasons: ['synthetic_fixture'], checkedAt: new Date().toISOString() });
    }
    return Response.json({ decision: 'allow', reasons: [], checkedAt: new Date().toISOString() });
  }
  if (url === 'https://api.openai.com/v1/responses') {
    observations.providerCalls += 1;
    try {
      const parsed = JSON.parse(body);
      observations.providerReceivedPrompt ||= parsed.input === activePrompt && parsed.store === false;
    } catch { /* invalid provider payload remains an assertion failure */ }
    return Response.json(completed);
  }
  throw new Error('Unexpected external request in synthetic proof: ' + url);
};

const env = {
  CHIEF_AI_OPERATOR_KEY: 'synthetic-chief-operator-key',
  OPENAI_API_KEY: 'synthetic-openai-provider-key',
  CHIEF_OPENAI_MODEL: 'synthetic-model',
  CHIEF_PROTECT2_PILOT_MODE: 'enforce-public-draft',
  CHIEF_PROTECT2_API_KEY: 'jp2_synthetic_fixture_00000001',
  WORKERS_CI_COMMIT_SHA: expectedSha,
  WORKERS_CI_BRANCH: expectedBranch,
  CF_VERSION_METADATA: { id: 'synthetic-provider-version', tag: 'candidate-proof' },
  ASSETS: { fetch: async () => new Response('Synthetic Chief asset', { status: 200 }) },
};

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = chunks.length ? Buffer.concat(chunks) : undefined;

    if (req.url === '/__fixture/reset' && req.method === 'POST') {
      observations.protect2Calls = 0;
      observations.providerCalls = 0;
      observations.protect2PayloadOnlyTool = true;
      observations.providerReceivedPrompt = false;
      activePrompt = '';
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.url === '/__fixture/observations' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(observations));
      return;
    }

    if (req.url === '/api/chief/provider' && raw) {
      try { activePrompt = JSON.parse(raw.toString('utf8'))?.prompt || ''; } catch { activePrompt = ''; }
    }

    const request = new Request(`http://${host}:${port}${req.url || '/'}`, {
      method: req.method || 'GET',
      headers: req.headers,
      ...(raw && !['GET', 'HEAD'].includes(req.method || 'GET') ? { body: raw } : {}),
    });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'synthetic_worker_harness_failed' }));
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Chief synthetic Worker proof server listening on http://${host}:${port}\n`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
