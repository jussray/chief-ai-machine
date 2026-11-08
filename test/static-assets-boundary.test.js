import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function ruleSet(path) {
  return new Set(
    readFileSync(path, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')),
  );
}

describe('Worker static asset boundary', () => {
  it('excludes repository, governance, provider, test, and secret material from root asset upload', () => {
    const ignored = ruleSet('.assetsignore');
    const required = [
      '.git/',
      '**/.git',
      '.wrangler/',
      '.env',
      '.env.*',
      '.dev.vars',
      '.dev.vars.*',
      '**/*.pem',
      '**/*.key',
      '**/*.p12',
      '**/*.pfx',
      '**/*.jks',
      '**/*.keystore',
      '**/*.sqlite',
      '**/*.db',
      'CLAUDE.md',
      'CHATGPT.md',
      'PERPLEXITY.md',
      'AGENTS.md',
      'AGENTS_FOUNDER_INTELLIGENCE.md',
      'README.md',
      'PUBLIC_FACE.md',
      'SITES.md',
      'control-room.manifest.json',
      'docs/',
      'global/',
      'worker/',
      'plugins/',
      'security/',
      'testdata/',
      '.github/',
      'scripts/',
      'e2e/',
      'tools/',
      'config/',
      '.control-room/',
      '.claude/',
      '.cursor/',
      '.vscode/',
      '.security/',
      '.mcp.json',
      '.mcp.example.json',
      '.agents/',
    ];

    for (const path of required) {
      expect(ignored.has(path), `missing .assetsignore boundary for ${path}`).toBe(true);
    }
  });

  it('keeps only the browser carriers needed by the current root-hosted SPA unblocked', () => {
    const ignored = ruleSet('.assetsignore');
    for (const publicCarrier of ['index.html', 'public-face.html', 'src/', 'styles/']) {
      expect(ignored.has(publicCarrier), `${publicCarrier} must remain deployable`).toBe(false);
    }
  });

  it('keeps common local secret material out of Git before packaging can see it', () => {
    const ignored = ruleSet('.gitignore');
    for (const path of [
      '.env',
      '.env.*',
      '.dev.vars',
      '.dev.vars.*',
      '*.pem',
      '*.key',
      '*.p12',
      '*.pfx',
      '*.jks',
      '*.keystore',
      '*.sqlite',
      '*.db',
    ]) {
      expect(ignored.has(path), `missing .gitignore boundary for ${path}`).toBe(true);
    }
  });
});
