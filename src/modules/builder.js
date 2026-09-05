import { renderPromptVariant } from '../domain/evidence-first-prompt.js';
import { showToast, copyText } from './ui.js';
import {
  createLocalPromptId,
  readStoredArray,
  writeCustomPrompts,
} from './prompt-state.js';

const PROMPT_PACK_PREFIX = 'prompt:';
const GOALFIX_BUILDER_OPTIONS = [
  ['goalfix-v1-verified-loop', 'Goalfix v1'],
  ['goalfix-v1-friend-mode', 'Friend Mode v1'],
  ['goalfix-v1-creative-director', 'Creative Director v1'],
];

function installGoalfixBuilderOptions(select) {
  if (!select || select.querySelector('optgroup[data-goalfix-v1]')) return;
  const group = document.createElement('optgroup');
  group.label = 'Goalfix v1';
  group.dataset.goalfixV1 = 'true';
  for (const [id, label] of GOALFIX_BUILDER_OPTIONS) {
    const option = document.createElement('option');
    option.value = `${PROMPT_PACK_PREFIX}${id}`;
    option.textContent = label;
    group.appendChild(option);
  }
  select.appendChild(group);
}

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

  installGoalfixBuilderOptions(packEl);

  function build() {
    const pack = packEl?.value || 'coding';
    const platform = platformEl?.value || 'chatgpt';
    const repo = repoEl?.value || '[REPO]';
    const task = taskEl?.value || '[TASK]';
    const constraints = constraintsEl?.value || '[CONSTRAINTS]';
    const selected = selectBuilderPrompt(PROMPTS, pack, platform);
    if (!selected) {
      out.textContent = `No prompt for pack "${pack}" on ${platform}. Try a different combo.`;
      return;
    }
    out.textContent = renderPromptVariant(selected, platform, {
      REPO: repo,
      'OWNER/REPO': repo,
      TASK: task,
      CONSTRAINTS: constraints,
    });
  }

  [packEl, platformEl, repoEl, taskEl, constraintsEl].forEach(el => el?.addEventListener('input', build));

  document.getElementById('copyBuilder')?.addEventListener('click', async () => {
    const text = out.textContent;
    if (!text) return;
    const copied = await copyText(text);
    showToast(copied ? 'Copied!' : 'Copy failed. Select the prompt manually.');
  });

  document.getElementById('saveBuilder')?.addEventListener('click', () => {
    const text = out.textContent;
    if (!text) return;
    const custom = readStoredArray('chief-custom');
    custom.push({
      id: createLocalPromptId('builder'),
      title: 'Builder: ' + (packEl?.selectedOptions?.[0]?.textContent || packEl?.value || 'prompt'),
      sub: 'Saved from Builder',
      cat: 'custom',
      platforms: [platformEl?.value || 'chatgpt'],
      versions: { [platformEl?.value || 'chatgpt']: text },
    });
    writeCustomPrompts(custom);
    showToast('Saved to My Prompts!');
  });

  build();
}
