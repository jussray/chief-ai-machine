import { showToast } from './ui.js';
import {
  CUSTOM_PROMPTS_UPDATED_EVENT,
  createLocalPromptId,
  normalizeCustomPrompts,
  readStoredArray,
  writeCustomPrompts,
  writeStars,
} from './prompt-state.js';

function readCustomPrompts() {
  const normalized = normalizeCustomPrompts(readStoredArray('chief-custom'));
  if (normalized.changed) {
    localStorage.setItem('chief-custom', JSON.stringify(normalized.prompts));
  }
  return normalized.prompts;
}

export function initCustom(PROMPTS, modal) {
  const titleEl = document.getElementById('cTitle');
  const subEl = document.getElementById('cSub');
  const catEl = document.getElementById('cCat');
  const platformsEl = document.getElementById('cPlatforms');
  const bodyEl = document.getElementById('cBody');
  const list = document.getElementById('customList');
  let custom = readCustomPrompts();

  function openPrompt(prompt) {
    modal.open(prompt);
  }

  function render() {
    custom = readCustomPrompts();
    list.replaceChildren();
    if (!custom.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.style.border = 'none';
      empty.style.padding = '16px 0';
      empty.textContent = 'No custom prompts yet.';
      list.appendChild(empty);
      const nc = document.getElementById('navCustom');
      if (nc) nc.textContent = '0';
      return;
    }

    custom.forEach((prompt, index) => {
      const item = document.createElement('div');
      item.className = 'citem';
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `Open ${prompt.title || 'Untitled'} prompt`);

      const row = document.createElement('div');
      row.className = 'row';

      const title = document.createElement('strong');
      title.textContent = prompt.title || 'Untitled';

      const badge = document.createElement('span');
      badge.className = 'badge cat';
      badge.style.marginLeft = 'auto';
      badge.textContent = prompt.cat || 'custom';

      const del = document.createElement('button');
      del.className = 'mini-btn';
      del.style.marginLeft = '8px';
      del.type = 'button';
      del.textContent = 'Delete';
      del.setAttribute('aria-label', `Delete ${prompt.title || 'Untitled'} prompt`);

      row.append(title, badge, del);

      const sub = document.createElement('div');
      sub.style.fontSize = '12px';
      sub.style.color = 'var(--text-muted)';
      sub.style.marginTop = '4px';
      sub.textContent = prompt.sub || '';

      item.append(row, sub);

      del.addEventListener('click', (event) => {
        event.stopPropagation();
        const [removed] = custom.splice(index, 1);
        writeCustomPrompts(custom);
        if (removed?.id) {
          const stars = readStoredArray('chief-stars');
          const nextStars = stars.filter(id => String(id) !== String(removed.id));
          if (nextStars.length !== stars.length) writeStars(nextStars);
        }
        showToast('Deleted.');
      });
      item.addEventListener('click', () => openPrompt(prompt));
      item.addEventListener('keydown', (event) => {
        if (event.target !== item || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        openPrompt(prompt);
      });
      list.appendChild(item);
    });

    const nc = document.getElementById('navCustom');
    if (nc) nc.textContent = String(custom.length);
  }

  document.getElementById('saveCustom')?.addEventListener('click', () => {
    const title = titleEl?.value?.trim();
    const body = bodyEl?.value?.trim();
    if (!title || !body) {
      showToast('Title and body required.');
      return;
    }

    const platforms = (platformsEl?.value || 'chatgpt')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);
    const versions = {};
    platforms.forEach(platform => { versions[platform] = body; });

    custom = readCustomPrompts();
    custom.push({
      id: createLocalPromptId('custom'),
      title,
      sub: subEl?.value?.trim() || '',
      cat: catEl?.value || 'custom',
      platforms,
      versions,
      emoji: '✨',
    });
    writeCustomPrompts(custom);
    showToast('Saved!');

    [titleEl, subEl, platformsEl, bodyEl].forEach(el => {
      if (el) el.value = '';
    });
  });

  window.addEventListener(CUSTOM_PROMPTS_UPDATED_EVENT, render);
  render();
}
