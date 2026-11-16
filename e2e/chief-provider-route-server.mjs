import { Buffer } from 'node:buffer';
import console from 'node:console';
import http from 'node:http';
import process from 'node:process';
import httpWorker from '../worker/http-worker.js';

const host = '127.0.0.1';
const port = Number(process.env.CHIEF_PROVIDER_PROOF_PORT || 4179);

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new globalThis.Request(`http://${host}:${port}${req.url || '/'}`, {
      method: req.method || 'GET',
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : body,
    });
    const response = await httpWorker.fetch(request, {
      CHIEF_PROVIDER_RUNTIME_ENABLED: 'false',
      ASSETS: { fetch: async () => new globalThis.Response('not found', { status: 404 }) },
    });
    res.statusCode = response.status;
    for (const [key, value] of response.headers) res.setHeader(key, value);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'server failure' }));
  }
});

server.listen(port, host, () => {
  console.log(`chief provider proof server listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
