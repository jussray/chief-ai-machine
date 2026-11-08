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
  let allPrompts = [...PROMPTS, ...custom.map((c, i) => ({ ...c, id: 'c' + i, cat: c.cat || 'custom' }))];
  let activeFilter = null;
  let activeRepo = null;
  let searchQuery = '';

  const CATS = [...new Set(allPrompts.map(p => p.cat))];
  const PLATFORMS = [...new Set(allPrompts.flatMap(p => p.platforms || []))];

  function buildChips() {
    chips.innerHTML = '';
    const all = document.createElement('button');
    all.className = 'chip' + (!activeFilter ? ' active' : '');
    all.textContent = 'All';
    all.addEventListener('click', () => { activeFilter = null; render(); buildChips(); });
    chips.appendChild(all);
    const starChip = document.createElement('button');
    starChip.className = 'chip c-star' + (activeFilter === '__star' ? ' active' : '');
    starChip.textContent = '★ Starred';
    starChip.addEventListener('click', () => { activeFilter = activeFilter === '__star' ? null : '__star'; render(); buildChips(); });
    chips.appendChild(starChip);
    const sep = document.createElement('div'); sep.className = 'chip-sep'; chips.appendChild(sep);
    CATS.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'chip' + (activeFilter === cat ? ' active' : '');
      btn.textContent = cat;
      btn.addEventListener('click', () => { activeFilter = activeFilter === cat ? null : cat; render(); buildChips(); });
      chips.appendChild(btn);
    });
  }

  function filtered() {
    let list = allPrompts;
    if (activeRepo) list = list.filter(p => (p.repos || []).includes(activeRepo));
    if (activeFilter === '__star') list = list.filter(p => stars.includes(p.id));
    else if (activeFilter) list = list.filter(p => p.cat === activeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.title?.toLowerCase().includes(q) || p.sub?.toLowerCase().includes(q) || p.notes?.toLowerCase().includes(q) || p.cat?.toLowerCase().includes(q));
    }
    return list;
  }

  function render() {
    const list = filtered();
    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = '<div class="empty">No prompts match. Try a different filter.</div>';
    } else {
      list.forEach(p => grid.appendChild(makeCard(p)));
    }
    const count = list.length;
    countPill.textContent = count + ' prompt' + (count !== 1 ? 's' : '');
    navCount.textContent = count;
    statTotal.textContent = allPrompts.length;
    statStar.textContent = stars.length;
    statCustom.textContent = custom.length;
    statPlatforms.textContent = PLATFORMS.length;
  }

  function makeCard(p) {
    const card = document.createElement('div');
    card.className = 'pcard';
    const platforms = (p.platforms || []).map(pl => `<span class="badge">${pl}</span>`).join('');
    const starred = stars.includes(p.id);
    const vcount = Object.keys(p.versions || {}).length;
    card.innerHTML = `
      <div class="top">
        <span class="emoji">${p.emoji || '💬'}</span>
        <div style="min-width:0;flex:1"><h3>${p.title}</h3><div class="sub">${p.sub || ''}</div></div>
        <button class="star-btn ${starred ? 'on' : ''}" data-id="${p.id}">${starred ? '★' : '☆'}</button>
      </div>
      <div class="badges"><span class="badge cat">${p.cat}</span>${platforms}</div>
      ${p.notes ? `<div class="snippet">${p.notes}</div>` : ''}
      <div class="foot"><span class="kind">${vcount} version${vcount !== 1 ? 's' : ''}</span><button class="mini-btn push">Open →</button></div>`;
    card.querySelector('.star-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = stars.indexOf(p.id);
      if (idx === -1) stars.push(p.id); else stars.splice(idx, 1);
      localStorage.setItem('chief-stars', JSON.stringify(stars));
      render();
    });
    card.querySelector('.mini-btn').addEventListener('click', (e) => { e.stopPropagation(); modal.open(p); });
    card.addEventListener('click', () => modal.open(p));
    return card;
  }

  repoBtns.forEach(btn => btn.addEventListener('click', () => {
    const repo = btn.dataset.repo;
    activeRepo = activeRepo === repo ? null : repo;
    repoBtns.forEach(b => b.classList.toggle('active', b.dataset.repo === activeRepo));
    repoClear.hidden = !activeRepo;
    render();
  }));
  repoClear?.addEventListener('click', () => {
    activeRepo = null;
    repoBtns.forEach(b => b.classList.remove('active'));
    repoClear.hidden = true;
    render();
  });

  search?.addEventListener('input', (e) => { searchQuery = e.target.value; render(); });
  buildChips();
  render();
}
