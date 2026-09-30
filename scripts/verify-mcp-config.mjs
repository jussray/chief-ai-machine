/* global process, console */

import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

const root = process.cwd();
const expected = ['context7', 'founder-control-room', 'github', 'playwright', 'supabase'];
const fcrUrl = 'https://api.foundercontrolroom.org/mcp';
const toolsets = 'repos,issues,pull_requests,actions,code_security,secret_protection';
const playwright = '@playwright/mcp@0.0.78';
const chiefProjectRef = 'lghpwoktsytutssjiwgy';
const exampleProjectRef = 'YOUR_CHIEF_PROJECT_REF';

function fail(message) { throw new Error(`[verify:mcp] ${message}`); }
function assert(value, message) { if (!value) fail(message); }
function read(file) {
  try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (error) { fail(`${file} is missing or invalid JSON: ${error.message}`); }
}

function validateSupabase(file, server, expectedProjectRef) {
  assert(server?.type === 'http', `${file}:supabase must use HTTP`);
  let url;
  try { url = new URL(server?.url ?? ''); }
  catch { fail(`${file}:supabase URL is invalid`); }
  assert(url.origin === 'https://mcp.supabase.com', `${file}:supabase host drifted`);
  assert(url.pathname === '/mcp', `${file}:supabase path drifted`);
  assert(url.searchParams.get('project_ref') === expectedProjectRef, `${file}:supabase project_ref drifted`);
  assert(url.searchParams.get('read_only') === 'true', `${file}:supabase must remain read-only`);
  assert(url.searchParams.get('features') === 'database,docs', `${file}:supabase features must stay bounded to database,docs`);
  assert(!server?.headers?.Authorization, `${file}:do not commit Supabase authorization headers`);
}

function validate(file, servers, expectedProjectRef, requireStdio = false) {
  assert(JSON.stringify(Object.keys(servers ?? {}).sort()) === JSON.stringify(expected), `${file} must contain exactly: ${expected.join(', ')}`);
  assert(servers['founder-control-room']?.type === 'http' && servers['founder-control-room']?.url === fcrUrl, `${file}:Founder Control Room endpoint drifted`);
  assert(!servers['founder-control-room']?.headers, `${file}:Founder Control Room credentials must not be committed`);
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
  validateSupabase(file, servers.supabase, expectedProjectRef);
  for (const name of ['dbhub', 'netdata-cloud', 'cloudflare-builds', 'cloudflare-observability']) {
    assert(!servers[name], `${file}:${name} is not justified in the current Chief development boundary`);
  }
}

function noSecrets(file, parsed) {
  const value = JSON.stringify(parsed);
  for (const pattern of [/github_pat_/i, /ghp_[A-Za-z0-9]{20,}/, /Bearer\s+[A-Za-z0-9._-]{12,}/i, /DATABASE_URL/, /CLOUDFLARE_API_TOKEN/, /SUPABASE_SERVICE_ROLE_KEY/]) {
    assert(!pattern.test(value), `${file} appears to contain a committed credential`);
  }
}

const project = read('.mcp.json');
const example = read('.mcp.example.json');
const vscode = read('.vscode/mcp.json');
validate('.mcp.json', project.mcpServers, chiefProjectRef);
validate('.mcp.example.json', example.mcpServers, exampleProjectRef);
validate('.vscode/mcp.json', vscode.servers, chiefProjectRef, true);
noSecrets('.mcp.json', project);
noSecrets('.mcp.example.json', example);
noSecrets('.vscode/mcp.json', vscode);
console.log('[verify:mcp] Chief MCP configuration is FCR-routed, project-scoped, read-only, pinned, and credential-free.');
