import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const root = new URL('../', import.meta.url);
const policy = JSON.parse(await readFile(new URL('.control-room/cookie-policy.json', root), 'utf8'));
const errors = [];
const requireValue = (condition, message) => {
  if (!condition) errors.push(message);
};

requireValue(policy.repository === 'jussray/chief-ai-machine', 'repository mismatch');
requireValue(policy.firstPartyCookies?.length === 0, 'first-party cookie count must remain zero');
requireValue(policy.platformManagedCookies?.length === 0, 'platform cookie count must remain zero');

const excluded = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', 'docs', 'artifacts', '.agents', '.figma']);
const extensions = new Set(['.html', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const verifierPath = 'scripts/verify-cookie-contract.mjs';
const patterns = [
  ['document.cookie', /\bdocument\.cookie\b/],
  ['Cookie Store API', /\bcookieStore\b/],
  ['Set-Cookie', /['"`]Set-Cookie['"`]/i],
  ['cookie dependency import', /from\s+['"](?:js-cookie|universal-cookie|cookie|cookie-parser)['"]/],
];

async function scan(directory = '') {
  const entries = await readdir(new URL(directory ? `${directory}/` : './', root), { withFileTypes: true });
  for (const entry of entries) {
    if (excluded.has(entry.name)) continue;
    const relative = directory ? join(directory, entry.name).replaceAll('\\', '/') : entry.name;
    if (entry.isDirectory()) {
      await scan(relative);
      continue;
    }
    if (relative === verifierPath || !extensions.has(extname(entry.name))) continue;
    const source = await readFile(new URL(relative, root), 'utf8');
    for (const [label, pattern] of patterns) {
      if (pattern.test(source)) errors.push(`${relative}: forbidden ${label}`);
    }
  }
}
await scan();

if (errors.length > 0) {
  console.error('Chief AI cookie contract failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Chief AI cookie contract verified.');
console.log('Cookies: 0');
console.log('Verified authenticated backend: not claimed');
