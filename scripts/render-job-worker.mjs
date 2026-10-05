#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { renderVideo } from '../src/domain/video-renderer.js';

const args = process.argv.slice(2);
const get = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const queueDir = get('--queue', '.video-jobs');
const verifyOnly = args.includes('--verify-only');

const dirs = Object.fromEntries(['pending','running','completed','failed','receipts'].map((name) => [name, path.join(queueDir, name)]));
for (const dir of Object.values(dirs)) await fs.mkdir(dir, { recursive: true });
const digest = async (file) => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');

if (verifyOnly) {
  const files = (await fs.readdir(dirs.receipts)).filter((f) => f.endsWith('.json'));
  if (!files.length) throw new Error('no render receipts found');
  for (const file of files) {
    const receipt = JSON.parse(await fs.readFile(path.join(dirs.receipts, file), 'utf8'));
    if (receipt.status !== 'COMPLETED' || receipt.publishAuthority !== false) throw new Error('invalid receipt state');
    if (!receipt.output?.path || !receipt.output?.sha256) throw new Error('receipt missing output proof');
    if ((await digest(receipt.output.path)) !== receipt.output.sha256) throw new Error('receipt digest mismatch');
  }
  console.log(JSON.stringify({ status: 'VERIFIED', receipts: files.length }));
  process.exit(0);
}

const pending = (await fs.readdir(dirs.pending)).filter((f) => f.endsWith('.json')).sort();
if (!pending.length) {
  console.log(JSON.stringify({ status: 'IDLE' }));
  process.exit(0);
}

const file = pending[0];
const source = path.join(dirs.pending, file);
const running = path.join(dirs.running, file);
await fs.rename(source, running);
const job = JSON.parse(await fs.readFile(running, 'utf8'));
if (job.project !== 'chief-ai-machine' || job.kind !== 'video.render') throw new Error('job namespace mismatch');
if (job.authority?.render !== true || job.authority?.publish !== false) throw new Error('invalid render authority');

try {
  const workDir = path.join(queueDir, 'work', job.id);
  await fs.mkdir(workDir, { recursive: true });
  const outputPath = path.join(workDir, 'output.mp4');
  const result = await renderVideo({ ...job.input, outputPath });
  const receipt = {
    schemaVersion: 1,
    id: job.id,
    project: job.project,
    kind: job.kind,
    fingerprint: job.fingerprint,
    status: 'COMPLETED',
    requestedAt: job.requestedAt,
    completedAt: new Date().toISOString(),
    publishAuthority: false,
    output: { path: outputPath, sha256: await digest(outputPath) },
    renderer: result,
  };
  await fs.writeFile(path.join(dirs.receipts, `${job.id}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  await fs.rename(running, path.join(dirs.completed, file));
  console.log(JSON.stringify(receipt));
} catch (error) {
  await fs.rename(running, path.join(dirs.failed, file));
  throw error;
}
