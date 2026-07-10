import { showToast, copyText } from './ui.js';

export function initLibrary(PROMPTS, modal) {
  const grid = document.getElementById('grid');
  const chips = document.getElementById('chips');
  const search = document.getElementById('search');
  const countPill = document.getElementById('countPill');
  const navCount = document.getElementById('navCount');
  const statTotal = document.getElementById('statTotal');
  const statStar = document.getElementById('statStar');
  const statCustom = document.getElementById('statCustom');
  const statPlatforms = document.getElementById('statPlatforms');
  const repoClear = document.getElementById('repoClear');
  const repoBtns = document.querySelectorAll('[data-repo]');

  let stars = JSON.parse(localStorage.getItem('chief-stars') || '[]');
  let custom = JSON.parse(localStorage.getItem('chief-custom') || '[]');
  const customMapped = custom.map((c, i) => ({ ...c, id: 'c' + i, cat: c.cat || 'custom' }));
  let allPrompts = [...PROMPTS, ...customMapped];
  let activeFilter = null;
  let activeRepo = null;
  let searchQuery = '';

  const CATS = [...new Set(allPrompts.map(p => p.cat))];
  const PLATFORMS = [...new Set(allPrompts.flatMap(p => p.platforms || []))];

  function buildChips() {
    chips.innerHTML = '';
    const makeChip = (label, key, cls) => {
      const btn = document.createElement('button');
      btn.className = 'chip' + (activeFilter === key ? ' active' : '') + (cls ? ' ' + cls : '');
      btn.textContent = label;
      btn.addEventListener('click', () => { activeFilter = activeFilter === key ? null : key; render(); buildChips(); });
      chips.appendChild(btn);
    };
    makeChip('All', null);
    makeChip('★ Starred', '__star', 'c-star');
    const sep = document.createElement('div'); sep.className = 'chip-sep'; chips.appendChild(sep);
    CATS.forEach(cat => makeChip(cat, cat));
  }

  function filtered() {
    let list = allPrompts;
    if (activeRepo) list = list.filter(p => (p.repos || []).includes(activeRepo));
    if (activeFilter === '__star') list = list.filter(p => stars.includes(p.id));
    else if (activeFilter) list = list.filter(p => p.cat === activeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => [p.title, p.sub, p.notes, p.cat].some(s => s?.toLowerCase().includes(q)));
    }
    return list;
  }

  function render() {
    const list = filtered();
    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = '<div class="empty">No prompts match. Try a different filter or search.</div>';
    } else {
      list.forEach(p => grid.appendChild(makeCard(p)));
    }
    const count = list.length;
    if (countPill) countPill.textContent = count + ' prompt' + (count !== 1 ? 's' : '');
    if (navCount) navCount.textContent = count;
    if (statTotal) statTotal.textContent = allPrompts.length;
    if (statStar) statStar.textContent = stars.length;
    if (statCustom) statCustom.textContent = custom.length;
    if (statPlatforms) statPlatforms.textContent = PLATFORMS.length;
  }

  function makeCard(p) {
    const card = document.createElement('div');
    card.className = 'pcard';
    const platforms = (p.platforms || []).map(pl => `<span class="badge">${pl}</span>`).join('');
    const starred = stars.includes(p.id);
    const versions = Object.keys(p.versions || {});
    card.innerHTML = `
      <div class="top">
        <span class="emoji">${p.emoji || '💬'}</span>
        <div style="min-width:0;flex:1"><h3>${p.title}</h3><div class="sub">${p.sub || ''}</div></div>
        <button class="star-btn${starred ? ' on' : ''}" data-id="${p.id}">${starred ? '★' : '☆'}</button>
      </div>
      <div class="badges"><span class="badge cat">${p.cat}</span>${platforms}</div>
      ${p.notes ? `<div class="snippet">${p.notes}</div>` : ''}
      <div class="foot">
        <span class="kind">${versions.length} version${versions.length !== 1 ? 's' : ''}</span>
        <button class="mini-btn">Open →</button>
      </div>
    `;
    card.querySelector('.star-btn').addEventListener('click', e => {
      e.stopPropagation();
      const idx = stars.indexOf(p.id);
      if (idx === -1) stars.push(p.id); else stars.splice(idx, 1);
      localStorage.setItem('chief-stars', JSON.stringify(stars));
      render();
    });
    card.querySelector('.mini-btn').addEventListener('click', e => { e.stopPropagation(); modal.open(p); });
    card.addEventListener('click', () => modal.open(p));
    return card;
  }

  repoBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeRepo = activeRepo === btn.dataset.repo ? null : btn.dataset.repo;
      repoBtns.forEach(b => b.classList.toggle('active', b.dataset.repo === activeRepo));
      if (repoClear) repoClear.hidden = !activeRepo;
      render();
    });
  });
  repoClear?.addEventListener('click', () => {
    activeRepo = null;
    repoBtns.forEach(b => b.classList.remove('active'));
    if (repoClear) repoClear.hidden = true;
    render();
  });

  search?.addEventListener('input', e => { searchQuery = e.target.value; render(); });

  buildChips();
  render();
}
