import { showToast, copyText } from './ui.js';

export function initFreestyle(PROMPTS, modal) {
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

  function getCheckedPlatforms() {
    return [...document.querySelectorAll('#page-freestyle .pcheck input:checked')].map(el => el.value);
  }

  function inferCat(text) {
    const t = text.toLowerCase();
    if (t.includes('shopify') || t.includes('store') || t.includes('jbh') || t.includes('ecom')) return 'shopify';
    if (t.includes('launch') || t.includes('ship') || t.includes('release')) return 'shipping';
    if (t.includes('ooda') || t.includes('lindy') || t.includes('strategy') || t.includes('roadmap')) return 'strategy';
    if (t.includes('red team') || t.includes('abuse') || t.includes('attack') || t.includes('redteam')) return 'redteam';
    if (t.includes('ad') || t.includes('campaign') || t.includes('growth') || t.includes('market')) return 'growth';
    if (t.includes('audit') || t.includes('debug') || t.includes('fix') || t.includes('repo') || t.includes('bip')) return 'coding';
    return 'research';
  }

  function generate() {
    const ask = askEl?.value?.trim();
    if (!ask) return;
    const platforms = getCheckedPlatforms();
    const cat = inferCat(ask);
    const matches = PROMPTS.filter(p => p.cat === cat && p.platforms?.some(pl => platforms.includes(pl)));
    const base = matches[0] || PROMPTS.find(p => p.platforms?.some(pl => platforms.includes(pl))) || PROMPTS[0];
    const available = (base.platforms || []).filter(pl => platforms.includes(pl));
    if (!available.length) { showToast('No matching prompt for selected platforms.'); return; }

    currentResult = base;
    currentPlatform = available[0];

    if (fsEmoji) fsEmoji.textContent = base.emoji || '💬';
    if (fsTitle) fsTitle.textContent = base.title;
    if (fsSub) fsSub.textContent = base.sub || '';
    if (fsBadges) fsBadges.innerHTML = `<span class="badge cat">${base.cat}</span>` + available.map(p => `<span class="badge">${p}</span>`).join('');

    if (fsTabs) {
      fsTabs.innerHTML = '';
      available.forEach((p, i) => {
        const btn = document.createElement('button');
        btn.className = 'ptab' + (i === 0 ? ' active' : '');
        btn.textContent = p.charAt(0).toUpperCase() + p.slice(1);
        btn.addEventListener('click', () => {
          fsTabs.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentPlatform = p;
          if (fsBody) fsBody.textContent = base.versions[p] || '';
        });
        fsTabs.appendChild(btn);
      });
    }

    if (fsBody) fsBody.textContent = base.versions[currentPlatform] || '';
    if (placeholder) placeholder.style.display = 'none';
    if (preview) preview.classList.add('on');
  }

  document.getElementById('fsGenerate')?.addEventListener('click', generate);
  askEl?.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') generate(); });

  document.getElementById('fsClear')?.addEventListener('click', () => {
    if (askEl) askEl.value = '';
    if (preview) preview.classList.remove('on');
    if (placeholder) placeholder.style.display = '';
    currentResult = null;
  });

  document.getElementById('fsCopyBtn')?.addEventListener('click', () => {
    if (currentResult && currentPlatform) { copyText(currentResult.versions[currentPlatform]); showToast('Copied!'); }
  });

  document.getElementById('fsSave')?.addEventListener('click', () => {
    if (!currentResult) return;
    const custom = JSON.parse(localStorage.getItem('chief-custom') || '[]');
    custom.push({ ...currentResult, id: 'fs-' + Date.now() });
    localStorage.setItem('chief-custom', JSON.stringify(custom));
    showToast('Saved to My Prompts!');
  });

  document.getElementById('fsRegenerate')?.addEventListener('click', generate);
}
