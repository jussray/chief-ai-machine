export function initThemeToggle() {
  const root = document.documentElement;
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  const saved = localStorage.getItem('chief-ai-theme');
  if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('chief-ai-theme', next);
  });
}

export function initNav() {
  const allBtns = document.querySelectorAll('[data-page]');
  const allPages = document.querySelectorAll('.page');
  function goTo(page) {
    allBtns.forEach(b => b.classList.toggle('active', b.dataset.page === page));
    allPages.forEach(p => p.classList.toggle('on', p.id === 'page-' + page));
  }
  allBtns.forEach(btn => btn.addEventListener('click', () => goTo(btn.dataset.page)));
}

export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = String(msg);
  t.classList.add('show');
  clearTimeout(t._chiefToastTimer);
  t._chiefToastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

export async function copyText(text) {
  const value = String(text ?? '');
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the local textarea fallback.
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return Boolean(document.execCommand?.('copy'));
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
