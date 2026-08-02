import { renderPromptVariant } from '../domain/evidence-first-prompt.js';
import { showToast, copyText } from './ui.js';

export const CUSTOM_PROMPTS_UPDATED_EVENT = 'chief-custom-updated';

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

  function renderCurrent() {
    return renderPromptVariant(currentResult, currentPlatform);
  }

  function generate() {
    const ask = askEl?.value?.trim(); if (!ask) return;
    const platforms = getChecked();
    const cat = inferCat(ask);
    const matches = PROMPTS.filter(p => p.cat === cat && p.platforms?.some(pl => platforms.includes(pl)));
    const base = matches[0] || PROMPTS.find(p => p.platforms?.some(pl => platforms.includes(pl))) || PROMPTS[0];
    const avail = (base.platforms || []).filter(pl => platforms.includes(pl));
    if (!avail.length) { showToast('No match for selected platforms.'); return; }
    currentResult = base; currentPlatform = avail[0];
    fsEmoji.textContent = base.emoji || '💬';
    fsTitle.textContent = base.title;
    fsSub.textContent = base.sub || '';
    fsBadges.innerHTML = `<span class="badge cat">${base.cat}</span>` + avail.map(p => `<span class="badge">${p}</span>`).join('');
    fsTabs.innerHTML = '';
    avail.forEach((p, i) => {
      const btn = document.createElement('button');
      btn.className = 'ptab' + (i === 0 ? ' active' : '');
      btn.textContent = p.charAt(0).toUpperCase() + p.slice(1);
      btn.addEventListener('click', () => { fsTabs.querySelectorAll('.ptab').forEach(b => b.classList.remove('active')); btn.classList.add('active'); currentPlatform = p; fsBody.textContent = renderCurrent(); });
      fsTabs.appendChild(btn);
    });
    fsBody.textContent = renderCurrent();
    placeholder.style.display = 'none'; preview.classList.add('on');
  }

  document.getElementById('fsGenerate')?.addEventListener('click', generate);
  askEl?.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate(); });
  document.getElementById('fsClear')?.addEventListener('click', () => { if (askEl) askEl.value = ''; preview.classList.remove('on'); placeholder.style.display = ''; });
  document.getElementById('fsCopy')?.addEventListener('click', () => { if (currentResult && currentPlatform) { copyText(renderCurrent()); showToast('Copied!'); } });
  document.getElementById('fsSave')?.addEventListener('click', () => {
    if (!currentResult) return;
    const custom = JSON.parse(localStorage.getItem('chief-custom') || '[]');
    custom.push({
      ...currentResult,
      id: 'fs-' + Date.now(),
      versions: normalizePromptVersionsForSave(currentResult),
    });
    localStorage.setItem('chief-custom', JSON.stringify(custom));
    window.dispatchEvent(new Event(CUSTOM_PROMPTS_UPDATED_EVENT));
    showToast('Saved to My Prompts!');
  });
  document.getElementById('fsRegenerate')?.addEventListener('click', generate);
}
