#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { renderChiefVideo } from '../src/domain/video-renderer.js';
import { assertRenderJob } from './render-job-contract.mjs';

const args = process.argv.slice(2);
const get = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const queueDir = get('--queue', '.video-jobs');
const verifyOnly = args.includes('--verify-only');
const dirs = Object.fromEntries(['pending', 'running', 'completed', 'failed', 'receipts'].map((name) => [name, path.join(queueDir, name)]));
for (const dir of Object.values(dirs)) await fs.mkdir(dir, { recursive: true });
const digest = async (file) => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');

if (verifyOnly) {
  const files = (await fs.readdir(dirs.receipts)).filter((file) => file.endsWith('.json'));
  if (!files.length) throw new Error('no render receipts found');
  for (const file of files) {
    const receipt = JSON.parse(await fs.readFile(path.join(dirs.receipts, file), 'utf8'));
    if (receipt.status !== 'COMPLETED' || receipt.publishAuthority !== false) throw new Error('invalid receipt state');
    if (!receipt.output?.path || !receipt.output?.sha256) throw new Error('receipt missing output proof');
    if ((await digest(receipt.output.path)) !== receipt.output.sha256) throw new Error('receipt digest mismatch');
  }
  console.log(JSON.stringify({ status: 'VERIFIED', project: 'chief-ai-machine', receipts: files.length }));
  process.exit(0);
}

const pending = (await fs.readdir(dirs.pending)).filter((file) => file.endsWith('.json')).sort();
if (!pending.length) {
  console.log(JSON.stringify({ status: 'IDLE', project: 'chief-ai-machine' }));
  process.exit(0);
}

const file = pending[0];
const source = path.join(dirs.pending, file);
const running = path.join(dirs.running, file);
await fs.rename(source, running);
const job = assertRenderJob(JSON.parse(await fs.readFile(running, 'utf8')));

try {
  const workDir = path.join(queueDir, 'work', job.id);
  await fs.mkdir(workDir, { recursive: true });
  const outputPath = path.resolve(workDir, 'output.mp4');
  const result = await renderChiefVideo({ ...job.input, imagePath: path.resolve(job.input.imagePath), outputPath });
  if (result.kind !== 'RENDERED') throw new Error(`renderer did not complete: ${result.kind}`);
  const outputSha256 = await digest(outputPath);
  if (result.sha256 !== outputSha256) throw new Error('renderer/output digest mismatch');
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
    output: { path: outputPath, sha256: outputSha256 },
    renderer: result,
  };
  await fs.writeFile(path.join(dirs.receipts, `${job.id}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  await fs.rename(running, path.join(dirs.completed, file));
  console.log(JSON.stringify(receipt));
} catch (error) {
  await fs.rename(running, path.join(dirs.failed, file));
  throw error;
}
