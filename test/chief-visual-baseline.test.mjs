import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
describe('CHIEF shared visual baseline', () => {
  it.each(['index.html', 'app.html', 'public-face.html'])('uses the approved crown and viewport contract in %s', path => {
    const html = read(path);
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('M5 13l8 8 9-15');
    expect(html).toContain(path === 'app.html' ? 'chief-brand-workspace' : 'chief-brand-public');
  });
  it('loads shared styling without replacing the workspace entrypoint', () => {
    const html = read('app.html');
    expect(html).toContain('./styles/chief-visual-baseline.css');
    expect(html).toContain('src="./src/main.js"');
    for (const page of ['goals','brain','library','builder','freestyle','custom','anatomy','bench']) {
      expect(html).toContain('data-page="' + page + '"');
    }
  });
  it('preserves the script-free front door and its security headers', () => {
    const worker = read('front-door/worker.mjs');
    expect(worker).toContain('chief-brand-public');
    expect(worker).toContain('viewport-fit=cover');
    expect(worker).toContain('M5 13l8 8 9-15');
    expect(worker).toContain("script-src 'none'");
    expect(worker).toContain("form-action 'none'");
  });
  it('supports responsive layouts, reduced motion and transparency', () => {
    const css = read('styles/chief-visual-baseline.css');
    for (const rule of ['minmax(0,1fr)','safe-area-inset-top','prefers-reduced-motion','prefers-reduced-transparency']) expect(css).toContain(rule);
  });
});
