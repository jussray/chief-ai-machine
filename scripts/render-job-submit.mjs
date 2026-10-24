#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const get = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const inputPath = get('--input');
const queueDir = get('--queue', '.video-jobs');
if (!inputPath) throw new Error('--input is required');

const raw = await fs.readFile(inputPath, 'utf8');
const input = JSON.parse(raw);
const fingerprint = crypto.createHash('sha256').update(raw).digest('hex');
const id = `${Date.now()}-${fingerprint.slice(0, 12)}`;
const pendingDir = path.join(queueDir, 'pending');
await fs.mkdir(pendingDir, { recursive: true });
const job = {
  schemaVersion: 1,
  id,
  project: 'chief-ai-machine',
  kind: 'video.render',
  fingerprint,
  requestedAt: new Date().toISOString(),
  authority: { render: true, publish: false },
  input,
};
await fs.writeFile(path.join(pendingDir, `${id}.json`), `${JSON.stringify(job, null, 2)}\n`);
console.log(JSON.stringify({ status: 'QUEUED', id, fingerprint, publishAuthority: false }));
