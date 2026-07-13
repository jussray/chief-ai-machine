// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.
import { PROMPTS } from './data/prompts.js';
import { BENCHMARKS } from './data/benchmarks.js';
import { initThemeToggle, showToast, initNav } from './modules/ui.js';
import { initLibrary } from './modules/library.js';
import { initBuilder } from './modules/builder.js';
import { initFreestyle } from './modules/freestyle.js';
import { initCustom } from './modules/custom.js';
import { initModal } from './modules/modal.js';

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initNav();
  const modal = initModal(PROMPTS);
  initLibrary(PROMPTS, modal);
  initBuilder(PROMPTS);
  initFreestyle(PROMPTS, modal);
  initCustom(PROMPTS, modal);

  const tbody = document.getElementById('benchBody');
  if (tbody) {
    BENCHMARKS.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${row.task}</td><td>${row.chatgpt}</td><td>${row.claude}</td><td>${row.perplexity}</td><td><span class="best">${row.best}</span></td>`;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('exportBtn')?.addEventListener('click', () => {
    const custom = JSON.parse(localStorage.getItem('chief-custom') || '[]');
    const stars = JSON.parse(localStorage.getItem('chief-stars') || '[]');
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), custom, stars }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'chief-ai-export.json'; a.click();
    showToast('Exported!');
  });

  document.getElementById('importBtn')?.addEventListener('click', () => document.getElementById('importFile')?.click());
  document.getElementById('importFile')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.custom) localStorage.setItem('chief-custom', JSON.stringify(data.custom));
        if (data.stars) localStorage.setItem('chief-stars', JSON.stringify(data.stars));
        showToast('Imported! Refresh to see changes.');
      } catch { showToast('Import failed — invalid file.'); }
    };
    reader.readAsText(file);
  });

  document.getElementById('resetBtn')?.addEventListener('click', () => {
    if (confirm('Reset all saved stars, custom prompts, and theme?')) {
      ['chief-custom','chief-stars','chief-ai-theme'].forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  });
});
