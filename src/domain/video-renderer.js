import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';

export const CHIEF_VIDEO_RENDERER = 'chief-ai/local-ffmpeg-video@v1';
const MAX_DURATION_SECONDS = 60;
const MAX_WIDTH = 2160;
const MAX_HEIGHT = 2160;
const MOVEMENTS = new Set(['push_in', 'pull_out', 'pan_left', 'pan_right', 'still']);

function run(command, args, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
      });
    });
  });
}

async function sha256File(path) {
  return new Promise((resolve, reject) => {
    const digest = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (chunk) => digest.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(digest.digest('hex')));
  });
}

function safeInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function safeNumber(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function validate(input) {
  if (!input || typeof input !== 'object') return 'input is required';
  if (!isAbsolute(String(input.imagePath || '')) || !existsSync(String(input.imagePath || ''))) return 'imagePath must be an existing absolute path';
  if (!isAbsolute(String(input.outputPath || '')) || !String(input.outputPath).endsWith('.mp4')) return 'outputPath must be an absolute .mp4 path';
  if (String(input.imagePath) === String(input.outputPath)) return 'input and output paths must differ';
  const movement = String(input.movement || 'push_in');
  if (!MOVEMENTS.has(movement)) return `movement must be one of ${[...MOVEMENTS].join(', ')}`;
  return null;
}

export async function probeChiefVideoRenderer() {
  const ffmpeg = await run('ffmpeg', ['-version'], 10_000);
  const ffprobe = await run('ffprobe', ['-version'], 10_000);
  if (ffmpeg.code !== 0 || ffprobe.code !== 0) {
    return { available: false, ffmpegVersion: null, ffprobeVersion: null };
  }
  return {
    available: true,
    ffmpegVersion: /ffmpeg version (\S+)/.exec(ffmpeg.stdout)?.[1] || 'unknown',
    ffprobeVersion: /ffprobe version (\S+)/.exec(ffprobe.stdout)?.[1] || 'unknown',
  };
}

function motionFilter({ width, height, fps, movement }) {
  const base = `scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase,crop=${width * 2}:${height * 2}`;
  if (movement === 'still') return `${base},scale=${width}:${height},format=yuv420p`;

  const zoom = movement === 'pull_out'
    ? "if(eq(on,0),1.12,max(1.0,zoom-0.0012))"
    : "min(zoom+0.0012,1.12)";
  let x = "iw/2-(iw/zoom/2)";
  let y = "ih/2-(ih/zoom/2)";
  if (movement === 'pan_left') x = "max(0,(iw-iw/zoom)*(1-on/1800))";
  if (movement === 'pan_right') x = "min(iw-iw/zoom,(iw-iw/zoom)*(on/1800))";

  return `${base},zoompan=z='${zoom}':x='${x}':y='${y}':d=1:s=${width}x${height}:fps=${fps},format=yuv420p`;
}

async function probeOutput(outputPath) {
  const result = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height',
    '-of', 'json',
    outputPath,
  ], 15_000);
  if (result.code !== 0) throw new Error('ffprobe verification failed');
  const parsed = JSON.parse(result.stdout || '{}');
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  if (!video) throw new Error('rendered file has no video stream');
  return {
    width: Number(video.width || 0),
    height: Number(video.height || 0),
    durationSeconds: Number(parsed.format?.duration || 0),
    videoCodec: video.codec_name || null,
    audioCodec: audio?.codec_name || null,
  };
}

export async function renderChiefVideo(input) {
  const invalid = validate(input);
  if (invalid) return { kind: 'REJECTED', reason: invalid };

  const capability = await probeChiefVideoRenderer();
  if (!capability.available) {
    return { kind: 'CAPABILITY_UNAVAILABLE', reason: 'ffmpeg and ffprobe binaries are required on PATH' };
  }

  const width = safeInt(input.width, 1080, 320, MAX_WIDTH);
  const height = safeInt(input.height, 1920, 320, MAX_HEIGHT);
  const fps = safeInt(input.fps, 30, 12, 60);
  const durationSeconds = safeNumber(input.durationSeconds, 6, 1, MAX_DURATION_SECONDS);
  if (width % 2 !== 0 || height % 2 !== 0) return { kind: 'REJECTED', reason: 'width and height must be even' };

  await mkdir(dirname(input.outputPath), { recursive: true });
  const filter = motionFilter({ width, height, fps, movement: String(input.movement || 'push_in') });
  const args = [
    '-nostdin', '-y',
    '-loop', '1', '-i', input.imagePath,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-t', String(durationSeconds),
    '-vf', filter,
    '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-shortest',
    '-movflags', '+faststart',
    input.outputPath,
  ];

  const rendered = await run('ffmpeg', args, 180_000);
  if (rendered.code !== 0 || !existsSync(input.outputPath)) {
    return { kind: 'FAILED', code: 'FFMPEG_EXIT', safeMessage: 'Chief video render failed' };
  }

  try {
    const [outputStat, inputSha256, outputSha256, probe] = await Promise.all([
      stat(input.outputPath),
      sha256File(input.imagePath),
      sha256File(input.outputPath),
      probeOutput(input.outputPath),
    ]);
    if (probe.width !== width || probe.height !== height) throw new Error('dimension mismatch');
    if (Math.abs(probe.durationSeconds - durationSeconds) > 0.5) throw new Error('duration mismatch');

    return {
      kind: 'RENDERED',
      renderer: CHIEF_VIDEO_RENDERER,
      outputPath: input.outputPath,
      bytes: outputStat.size,
      sha256: outputSha256,
      sourceSha256: inputSha256,
      movement: String(input.movement || 'push_in'),
      width,
      height,
      fps,
      durationSeconds: probe.durationSeconds,
      videoCodec: probe.videoCodec,
      audioCodec: probe.audioCodec,
      ffmpegVersion: capability.ffmpegVersion,
      ffprobeVersion: capability.ffprobeVersion,
      publishAuthority: false,
    };
  } catch {
    return { kind: 'FAILED', code: 'FFPROBE_VERIFY', safeMessage: 'Chief video render could not be verified' };
  }
}
