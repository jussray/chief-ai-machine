import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CHIEF_VIDEO_RENDERER, probeChiefVideoRenderer, renderChiefVideo } from './video-renderer.js';

const PPM = 'P3\n4 4\n255\n255 0 80  120 40 255  20 20 40  255 220 40\n20 20 40  255 0 120  120 40 255  20 20 40\n120 40 255  20 20 40  255 0 120  255 220 40\n255 220 40  255 0 80  20 20 40  120 40 255\n';

describe('Chief independent video renderer', () => {
  it('rejects unsafe paths before invoking ffmpeg', async () => {
    const result = await renderChiefVideo({ imagePath: 'relative.ppm', outputPath: 'relative.mp4' });
    expect(result.kind).toBe('REJECTED');
  });

  it('renders and ffprobes an MP4 when local media tooling exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'chief-video-'));
    try {
      const imagePath = join(dir, 'source.ppm');
      const outputPath = join(dir, 'chief.mp4');
      await writeFile(imagePath, PPM, 'utf8');

      const capability = await probeChiefVideoRenderer();
      const result = await renderChiefVideo({
        imagePath,
        outputPath,
        width: 320,
        height: 568,
        fps: 24,
        durationSeconds: 2,
        movement: 'push_in',
      });

      if (!capability.available) {
        expect(result).toEqual({ kind: 'CAPABILITY_UNAVAILABLE', reason: 'ffmpeg and ffprobe binaries are required on PATH' });
        return;
      }

      expect(result.kind).toBe('RENDERED');
      if (result.kind !== 'RENDERED') return;
      expect(result.renderer).toBe(CHIEF_VIDEO_RENDERER);
      expect(result.width).toBe(320);
      expect(result.height).toBe(568);
      expect(result.videoCodec).toBe('h264');
      expect(result.audioCodec).toBe('aac');
      expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.publishAuthority).toBe(false);
      expect((await readFile(outputPath)).length).toBeGreaterThan(1000);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
