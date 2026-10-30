import { readFileSync } from 'node:fs';

const mode = process.argv[2];
const raw = readFileSync(0, 'utf8').replace(/\r\n/g, '\n');

if (mode === 'wrangler') {
  const config = JSON.parse(raw);
  if (Array.isArray(config?.assets?.run_worker_first)) {
    config.assets.run_worker_first = config.assets.run_worker_first.filter(
      (route) => route !== '/github/*',
    );
  }
  process.stdout.write(JSON.stringify(config));
  process.exit(0);
}

if (mode === 'http-worker') {
  const lines = raw.split('\n');
  const output = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === "import { handleGitHubAppRequest } from './github-app.js';") {
      continue;
    }

    const isGithubRoute = line === "    if (url.pathname.startsWith('/github/')) {"
      && lines[index + 1] === '      return handleGitHubAppRequest(request, env);'
      && lines[index + 2] === '    }';
    if (isGithubRoute) {
      index += 2;
      continue;
    }

    output.push(line);
  }

  process.stdout.write(output.join('\n').replace(/\n{3,}/g, '\n\n'));
  process.exit(0);
}

throw new Error(`Unsupported ProofMode scope normalization mode: ${mode || '<empty>'}`);
