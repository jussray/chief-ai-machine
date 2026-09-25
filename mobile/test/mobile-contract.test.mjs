import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createIntelligenceAsset,
  createPortableSnapshot,
  parsePortableSnapshot,
  validateIntelligenceAsset,
} from '../../src/domain/intelligence.js';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const screen = read('mobile/app/index.js');
const config = JSON.parse(read('mobile/app.json'));
const agents = read('AGENTS.md');

test('mobile reuses canonical founder-intelligence schema', () => {
  const asset = createIntelligenceAsset({
    title: 'Mobile contract proof',
    content: 'local founder-authored content',
    kind: 'workflow',
    source: 'chief-mobile-contract-test',
  }, new Date('2026-09-25T00:00:00.000Z'));

  assert.equal(validateIntelligenceAsset(asset).valid, true);
  const snapshot = createPortableSnapshot({ assets: [asset], exportedAt: '2026-09-25T00:00:00.000Z' });
  const parsed = parsePortableSnapshot(snapshot, new Date('2026-09-25T00:00:00.000Z'));
  assert.equal(parsed.assets.length, 1);
  assert.equal(parsed.assets[0].id, asset.id);
});

test('native carrier contains no provider execution or bundled proprietary prompt catalog', () => {
  assert.match(screen, /from '\.\.\/\.\.\/src\/domain\/intelligence\.js'/);
  assert.match(screen, /Share\.share/);
  assert.match(screen, /expo-haptics/);
  assert.doesNotMatch(screen, /fetch\(|WebSocket|OPENAI_API_KEY|ANTHROPIC|GEMINI|PERPLEXITY|MODEL_API_KEY/i);
  assert.doesNotMatch(screen, /src\/data|PROMPTS|prompt-data|react-native-webview|WebView/i);
});

test('store identifier remains blocked until exact founder approval', () => {
  assert.equal(config.expo.ios.bundleIdentifier, undefined);
  assert.equal(config.expo.android.package, undefined);
  assert.match(agents, /app identifier, signing, or production environment changes/);
  assert.match(screen, /no approved store identifier yet/i);
});

test('mobile cannot manufacture FCR or publication authority', () => {
  assert.doesNotMatch(screen, /\/mcp|\/approvals|merge|deploy|publish|service[_-]?role|admin/i);
  assert.match(screen, /no FCR mutation authority/i);
  assert.match(screen, /Sharing is a user-triggered export/i);
});
