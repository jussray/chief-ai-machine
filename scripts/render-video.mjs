import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { renderChiefVideo } from '../src/domain/video-renderer.js';

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const inputPath = arg('--input');
if (!inputPath) {
  console.error('Usage: node scripts/render-video.mjs --input <json>');
  process.exit(1);
}

try {
  const input = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
  if (input.imagePath) input.imagePath = resolve(input.imagePath);
  if (input.outputPath) input.outputPath = resolve(input.outputPath);
  const result = await renderChiefVideo(input);
  console.log(JSON.stringify(result, null, 2));
  if (result.kind !== 'RENDERED') process.exitCode = result.kind === 'CAPABILITY_UNAVAILABLE' ? 2 : 1;
} catch (error) {
  console.error(JSON.stringify({ kind: 'FAILED', code: 'CHIEF_VIDEO_CLI_FAILED', error: error?.message || String(error) }, null, 2));
  process.exitCode = 1;
}
