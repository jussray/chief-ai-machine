import { showToast } from './ui.js';

export function initCustom(PROMPTS, modal) {
  const titleEl = document.getElementById('cTitle');
  const subEl = document.getElementById('cSub');
  const catEl = document.getElementById('cCat');
  const platformsEl = document.getElementById('cPlatforms');
  const bodyEl = document.getElementById('cBody');
  const list = document.getElementById('customList');
  let custom = JSON.parse(localStorage.getItem('chief-custom') || '[]');

  function render() {
    list.innerHTML = '';
    if (!custom.length) { list.innerHTML = '<div class="empty" style="border:none;padding:16px 0">No custom prompts yet.</div>'; return; }
    custom.forEach((p, i) => {
      const item = document.createElement('div'); item.className = 'citem';
      item.innerHTML = `<div class="row"><strong>${p.title || 'Untitled'}</strong><span class="badge cat" style="margin-left:auto">${p.cat || 'custom'}</span><button class="mini-btn" data-del="${i}" style="margin-left:8px">Delete</button></div><div style="font-size:12px;color:var(--text-muted);margin-top:4px">${p.sub || ''}</div>`;
      item.querySelector('[data-del]').addEventListener('click', (e) => { e.stopPropagation(); custom.splice(i, 1); localStorage.setItem('chief-custom', JSON.stringify(custom)); render(); showToast('Deleted.'); });
      item.addEventListener('click', () => modal.open(p));
      list.appendChild(item);
    });
    const nc = document.getElementById('navCustom'); if (nc) nc.textContent = custom.length;
  }

  document.getElementById('saveCustom')?.addEventListener('click', () => {
    const title = titleEl?.value?.trim(); const body = bodyEl?.value?.trim();
    if (!title || !body) { showToast('Title and body required.'); return; }
    const platforms = (platformsEl?.value || 'chatgpt').split(',').map(s => s.trim()).filter(Boolean);
    const versions = {}; platforms.forEach(p => { versions[p] = body; });
    custom.push({ id: 'custom-' + Date.now(), title, sub: subEl?.value?.trim() || '', cat: catEl?.value || 'custom', platforms, versions, emoji: '✨' });
    localStorage.setItem('chief-custom', JSON.stringify(custom));
    render(); showToast('Saved!');
    [titleEl, subEl, platformsEl, bodyEl].forEach(el => { if (el) el.value = ''; });
  });

  render();
}
