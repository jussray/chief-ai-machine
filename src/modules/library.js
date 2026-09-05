import {
  CUSTOM_PROMPTS_UPDATED_EVENT,
  STARRED_PROMPTS_UPDATED_EVENT,
  migrateLegacyCustomStarIds,
  normalizeCustomPrompts,
  readStoredArray,
  writeCustomPrompts,
  writeStars,
} from './prompt-state.js';

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

  let stars = [];
  let custom = [];
  let allPrompts = [];
  let activeFilter = null;
  let activeRepo = null;
  let searchQuery = '';

  function sameId(a, b) {
    return String(a) === String(b);
  }

  function isStarred(id) {
    return stars.some(starId => sameId(starId, id));
  }

  function reloadState({ migrate = false } = {}) {
    const normalized = normalizeCustomPrompts(readStoredArray('chief-custom'));
    custom = normalized.prompts;
    if (normalized.changed) writeCustomPrompts(custom);

    stars = readStoredArray('chief-stars');
    if (migrate) {
      const migration = migrateLegacyCustomStarIds(custom, stars);
      stars = migration.stars;
      if (migration.changed) writeStars(stars);
    }

    allPrompts = [...PROMPTS, ...custom.map(prompt => ({
      ...prompt,
      cat: prompt.cat || 'custom',
    }))];
  }

  function categories() {
    return [...new Set(allPrompts.map(p => p.cat).filter(Boolean))];
  }

  function platforms() {
    return [...new Set(allPrompts.flatMap(p => p.platforms || []))];
  }

  function buildChips() {
    chips.replaceChildren();
    const all = document.createElement('button');
    all.className = 'chip' + (!activeFilter ? ' active' : '');
    all.textContent = 'All';
    all.addEventListener('click', () => { activeFilter = null; render(); buildChips(); });
    chips.appendChild(all);

    const starChip = document.createElement('button');
    starChip.className = 'chip c-star' + (activeFilter === '__star' ? ' active' : '');
    starChip.textContent = '★ Starred';
    starChip.addEventListener('click', () => {
      activeFilter = activeFilter === '__star' ? null : '__star';
      render();
      buildChips();
    });
    chips.appendChild(starChip);

    const sep = document.createElement('div');
    sep.className = 'chip-sep';
    chips.appendChild(sep);

    categories().forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'chip' + (activeFilter === cat ? ' active' : '');
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        activeFilter = activeFilter === cat ? null : cat;
        render();
        buildChips();
      });
      chips.appendChild(btn);
    });
  }

  function filtered() {
    let list = allPrompts;
    if (activeRepo) list = list.filter(p => (p.repos || []).includes(activeRepo));
    if (activeFilter === '__star') list = list.filter(p => isStarred(p.id));
    else if (activeFilter) list = list.filter(p => p.cat === activeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => [
        p.title,
        p.sub,
        p.notes,
        p.cat,
        ...(p.platforms || []),
        ...Object.values(p.versions || {}),
      ].some(value => String(value || '').toLowerCase().includes(q)));
    }
    return list;
  }

  function render() {
    const list = filtered();
    grid.replaceChildren();
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No prompts match. Try a different filter.';
      grid.appendChild(empty);
    } else {
      list.forEach(p => grid.appendChild(makeCard(p)));
    }

    const count = list.length;
    countPill.textContent = count + ' prompt' + (count !== 1 ? 's' : '');
    navCount.textContent = count;
    statTotal.textContent = allPrompts.length;
    statStar.textContent = allPrompts.filter(p => isStarred(p.id)).length;
    statCustom.textContent = custom.length;
    statPlatforms.textContent = platforms().length;
  }

  function makeCard(p) {
    const card = document.createElement('div');
    card.className = 'pcard';

    const top = document.createElement('div');
    top.className = 'top';

    const emoji = document.createElement('span');
    emoji.className = 'emoji';
    emoji.textContent = p.emoji || '💬';

    const textWrap = document.createElement('div');
    textWrap.style.minWidth = '0';
    textWrap.style.flex = '1';
    const title = document.createElement('h3');
    title.textContent = p.title || 'Untitled';
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = p.sub || '';
    textWrap.append(title, sub);

    const star = document.createElement('button');
    star.className = 'star-btn' + (isStarred(p.id) ? ' on' : '');
    star.type = 'button';
    star.textContent = isStarred(p.id) ? '★' : '☆';
    star.setAttribute('aria-label', `${isStarred(p.id) ? 'Unstar' : 'Star'} ${p.title || 'prompt'}`);

    top.append(emoji, textWrap, star);

    const badges = document.createElement('div');
    badges.className = 'badges';
    const cat = document.createElement('span');
    cat.className = 'badge cat';
    cat.textContent = p.cat || 'custom';
    badges.appendChild(cat);
    (p.platforms || []).forEach(platform => {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = platform;
      badges.appendChild(badge);
    });

    card.append(top, badges);

    if (p.notes) {
      const snippet = document.createElement('div');
      snippet.className = 'snippet';
      snippet.textContent = p.notes;
      card.appendChild(snippet);
    }

    const foot = document.createElement('div');
    foot.className = 'foot';
    const kind = document.createElement('span');
    kind.className = 'kind';
    const vcount = Object.keys(p.versions || {}).length;
    kind.textContent = `${vcount} version${vcount !== 1 ? 's' : ''}`;
    const open = document.createElement('button');
    open.className = 'mini-btn push';
    open.type = 'button';
    open.textContent = 'Open →';
    foot.append(kind, open);
    card.appendChild(foot);

    star.addEventListener('click', (event) => {
      event.stopPropagation();
      stars = isStarred(p.id)
        ? stars.filter(id => !sameId(id, p.id))
        : [...stars, p.id];
      writeStars(stars);
    });
    open.addEventListener('click', (event) => {
      event.stopPropagation();
      modal.open(p);
    });
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

  search?.addEventListener('input', (event) => {
    searchQuery = event.target.value;
    render();
  });

  window.addEventListener(CUSTOM_PROMPTS_UPDATED_EVENT, () => {
    reloadState();
    buildChips();
    render();
  });
  window.addEventListener(STARRED_PROMPTS_UPDATED_EVENT, () => {
    reloadState();
    render();
  });

  reloadState({ migrate: true });
  buildChips();
  render();
}
