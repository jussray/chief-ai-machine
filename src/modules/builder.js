import { showToast, copyText } from './ui.js';

export function initBuilder(PROMPTS) {
  const packEl = document.getElementById('bPack');
  const platformEl = document.getElementById('bPlatform');
  const repoEl = document.getElementById('bRepo');
  const taskEl = document.getElementById('bTask');
  const constraintsEl = document.getElementById('bConstraints');
  const out = document.getElementById('builderOut');

  function build() {
    const pack = packEl?.value || 'coding';
    const platform = platformEl?.value || 'chatgpt';
    const repo = repoEl?.value || '[REPO]';
    const task = taskEl?.value || '[TASK]';
    const constraints = constraintsEl?.value || '[CONSTRAINTS]';
    const matches = PROMPTS.filter(p => p.cat === pack && p.versions?.[platform]);
    if (!matches.length) {
      out.textContent = `No prompts found for pack "${pack}" on ${platform}. Try a different combination.`;
      return;
    }
    let text = matches[0].versions[platform];
    text = text.replaceAll('[REPO]', repo).replaceAll('[TASK]', task).replaceAll('[CONSTRAINTS]', constraints);
    out.textContent = text;
  }

  [packEl, platformEl, repoEl, taskEl, constraintsEl].forEach(el => el?.addEventListener('input', build));

  document.getElementById('copyBuilder')?.addEventListener('click', () => {
    const text = out?.textContent;
    if (text) { copyText(text); showToast('Copied!'); }
  });

  document.getElementById('saveBuilder')?.addEventListener('click', () => {
    const text = out?.textContent;
    if (!text || text.startsWith('No prompts')) return;
    const custom = JSON.parse(localStorage.getItem('chief-custom') || '[]');
    custom.push({ id: 'b-' + Date.now(), title: 'Builder: ' + (packEl?.value || 'prompt'), sub: 'Saved from Builder', cat: packEl?.value || 'custom', platforms: [platformEl?.value || 'chatgpt'], versions: { [platformEl?.value || 'chatgpt']: text }, emoji: '🛠' });
    localStorage.setItem('chief-custom', JSON.stringify(custom));
    showToast('Saved to My Prompts!');
  });

  build();
}
