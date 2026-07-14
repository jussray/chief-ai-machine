import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const expected = ['context7', 'github', 'playwright'];
const toolsets = 'repos,issues,pull_requests,actions,code_security,secret_protection';
const playwright = '@playwright/mcp@0.0.78';

function fail(message) { throw new Error(`[verify:mcp] ${message}`); }
function assert(value, message) { if (!value) fail(message); }
function read(file) {
  try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (error) { fail(`${file} is missing or invalid JSON: ${error.message}`); }
}

function validate(file, servers, requireStdio = false) {
  assert(JSON.stringify(Object.keys(servers ?? {}).sort()) === JSON.stringify(expected), `${file} must contain exactly: ${expected.join(', ')}`);
  assert(servers.github?.type === 'http' && servers.github?.url === 'https://api.githubcopilot.com/mcp/', `${file}:github endpoint drifted`);
  assert(servers.github?.headers?.['X-MCP-Toolsets'] === toolsets, `${file}:github toolsets drifted`);
  assert(servers.github?.headers?.['X-MCP-Lockdown'] === 'true', `${file}:github lockdown must remain enabled while public`);
  assert(!servers.github?.headers?.Authorization, `${file}:do not commit GitHub authorization headers`);
  assert(servers.github?.headers?.['X-MCP-Insiders'] !== 'true', `${file}:GitHub Insiders is private opt-in only`);
  assert(servers.context7?.type === 'http' && servers.context7?.url === 'https://mcp.context7.com/mcp', `${file}:context7 endpoint drifted`);
  if (requireStdio) assert(servers.playwright?.type === 'stdio', `${file}:playwright must use stdio`);
  assert(servers.playwright?.command === 'npx', `${file}:playwright command must be npx`);
  assert(servers.playwright?.args?.includes(playwright), `${file}:playwright must stay pinned to ${playwright}`);
  assert(!servers.playwright?.args?.some((arg) => String(arg).includes('@latest')), `${file}:MCP packages cannot use @latest`);
  assert(servers.playwright?.args?.includes('--isolated'), `${file}:playwright must use an isolated profile`);
  for (const name of ['supabase', 'dbhub', 'netdata-cloud', 'cloudflare-builds', 'cloudflare-observability']) {
    assert(!servers[name], `${file}:${name} is not justified before the private backend/runtime exists`);
  }
}

function noSecrets(file, parsed) {
  const value = JSON.stringify(parsed);
  for (const pattern of [/github_pat_/i, /ghp_[A-Za-z0-9]{20,}/, /Bearer\s+[A-Za-z0-9._-]{12,}/i, /DATABASE_URL/, /CLOUDFLARE_API_TOKEN/]) {
    assert(!pattern.test(value), `${file} appears to contain a committed credential`);
  }
}

const project = read('.mcp.json');
const example = read('.mcp.example.json');
const vscode = read('.vscode/mcp.json');
validate('.mcp.json', project.mcpServers);
validate('.mcp.example.json', example.mcpServers);
validate('.vscode/mcp.json', vscode.servers, true);
noSecrets('.mcp.json', project);
noSecrets('.mcp.example.json', example);
noSecrets('.vscode/mcp.json', vscode);
console.log('[verify:mcp] Prompt-ops MCP configuration is scoped, pinned, and credential-free.');
