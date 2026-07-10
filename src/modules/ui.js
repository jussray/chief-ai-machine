export function initThemeToggle() {
  const root = document.documentElement;
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  const saved = localStorage.getItem('chief-ai-theme');
  if (saved) root.setAttribute('data-theme', saved);
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
  t.innerHTML = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

export function copyText(text) { navigator.clipboard?.writeText(text); }
