import { renderPromptVariant } from '../domain/evidence-first-prompt.js';
import { showToast, copyText } from './ui.js';
import {
  STARRED_PROMPTS_UPDATED_EVENT,
  readStoredArray,
  writeStars,
} from './prompt-state.js';

export function initModal() {
  const wrap = document.getElementById('modalWrap');
  const mTitle = document.getElementById('mTitle');
  const mSub = document.getElementById('mSub');
  const mNote = document.getElementById('mNote');
  const mNoteText = document.getElementById('mNoteText');
  const mTabs = document.getElementById('mTabs');
  const mBody = document.getElementById('mBody');
  const mStar = document.getElementById('mStar');
  const mCopy = document.getElementById('mCopy');
  const mClose = document.getElementById('mClose');
  const mClose2 = document.getElementById('mClose2');

  let currentPrompt = null;
  let currentTab = null;
  let stars = readStoredArray('chief-stars');
  let returnFocus = null;

  function sameId(a, b) {
    return String(a) === String(b);
  }

  function isStarred(id) {
    return stars.some(starId => sameId(starId, id));
  }

  function syncStar() {
    if (!currentPrompt || !mStar) return;
    const on = isStarred(currentPrompt.id);
    mStar.textContent = on ? '★' : '☆';
    mStar.classList.toggle('on', on);
    mStar.setAttribute('aria-label', `${on ? 'Unstar' : 'Star'} ${currentPrompt.title || 'prompt'}`);
  }

  function open(prompt) {
    returnFocus = document.activeElement;
    stars = readStoredArray('chief-stars');
    currentPrompt = prompt;
    mTitle.textContent = (prompt.emoji || '') + '  ' + (prompt.title || 'Untitled');
    mSub.textContent = prompt.sub || '';
    if (prompt.notes) {
      mNote.hidden = false;
      mNoteText.textContent = ' ' + prompt.notes;
    } else {
      mNote.hidden = true;
    }

    const platforms = Object.keys(prompt.versions || {});
    mTabs.replaceChildren();
    platforms.forEach((platform, index) => {
      const btn = document.createElement('button');
      btn.className = 'ptab' + (index === 0 ? ' active' : '');
      btn.textContent = platform.charAt(0).toUpperCase() + platform.slice(1);
      btn.addEventListener('click', () => {
        mTabs.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = platform;
        mBody.textContent = renderPromptVariant(prompt, platform);
      });
      mTabs.appendChild(btn);
    });

    currentTab = platforms[0] || null;
    if (currentTab) {
      mBody.textContent = renderPromptVariant(prompt, currentTab);
      mCopy.disabled = false;
    } else {
      mBody.textContent = 'No prompt versions are available.';
      mCopy.disabled = true;
    }

    syncStar();
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';
    mClose?.focus();
  }

  function close() {
    if (!wrap.classList.contains('open')) return;
    wrap.classList.remove('open');
    document.body.style.overflow = '';
    currentPrompt = null;
    currentTab = null;
    if (returnFocus?.focus) returnFocus.focus();
    returnFocus = null;
  }

  mStar?.addEventListener('click', () => {
    if (!currentPrompt) return;
    stars = isStarred(currentPrompt.id)
      ? stars.filter(id => !sameId(id, currentPrompt.id))
      : [...stars, currentPrompt.id];
    writeStars(stars);
    syncStar();
  });

  mCopy?.addEventListener('click', async () => {
    if (!currentPrompt || !currentTab) return;
    const copied = await copyText(renderPromptVariant(currentPrompt, currentTab));
    showToast(copied ? 'Copied!' : 'Copy failed. Select the prompt manually.');
  });

  mClose?.addEventListener('click', close);
  mClose2?.addEventListener('click', close);
  wrap?.addEventListener('click', (event) => {
    if (event.target === wrap) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  window.addEventListener(STARRED_PROMPTS_UPDATED_EVENT, () => {
    stars = readStoredArray('chief-stars');
    syncStar();
  });

  return { open, stars: () => stars };
}
