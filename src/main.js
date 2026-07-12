import { PROMPTS } from './data/prompts.js';
import { BENCHMARKS } from './data/benchmarks.js';
import { initThemeToggle, showToast, initNav } from './modules/ui.js';
import { initLibrary } from './modules/library.js';
import { initBuilder } from './modules/builder.js';
import { initFreestyle } from './modules/freestyle.js';
import { initCustom } from './modules/custom.js';
import { initModal } from './modules/modal.js';
import { installChiefGuardrailRuntime, validateChiefImportPayload } from './config/visionGuardrails.js';

document.addEventListener('DOMContentLoaded', () => {
  installChiefGuardrailRuntime();
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
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), state_scope: 'browser-local', custom, stars }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'chief-ai-export.json'; a.click();
    showToast('Exported browser-local state.');
  });

  document.getElementById('importBtn')?.addEventListener('click', () => document.getElementById('importFile')?.click());
  document.getElementById('importFile')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(String(ev.target?.result || ''));
        const safe = validateChiefImportPayload(data, file.size);
        localStorage.setItem('chief-custom', JSON.stringify(safe.custom));
        localStorage.setItem('chief-stars', JSON.stringify(safe.stars));
        showToast('Imported validated browser-local state. Refresh to see changes.');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid file.';
        showToast(`Import failed — ${message}`);
      } finally {
        e.target.value = '';
      }
    };
    reader.onerror = () => showToast('Import failed — file could not be read.');
    reader.readAsText(file);
  });

  document.getElementById('resetBtn')?.addEventListener('click', () => {
    if (confirm('Reset all saved stars, custom prompts, and theme?')) {
      ['chief-custom','chief-stars','chief-ai-theme'].forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  });
});
