/* global document */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';

const i = process.argv.indexOf('--media');
const mediaPath = i >= 0 ? process.argv[i + 1] : null;
if (!mediaPath) throw new Error('usage: node scripts/verify-video-playback.mjs --media <mp4>');
const media = await readFile(mediaPath);
const sha256 = createHash('sha256').update(media).digest('hex');
const server = createServer((req, res) => {
  if (req.url === '/video.mp4') {
    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (!match) return res.writeHead(416, { 'Content-Range': `bytes */${media.length}` }).end();
      const start = Number(match[1]);
      const end = Math.min(match[2] ? Number(match[2]) : media.length - 1, media.length - 1);
      res.writeHead(206, { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${media.length}`, 'Content-Length': end - start + 1 });
      return res.end(media.subarray(start, end + 1));
    }
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': media.length, 'Accept-Ranges': 'bytes' });
    return res.end(media);
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><video id="proof" src="/video.mp4" muted playsinline controls></video>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const video = globalThis.document.querySelector('#proof');
    return video && video.readyState >= 3 && Number.isFinite(video.duration) && video.duration > 0;
  }, null, { timeout: 15000 });
  const before = await page.locator('#proof').evaluate((video) => ({ currentTime: video.currentTime, duration: video.duration, width: video.videoWidth, height: video.videoHeight, readyState: video.readyState }));
  await page.locator('#proof').evaluate((video) => video.play());
  await page.waitForTimeout(900);
  const after = await page.locator('#proof').evaluate((video) => ({ currentTime: video.currentTime, readyState: video.readyState, paused: video.paused }));
  const pass = before.readyState >= 3 && after.readyState >= 3 && after.currentTime > before.currentTime + 0.2;
  console.log(JSON.stringify({ schema: 'chief-ai-machine/video-playback-proof@v1', pass, mediaPath, sha256, before, after, publishAuthority: false }, null, 2));
  if (!pass) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
