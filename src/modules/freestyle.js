import { renderPromptVariant } from '../domain/evidence-first-prompt.js';
import { showToast, copyText } from './ui.js';
import {
  CUSTOM_PROMPTS_UPDATED_EVENT,
  createLocalPromptId,
  readStoredArray,
  writeCustomPrompts,
} from './prompt-state.js';

export { CUSTOM_PROMPTS_UPDATED_EVENT };

const GOALFIX_FREESTYLE_ROUTES = [
  {
    id: 'goalfix-v1-friend-mode',
    pattern: /\b(friend mode|tell tales|raw rant|rant|tiny move)\b/i,
  },
  {
    id: 'goalfix-v1-creative-director',
    pattern: /\b(image edit|edit this image|photo edit|background replacement|studio-quality|cinematic|infographic|thumbnail)\b/i,
  },
  {
    id: 'goalfix-v1-verified-loop',
    pattern: /(?:^|\s)\/goalfix\b|\bgoalfix\b|\bfinish line\b|\bbottleneck\b/i,
  },
];

export function normalizePromptVersionsForSave(prompt) {
  const platforms = [
    ...new Set([
      ...(prompt?.platforms || []),
      ...Object.keys(prompt?.versions || {}),
    ]),
  ];

  return Object.fromEntries(
    platforms.map((platform) => [
      platform,
      renderPromptVariant(prompt, platform),
    ]),
  );
}

function inferCat(text) {
  const t = text.toLowerCase();
  if (t.includes('shopify') || t.includes('store') || t.includes('jbh')) return 'shopify';
  if (t.includes('launch') || t.includes('ship') || t.includes('release')) return 'shipping';
  if (t.includes('ooda') || t.includes('lindy') || t.includes('strategy') || t.includes('roadmap')) return 'strategy';
  if (t.includes('red team') || t.includes('abuse') || t.includes('attack')) return 'redteam';
  if (t.includes('ad') || t.includes('campaign') || t.includes('growth')) return 'growth';
  if (t.includes('persona') || t.includes('act as') || t.includes('talk like') || t.includes('voice of')) return 'persona';
  if (t.includes('audit') || t.includes('debug') || t.includes('fix') || t.includes('repo')) return 'coding';
  return 'research';
}

export function selectFreestylePrompt(PROMPTS, rawText, platforms) {
  const text = String(rawText || '');
  const selectedPlatforms = Array.isArray(platforms) ? platforms : [];

  for (const route of GOALFIX_FREESTYLE_ROUTES) {
    if (!route.pattern.test(text)) continue;
    const prompt = PROMPTS.find(item => item.id === route.id);
    if (prompt?.platforms?.some(platform => selectedPlatforms.includes(platform))) return prompt;
  }

  const cat = inferCat(text);
  return PROMPTS.find(prompt => (
    prompt.cat === cat && prompt.platforms?.some(platform => selectedPlatforms.includes(platform))
  )) || PROMPTS.find(prompt => prompt.platforms?.some(platform => selectedPlatforms.includes(platform))) || PROMPTS[0];
}

export function initFreestyle(PROMPTS) {
  const askEl = document.getElementById('fsAsk');
  const placeholder = document.getElementById('fsPlaceholder');
  const preview = document.getElementById('fsPreview');
  const fsEmoji = document.getElementById('fsEmoji');
  const fsTitle = document.getElementById('fsTitle');
  const fsSub = document.getElementById('fsSub');
  const fsBadges = document.getElementById('fsBadges');
  const fsTabs = document.getElementById('fsTabs');
  const fsBody = document.getElementById('fsBody');

  let currentResult = null;
  let currentPlatform = null;

  function getChecked() {
    return [...document.querySelectorAll('#page-freestyle .pcheck input:checked')].map(el => el.value);
  }

  function renderCurrent() {
    return renderPromptVariant(currentResult, currentPlatform);
  }

  function renderBadges(base, avail) {
    fsBadges.replaceChildren();
    const cat = document.createElement('span');
    cat.className = 'badge cat';
    cat.textContent = base.cat || 'prompt';
    fsBadges.appendChild(cat);
    avail.forEach(platform => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = platform;
      fsBadges.appendChild(badge);
    });
  }

  function generate() {
    const ask = askEl?.value?.trim();
    if (!ask) return;
    const platforms = getChecked();
    const base = selectFreestylePrompt(PROMPTS, ask, platforms);
    const avail = (base.platforms || []).filter(platform => platforms.includes(platform));
    if (!avail.length) {
      showToast('No match for selected platforms.');
      return;
    }

    currentResult = base;
    currentPlatform = avail[0];
    fsEmoji.textContent = base.emoji || '💬';
    fsTitle.textContent = base.title;
    fsSub.textContent = base.sub || '';
    renderBadges(base, avail);
    fsTabs.replaceChildren();

    avail.forEach((platform, index) => {
      const btn = document.createElement('button');
      btn.className = 'ptab' + (index === 0 ? ' active' : '');
      btn.textContent = platform.charAt(0).toUpperCase() + platform.slice(1);
      btn.addEventListener('click', () => {
        fsTabs.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPlatform = platform;
        fsBody.textContent = renderCurrent();
      });
      fsTabs.appendChild(btn);
    });

    fsBody.textContent = renderCurrent();
    placeholder.style.display = 'none';
    preview.classList.add('on');
  }

  document.getElementById('fsGenerate')?.addEventListener('click', generate);
  askEl?.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') generate();
  });
  document.getElementById('fsClear')?.addEventListener('click', () => {
    if (askEl) askEl.value = '';
    preview.classList.remove('on');
    placeholder.style.display = '';
    currentResult = null;
    currentPlatform = null;
  });
  document.getElementById('fsCopy')?.addEventListener('click', async () => {
    if (!currentResult || !currentPlatform) return;
    const copied = await copyText(renderCurrent());
    showToast(copied ? 'Copied!' : 'Copy failed. Select the prompt manually.');
  });
  document.getElementById('fsSave')?.addEventListener('click', () => {
    if (!currentResult) return;
    const custom = readStoredArray('chief-custom');
    custom.push({
      ...currentResult,
      id: createLocalPromptId('freestyle'),
      versions: normalizePromptVersionsForSave(currentResult),
    });
    writeCustomPrompts(custom);
    showToast('Saved to My Prompts!');
  });
  document.getElementById('fsRegenerate')?.addEventListener('click', generate);
}
