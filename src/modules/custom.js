import { showToast } from './ui.js';

const CUSTOM_PROMPTS_UPDATED_EVENT = 'chief-custom-updated';

function readCustomPrompts() {
  try {
    const value = JSON.parse(localStorage.getItem('chief-custom') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function makeTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = String(text ?? '');
  return element;
}

export function initCustom(PROMPTS, modal) {
  const titleEl = document.getElementById('cTitle');
  const subEl = document.getElementById('cSub');
  const catEl = document.getElementById('cCat');
  const platformsEl = document.getElementById('cPlatforms');
  const bodyEl = document.getElementById('cBody');
  const list = document.getElementById('customList');
  let custom = readCustomPrompts();

  function render() {
    custom = readCustomPrompts();
    list.replaceChildren();
    if (!custom.length) {
      const empty = makeTextElement('div', 'empty', 'No custom prompts yet.');
      empty.style.border = 'none';
      empty.style.padding = '16px 0';
      list.appendChild(empty);
      const nc = document.getElementById('navCustom');
      if (nc) nc.textContent = '0';
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
        custom.splice(i, 1);
        localStorage.setItem('chief-custom', JSON.stringify(custom));
        render();
        showToast('Deleted.');
      });
      item.addEventListener('click', () => modal.open(p));
      list.appendChild(item);
    });

    const nc = document.getElementById('navCustom');
    if (nc) nc.textContent = String(custom.length);
  }

  document.getElementById('saveCustom')?.addEventListener('click', () => {
    const title = titleEl?.value?.trim(); const body = bodyEl?.value?.trim();
    if (!title || !body) { showToast('Title and body required.'); return; }
    const platforms = (platformsEl?.value || 'chatgpt').split(',').map(s => s.trim()).filter(Boolean);
    const versions = {}; platforms.forEach(p => { versions[p] = body; });
    custom = readCustomPrompts();
    custom.push({ id: 'custom-' + Date.now(), title, sub: subEl?.value?.trim() || '', cat: catEl?.value || 'custom', platforms, versions, emoji: '✨' });
    localStorage.setItem('chief-custom', JSON.stringify(custom));
    render(); showToast('Saved!');
    [titleEl, subEl, platformsEl, bodyEl].forEach(el => { if (el) el.value = ''; });
  });

  window.addEventListener(CUSTOM_PROMPTS_UPDATED_EVENT, render);
  render();
}