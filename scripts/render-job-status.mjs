#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
const args = process.argv.slice(2);
const i = args.indexOf('--queue');
const queue = i >= 0 ? args[i + 1] : '.video-jobs';
const counts = {};
for (const name of ['pending','running','completed','failed','receipts']) {
  try { counts[name] = (await fs.readdir(path.join(queue, name))).filter((f) => f.endsWith('.json')).length; }
  catch { counts[name] = 0; }
}
console.log(JSON.stringify({ project: 'chief-ai-machine', queue, counts, publishAuthority: false }));
