import { normalizeCustomPrompts } from '../domain/intelligence.js';

function makeTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = String(text ?? '');
  return element;
}

function readCustomPromptStorage() {
  let raw;
  try {
    raw = localStorage.getItem('chief-custom');
  } catch {
    return { state: 'unavailable', prompts: [] };
  }
  if (raw === null) return { state: 'ready', prompts: [] };

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { state: 'corrupt', prompts: [] };
    const prompts = normalizeCustomPrompts(parsed);
    if (prompts.length !== parsed.length) return { state: 'corrupt', prompts: [] };
    return { state: 'ready', prompts };
  } catch {
    return { state: 'corrupt', prompts: [] };
  }
}

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
  const customRead = readCustomPromptStorage();
  let custom = customRead.prompts;
  let allPrompts = [...PROMPTS, ...custom.map((c, i) => ({ ...c, id: 'c' + i, cat: c.cat || 'custom' }))];
  let activeFilter = null;
  let activeRepo = null;
  let searchQuery = '';

  const CATS = [...new Set(allPrompts.map(p => p.cat))];
  const PLATFORMS = [...new Set(allPrompts.flatMap(p => p.platforms || []))];

  function buildChips() {
    chips.replaceChildren();
    const all = makeTextElement('button', 'chip' + (!activeFilter ? ' active' : ''), 'All');
    all.addEventListener('click', () => { activeFilter = null; render(); buildChips(); });
    chips.appendChild(all);

    const starChip = makeTextElement('button', 'chip c-star' + (activeFilter === '__star' ? ' active' : ''), '★ Starred');
    starChip.addEventListener('click', () => { activeFilter = activeFilter === '__star' ? null : '__star'; render(); buildChips(); });
    chips.appendChild(starChip);

    const sep = document.createElement('div');
    sep.className = 'chip-sep';
    chips.appendChild(sep);

    CATS.forEach(cat => {
      const btn = makeTextElement('button', 'chip' + (activeFilter === cat ? ' active' : ''), cat);
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
    grid.replaceChildren();
    if (!list.length) {
      grid.appendChild(makeTextElement('div', 'empty', 'No prompts match. Try a different filter.'));
    } else {
      list.forEach(p => grid.appendChild(makeCard(p)));
    }
    const count = list.length;
    countPill.textContent = count + ' prompt' + (count !== 1 ? 's' : '');
    navCount.textContent = count;
    statTotal.textContent = allPrompts.length;
    statStar.textContent = stars.length;
    statCustom.textContent = customRead.state === 'ready' ? String(custom.length) : '?';
    statCustom.title = customRead.state === 'ready'
      ? ''
      : 'Saved custom prompt state is UNKNOWN and has not been treated as empty.';
    statPlatforms.textContent = PLATFORMS.length;
  }

  function makeCard(p) {
    const card = document.createElement('div');
    card.className = 'pcard';
    const starred = stars.includes(p.id);
    const vcount = Object.keys(p.versions || {}).length;

    const top = document.createElement('div');
    top.className = 'top';
    top.appendChild(makeTextElement('span', 'emoji', p.emoji || '💬'));

    const heading = document.createElement('div');
    heading.style.minWidth = '0';
    heading.style.flex = '1';
    heading.append(
      makeTextElement('h3', '', p.title || 'Untitled'),
      makeTextElement('div', 'sub', p.sub || ''),
    );
    top.appendChild(heading);

    const starButton = makeTextElement('button', `star-btn${starred ? ' on' : ''}`, starred ? '★' : '☆');
    starButton.dataset.id = String(p.id ?? '');
    top.appendChild(starButton);

    const badges = document.createElement('div');
    badges.className = 'badges';
    badges.appendChild(makeTextElement('span', 'badge cat', p.cat || 'custom'));
    (p.platforms || []).forEach((platform) => {
      badges.appendChild(makeTextElement('span', 'badge', platform));
    });

    card.append(top, badges);
    if (p.notes) card.appendChild(makeTextElement('div', 'snippet', p.notes));

    const foot = document.createElement('div');
    foot.className = 'foot';
    foot.appendChild(makeTextElement('span', 'kind', `${vcount} version${vcount !== 1 ? 's' : ''}`));
    const openButton = makeTextElement('button', 'mini-btn push', 'Open →');
    foot.appendChild(openButton);
    card.appendChild(foot);

    starButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = stars.indexOf(p.id);
      if (idx === -1) stars.push(p.id); else stars.splice(idx, 1);
      localStorage.setItem('chief-stars', JSON.stringify(stars));
      render();
    });
    openButton.addEventListener('click', (e) => { e.stopPropagation(); modal.open(p); });
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