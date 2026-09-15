import { showToast } from './ui.js';
import {
  CUSTOM_PROMPTS_UPDATED_EVENT,
  STARRED_PROMPTS_UPDATED_EVENT,
  migrateLegacyCustomStarIds,
  readCustomPromptState,
  readStarState,
  writeStars,
} from './prompt-state.js';

function makeTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = String(text ?? '');
  return element;
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

  let stars = [];
  let starState = 'ready';
  let custom = [];
  let customState = 'ready';
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
    const customRead = readCustomPromptState();
    customState = customRead.state;
    custom = customRead.state === 'ready' ? customRead.prompts : [];

    const starRead = readStarState();
    starState = starRead.state;
    stars = starRead.state === 'ready' ? starRead.stars : [];

    if (migrate && customState === 'ready' && starState === 'ready') {
      const migration = migrateLegacyCustomStarIds(custom, stars);
      stars = migration.stars;
      if (migration.changed) {
        try {
          writeStars(stars);
        } catch {
          starState = 'unavailable';
          stars = [];
        }
      }
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
    const all = makeTextElement('button', 'chip' + (!activeFilter ? ' active' : ''), 'All');
    all.addEventListener('click', () => { activeFilter = null; render(); buildChips(); });
    chips.appendChild(all);

    const starChip = makeTextElement('button', 'chip c-star' + (activeFilter === '__star' ? ' active' : ''), '★ Starred');
    const starFilterKnown = starState === 'ready' && customState === 'ready';
    starChip.disabled = !starFilterKnown;
    starChip.setAttribute('aria-disabled', starFilterKnown ? 'false' : 'true');
    starChip.title = starFilterKnown ? '' : 'Starred prompt set is UNKNOWN until saved prompt state is readable.';
    starChip.addEventListener('click', () => {
      if (!starFilterKnown) {
        showToast('Starred prompt set is UNKNOWN. Nothing was filtered.');
        return;
      }
      activeFilter = activeFilter === '__star' ? null : '__star';
      render();
      buildChips();
    });
    chips.appendChild(starChip);

    const sep = document.createElement('div');
    sep.className = 'chip-sep';
    chips.appendChild(sep);

    categories().forEach(cat => {
      const btn = makeTextElement('button', 'chip' + (activeFilter === cat ? ' active' : ''), cat);
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
    if (activeFilter === '__star' && (starState !== 'ready' || customState !== 'ready')) {
      activeFilter = null;
    }

    const list = filtered();
    grid.replaceChildren();
    if (!list.length) {
      grid.appendChild(makeTextElement('div', 'empty', 'No prompts match. Try a different filter.'));
    } else {
      list.forEach(p => grid.appendChild(makeCard(p)));
    }

    const count = list.length;
    const customKnown = customState === 'ready';
    const starsKnown = starState === 'ready' && customKnown;
    countPill.textContent = customKnown
      ? count + ' prompt' + (count !== 1 ? 's' : '')
      : count + ' known prompt' + (count !== 1 ? 's' : '');
    navCount.textContent = customKnown ? String(count) : '?';
    statTotal.textContent = customKnown ? String(allPrompts.length) : '?';
    statTotal.title = customKnown ? '' : 'Saved custom prompt state is UNKNOWN, so the total prompt count is UNKNOWN.';
    statStar.textContent = starsKnown ? String(allPrompts.filter(p => isStarred(p.id)).length) : '?';
    statStar.title = starsKnown ? '' : 'Starred prompt state is UNKNOWN or depends on unreadable custom prompt state.';
    statCustom.textContent = customKnown ? String(custom.length) : '?';
    statCustom.title = customKnown ? '' : 'Saved custom prompt state is UNKNOWN and has not been treated as empty.';
    statPlatforms.textContent = customKnown ? String(platforms().length) : '?';
  }

  function makeCard(p) {
    const card = document.createElement('div');
    card.className = 'pcard';
    const starred = starState === 'ready' && isStarred(p.id);

    const top = document.createElement('div');
    top.className = 'top';
    top.appendChild(makeTextElement('span', 'emoji', p.emoji || '💬'));

    const textWrap = document.createElement('div');
    textWrap.style.minWidth = '0';
    textWrap.style.flex = '1';
    textWrap.append(
      makeTextElement('h3', '', p.title || 'Untitled'),
      makeTextElement('div', 'sub', p.sub || ''),
    );
    top.appendChild(textWrap);

    const star = makeTextElement('button', 'star-btn' + (starred ? ' on' : ''), starred ? '★' : '☆');
    star.type = 'button';
    star.disabled = starState !== 'ready';
    star.setAttribute('aria-disabled', starState === 'ready' ? 'false' : 'true');
    star.setAttribute('aria-label', `${starred ? 'Unstar' : 'Star'} ${p.title || 'prompt'}`);
    star.title = starState === 'ready' ? '' : 'Star state is UNKNOWN.';
    top.appendChild(star);

    const badges = document.createElement('div');
    badges.className = 'badges';
    badges.appendChild(makeTextElement('span', 'badge cat', p.cat || 'custom'));
    (p.platforms || []).forEach(platform => badges.appendChild(makeTextElement('span', 'badge', platform)));
    card.append(top, badges);

    if (p.notes) card.appendChild(makeTextElement('div', 'snippet', p.notes));

    const foot = document.createElement('div');
    foot.className = 'foot';
    const vcount = Object.keys(p.versions || {}).length;
    foot.appendChild(makeTextElement('span', 'kind', `${vcount} version${vcount !== 1 ? 's' : ''}`));
    const open = makeTextElement('button', 'mini-btn push', 'Open →');
    open.type = 'button';
    foot.appendChild(open);
    card.appendChild(foot);

    star.addEventListener('click', (event) => {
      event.stopPropagation();
      const current = readStarState();
      if (current.state !== 'ready') {
        showToast('Star state is UNKNOWN. Nothing was changed.');
        reloadState();
        buildChips();
        render();
        return;
      }
      const next = current.stars.some(id => sameId(id, p.id))
        ? current.stars.filter(id => !sameId(id, p.id))
        : [...current.stars, p.id];
      try {
        writeStars(next);
      } catch {
        showToast('Star update failed. Saved star state was not replaced.');
        reloadState();
        buildChips();
        render();
      }
    });
    open.addEventListener('click', (event) => { event.stopPropagation(); modal.open(p); });
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
    buildChips();
    render();
  });

  reloadState({ migrate: true });
  buildChips();
  render();
}
