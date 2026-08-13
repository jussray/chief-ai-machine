// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.
import { PROMPTS } from './data/prompts.js';
import { GOALFIX_V1_PROMPTS } from './data/goalfix-v1.js';
import { BENCHMARKS } from './data/benchmarks.js';
import { initThemeToggle, showToast, initNav } from './modules/ui.js';
import { initLibrary } from './modules/library.js';
import { initBuilder } from './modules/builder.js';
import { initFreestyle } from './modules/freestyle.js';
import { initCustom } from './modules/custom.js';
import { initModal } from './modules/modal.js';
import { initBrain, INTELLIGENCE_STORAGE_KEY } from './modules/brain.js';
import { initFriendMode } from './modules/friend-mode.js';
import { initGoals, GOAL_STORAGE_KEY } from './modules/goals.js';
import { createPortableSnapshot, parsePortableSnapshot } from './domain/intelligence.js';

const PUBLIC_PROMPTS = [...PROMPTS, ...GOALFIX_V1_PROMPTS];

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initFriendMode();
  initNav();
  const modal = initModal(PUBLIC_PROMPTS);
  initGoals();
  initLibrary(PUBLIC_PROMPTS, modal);
  initBuilder(PUBLIC_PROMPTS);
  initFreestyle(PUBLIC_PROMPTS);
  initCustom(PUBLIC_PROMPTS, modal);
  initBrain();

  const tbody = document.getElementById('benchBody');
  if (tbody) {
    BENCHMARKS.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${row.task}</td><td>${row.chatgpt}</td><td>${row.claude}</td><td>${row.perplexity}</td><td><span class="best">${row.best}</span></td>`;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('exportBtn')?.addEventListener('click', () => {
    const snapshot = createPortableSnapshot({
      assets: readArray(INTELLIGENCE_STORAGE_KEY),
      customPrompts: readArray('chief-custom'),
      stars: readArray('chief-stars'),
    });
    snapshot.goals = readArray(GOAL_STORAGE_KEY);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chief-ai-founder-intelligence.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Portable company brain exported.');
  });

  document.getElementById('importBtn')?.addEventListener('click', () => document.getElementById('importFile')?.click());
  document.getElementById('importFile')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target.result);
        const imported = parsePortableSnapshot(raw);
        localStorage.setItem(INTELLIGENCE_STORAGE_KEY, JSON.stringify(imported.assets));
        localStorage.setItem('chief-custom', JSON.stringify(imported.customPrompts));
        localStorage.setItem('chief-stars', JSON.stringify(imported.stars));
        if (Array.isArray(raw.goals)) localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(raw.goals));
        showToast('Company brain imported. Refreshing…');
        setTimeout(() => location.reload(), 300);
      } catch {
        showToast('Import failed — unsupported or invalid file.');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('resetBtn')?.addEventListener('click', () => {
    if (confirm('Reset all saved goals, intelligence, prompts, stars, and theme?')) {
      [GOAL_STORAGE_KEY, INTELLIGENCE_STORAGE_KEY, 'chief-custom', 'chief-stars', 'chief-ai-theme'].forEach(k => localStorage.removeItem(k));
      location.reload();
    }
  });
});
