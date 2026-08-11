import { renderPromptVariant } from '../domain/evidence-first-prompt.js';
import { showToast, copyText } from './ui.js';

const PROMPT_PACK_PREFIX = 'prompt:';

export function selectBuilderPrompt(PROMPTS, pack, platform) {
  const promptId = String(pack || '').startsWith(PROMPT_PACK_PREFIX)
    ? String(pack).slice(PROMPT_PACK_PREFIX.length)
    : '';
  if (promptId) {
    return PROMPTS.find(prompt => prompt.id === promptId && prompt.platforms?.includes(platform)) || null;
  }
  return PROMPTS.find(prompt => prompt.cat === pack && prompt.platforms?.includes(platform)) || null;
}

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
    const selected = selectBuilderPrompt(PROMPTS, pack, platform);
    if (!selected) { out.textContent = `No prompt for pack "${pack}" on ${platform}. Try a different combo.`; return; }
    out.textContent = renderPromptVariant(selected, platform, {
      REPO: repo,
      'OWNER/REPO': repo,
      TASK: task,
      CONSTRAINTS: constraints,
    });
  }

  [packEl, platformEl, repoEl, taskEl, constraintsEl].forEach(el => el?.addEventListener('input', build));

  document.getElementById('copyBuilder')?.addEventListener('click', () => {
    const text = out.textContent; if (text) { copyText(text); showToast('Copied!'); }
  });
  document.getElementById('saveBuilder')?.addEventListener('click', () => {
    const text = out.textContent; if (!text) return;
    const custom = JSON.parse(localStorage.getItem('chief-custom') || '[]');
    custom.push({ id: 'b-' + Date.now(), title: 'Builder: ' + (packEl?.selectedOptions?.[0]?.textContent || packEl?.value || 'prompt'), sub: 'Saved from Builder', cat: 'custom', platforms: [platformEl?.value || 'chatgpt'], versions: { [platformEl?.value || 'chatgpt']: text } });
    localStorage.setItem('chief-custom', JSON.stringify(custom));
    showToast('Saved to My Prompts!');
  });

  build();
}