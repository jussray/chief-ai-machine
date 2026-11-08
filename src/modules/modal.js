import { renderPromptVariant } from '../domain/evidence-first-prompt.js';
import { showToast, copyText } from './ui.js';

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
  let stars = JSON.parse(localStorage.getItem('chief-stars') || '[]');

  function open(prompt) {
    currentPrompt = prompt;
    mTitle.textContent = (prompt.emoji || '') + '  ' + prompt.title;
    mSub.textContent = prompt.sub || '';
    if (prompt.notes) { mNote.hidden = false; mNoteText.textContent = ' ' + prompt.notes; }
    else mNote.hidden = true;
    const platforms = Object.keys(prompt.versions || {});
    mTabs.innerHTML = '';
    platforms.forEach((p, i) => {
      const btn = document.createElement('button');
      btn.className = 'ptab' + (i === 0 ? ' active' : '');
      btn.textContent = p.charAt(0).toUpperCase() + p.slice(1);
      btn.addEventListener('click', () => {
        mTabs.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); currentTab = p; mBody.textContent = renderPromptVariant(prompt, p);
      });
      mTabs.appendChild(btn);
    });
    currentTab = platforms[0];
    mBody.textContent = renderPromptVariant(prompt, currentTab);
    mStar.textContent = stars.includes(prompt.id) ? '★' : '☆';
    mStar.classList.toggle('on', stars.includes(prompt.id));
    wrap.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
  }

  mStar?.addEventListener('click', () => {
    if (!currentPrompt) return;
    const idx = stars.indexOf(currentPrompt.id);
    if (idx === -1) stars.push(currentPrompt.id); else stars.splice(idx, 1);
    localStorage.setItem('chief-stars', JSON.stringify(stars));
    mStar.textContent = stars.includes(currentPrompt.id) ? '★' : '☆';
    mStar.classList.toggle('on', stars.includes(currentPrompt.id));
  });

  mCopy?.addEventListener('click', () => {
    if (currentPrompt && currentTab) { copyText(renderPromptVariant(currentPrompt, currentTab)); showToast('Copied!'); }
  });

  mClose?.addEventListener('click', close);
  mClose2?.addEventListener('click', close);
  wrap?.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  return { open, stars: () => stars };
}
