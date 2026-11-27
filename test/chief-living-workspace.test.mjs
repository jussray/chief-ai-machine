import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('CHIEF living workspace presentation contract', () => {
  it('renders local decorative scenery and an honest specialist presence alongside the real goal form', () => {
    const html = read('app.html');
    expect(html).toContain('class="chief-living-scene" aria-hidden="true"');
    expect(html).toContain('id="chief-scene-pause"');
    expect(html).toContain('id="chief-specialist-presence"');
    expect(html).toContain('Live character connection pending');
    expect(html).toContain('id="goalForm"');
    expect(html).toContain('src="./src/main.js"');
  });

  it('supports pause, reduced motion and reduced transparency without external assets', () => {
    const css = read('styles/chief-living-workspace.css');
    expect(css).toContain('pointer-events:none');
    expect(css).toContain('animation-play-state:paused');
    expect(css).toContain('prefers-reduced-motion:reduce');
    expect(css).toContain('prefers-reduced-transparency:reduce');
    expect(css).not.toContain('url(');
  });
});
