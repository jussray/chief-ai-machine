import { normalizeCustomPrompts } from '../domain/intelligence.js';
import { showToast } from './ui.js';

const CUSTOM_PROMPTS_UPDATED_EVENT = 'chief-custom-updated';

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

export function initCustom(PROMPTS, modal) {
  const titleEl = document.getElementById('cTitle');
  const subEl = document.getElementById('cSub');
  const catEl = document.getElementById('cCat');
  const platformsEl = document.getElementById('cPlatforms');
  const bodyEl = document.getElementById('cBody');
  const list = document.getElementById('customList');
  let custom = [];

  function render() {
    const read = readCustomPromptStorage();
    custom = read.prompts;
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

    custom.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'citem';

      const row = document.createElement('div');
      row.className = 'row';
      row.appendChild(makeTextElement('strong', '', p.title || 'Untitled'));

      const category = makeTextElement('span', 'badge cat', p.cat || 'custom');
      category.style.marginLeft = 'auto';
      row.appendChild(category);

      const deleteButton = makeTextElement('button', 'mini-btn', 'Delete');
      deleteButton.dataset.del = String(i);
      deleteButton.style.marginLeft = '8px';
      row.appendChild(deleteButton);

      const subtitle = makeTextElement('div', '', p.sub || '');
      subtitle.style.fontSize = '12px';
      subtitle.style.color = 'var(--text-muted)';
      subtitle.style.marginTop = '4px';

      item.append(row, subtitle);
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const current = readCustomPromptStorage();
        if (current.state !== 'ready') {
          showToast('Custom prompt state is UNKNOWN. Nothing was deleted.');
          render();
          return;
        }
        current.prompts.splice(i, 1);
        localStorage.setItem('chief-custom', JSON.stringify(current.prompts));
        render();
        showToast('Deleted.');
      });
      item.addEventListener('click', () => modal.open(p));
      list.appendChild(item);
    });
  }

  document.getElementById('saveCustom')?.addEventListener('click', () => {
    const current = readCustomPromptStorage();
    if (current.state !== 'ready') {
      showToast('Custom prompt state is UNKNOWN. Repair or reset local state before saving.');
      render();
      return;
    }

    const title = titleEl?.value?.trim();
    const body = bodyEl?.value?.trim();
    if (!title || !body) { showToast('Title and body required.'); return; }
    const platforms = (platformsEl?.value || 'chatgpt').split(',').map(s => s.trim()).filter(Boolean);
    const versions = {}; platforms.forEach(p => { versions[p] = body; });
    const nextPrompt = normalizeCustomPrompts([{
      id: 'custom-' + Date.now(),
      title,
      sub: subEl?.value?.trim() || '',
      cat: catEl?.value || 'custom',
      platforms,
      versions,
      emoji: '✨',
    }])[0];
    if (!nextPrompt) {
      showToast('Custom prompt could not be normalized safely.');
      return;
    }

    current.prompts.push(nextPrompt);
    localStorage.setItem('chief-custom', JSON.stringify(current.prompts));
    render();
    showToast('Saved!');
    [titleEl, subEl, platformsEl, bodyEl].forEach(el => { if (el) el.value = ''; });
  });

  window.addEventListener(CUSTOM_PROMPTS_UPDATED_EVENT, render);
  render();
}