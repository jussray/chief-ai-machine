import { showToast } from './ui.js';
import {
  CUSTOM_PROMPTS_UPDATED_EVENT,
  createLocalPromptId,
  normalizeCustomPrompts,
  readCustomPromptState,
  readStarState,
  writeCustomPrompts,
  writeStars,
} from './prompt-state.js';

function makeTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = String(text ?? '');
  return element;
}

function unknownStorageMessage(state) {
  return state === 'corrupt'
    ? 'Saved custom prompt state is unreadable. Current custom prompt count is UNKNOWN. Nothing has been overwritten.'
    : 'Custom prompt storage is unavailable. Current custom prompt count is UNKNOWN. Nothing has been overwritten.';
}

function setCustomFormWritable(writable) {
  const save = document.getElementById('saveCustom');
  if (!save) return;
  save.disabled = !writable;
  save.setAttribute('aria-disabled', writable ? 'false' : 'true');
  save.title = writable ? '' : 'Custom prompt storage must be readable before saving.';
}

export function initCustom(modal) {
  const titleEl = document.getElementById('cTitle');
  const subEl = document.getElementById('cSub');
  const catEl = document.getElementById('cCat');
  const platformsEl = document.getElementById('cPlatforms');
  const bodyEl = document.getElementById('cBody');
  const list = document.getElementById('customList');

  function openPrompt(prompt) {
    modal.open(prompt);
  }

  function render() {
    const read = readCustomPromptState();
    const custom = read.prompts;
    list.replaceChildren();
    const navCustom = document.getElementById('navCustom');

    if (read.state !== 'ready') {
      setCustomFormWritable(false);
      if (navCustom) navCustom.textContent = '?';
      const unknown = makeTextElement('div', 'empty', unknownStorageMessage(read.state));
      unknown.dataset.customStorageTruth = 'unknown';
      unknown.setAttribute('role', 'alert');
      unknown.setAttribute('aria-live', 'assertive');
      list.appendChild(unknown);
      return;
    }

    setCustomFormWritable(true);
    if (navCustom) navCustom.textContent = String(custom.length);
    if (!custom.length) {
      const empty = makeTextElement('div', 'empty', 'No custom prompts yet.');
      empty.dataset.customStorageTruth = 'verified-empty';
      empty.style.border = 'none';
      empty.style.padding = '16px 0';
      list.appendChild(empty);
      return;
    }

    custom.forEach((prompt) => {
      const item = document.createElement('div');
      item.className = 'citem';
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `Open ${prompt.title || 'Untitled'} prompt`);

      const row = document.createElement('div');
      row.className = 'row';
      row.appendChild(makeTextElement('strong', '', prompt.title || 'Untitled'));

      const badge = makeTextElement('span', 'badge cat', prompt.cat || 'custom');
      badge.style.marginLeft = 'auto';
      row.appendChild(badge);

      const del = makeTextElement('button', 'mini-btn', 'Delete');
      del.type = 'button';
      del.style.marginLeft = '8px';
      del.setAttribute('aria-label', `Delete ${prompt.title || 'Untitled'} prompt`);
      row.appendChild(del);

      const sub = makeTextElement('div', '', prompt.sub || '');
      sub.style.fontSize = '12px';
      sub.style.color = 'var(--text-muted)';
      sub.style.marginTop = '4px';
      item.append(row, sub);

      del.addEventListener('click', (event) => {
        event.stopPropagation();
        const current = readCustomPromptState();
        if (current.state !== 'ready') {
          showToast('Custom prompt state is UNKNOWN. Nothing was deleted.');
          render();
          return;
        }
        const starRead = readStarState();
        if (starRead.state !== 'ready') {
          showToast('Star state is UNKNOWN. Nothing was deleted.');
          return;
        }

        const promptIndex = current.prompts.findIndex(candidate => candidate.id === prompt.id);
        if (promptIndex === -1) {
          showToast('Prompt changed before deletion. Refresh and try again.');
          render();
          return;
        }
        const [removed] = current.prompts.splice(promptIndex, 1);
        try {
          writeCustomPrompts(current.prompts);
          const nextStars = starRead.stars.filter(id => String(id) !== String(removed?.id));
          if (nextStars.length !== starRead.stars.length) writeStars(nextStars);
          showToast('Deleted.');
        } catch {
          showToast('Delete failed. Local state was not fully writable.');
          render();
        }
      });
      item.addEventListener('click', () => openPrompt(prompt));
      item.addEventListener('keydown', (event) => {
        if (event.target !== item || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        openPrompt(prompt);
      });
      list.appendChild(item);
    });
  }

  document.getElementById('saveCustom')?.addEventListener('click', () => {
    const current = readCustomPromptState();
    if (current.state !== 'ready') {
      showToast('Custom prompt state is UNKNOWN. Repair or reset local state before saving.');
      render();
      return;
    }

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
    const normalized = normalizeCustomPrompts([{
      id: createLocalPromptId('custom'),
      title,
      sub: subEl?.value?.trim() || '',
      cat: catEl?.value || 'custom',
      platforms,
      versions,
      emoji: '✨',
      repos: [],
    }]);
    const nextPrompt = normalized.prompts[0];
    if (!nextPrompt) {
      showToast('Custom prompt could not be normalized safely.');
      return;
    }

    try {
      writeCustomPrompts([...current.prompts, nextPrompt]);
      showToast('Saved!');
      [titleEl, subEl, platformsEl, bodyEl].forEach(el => { if (el) el.value = ''; });
    } catch {
      showToast('Save failed. Custom prompt state is unchanged.');
      render();
    }
  });

  window.addEventListener(CUSTOM_PROMPTS_UPDATED_EVENT, render);
  render();
}
