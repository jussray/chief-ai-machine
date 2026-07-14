import { showToast } from './ui.js';
import {
  ASSET_KINDS,
  ASSET_STATUSES,
  createIntelligenceAsset,
  upsertIntelligenceAsset,
} from '../domain/intelligence.js';

export const INTELLIGENCE_STORAGE_KEY = 'chief-intelligence-assets-v1';

function readAssets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INTELLIGENCE_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAssets(assets) {
  localStorage.setItem(INTELLIGENCE_STORAGE_KEY, JSON.stringify(assets));
}

function options(values) {
  return values.map((value) => `<option value="${value}">${value}</option>`).join('');
}

export function initBrain() {
  const list = document.getElementById('brainList');
  const title = document.getElementById('brainTitle');
  const project = document.getElementById('brainProject');
  const kind = document.getElementById('brainKind');
  const status = document.getElementById('brainStatus');
  const provider = document.getElementById('brainProvider');
  const tags = document.getElementById('brainTags');
  const content = document.getElementById('brainContent');
  const outcome = document.getElementById('brainOutcome');
  const summary = document.getElementById('brainSummary');
  const save = document.getElementById('brainSave');
  const count = document.getElementById('brainCount');

  if (!list || !save) return;

  if (kind) kind.innerHTML = options(ASSET_KINDS);
  if (status) status.innerHTML = options(ASSET_STATUSES);

  let assets = readAssets();

  function render() {
    list.innerHTML = '';
    if (count) count.textContent = String(assets.length);

    if (!assets.length) {
      list.innerHTML = '<div class="empty" style="border:none;padding:16px 0">No company intelligence assets yet. Save a decision, workflow, benchmark, research note, brand voice, playbook, or prompt.</div>';
      return;
    }

    [...assets]
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .forEach((asset) => {
        const item = document.createElement('div');
        item.className = 'citem';
        item.innerHTML = `
          <div class="row">
            <strong>${asset.title}</strong>
            <span class="badge cat" style="margin-left:auto">${asset.kind}</span>
            <button class="mini-btn" data-delete="${asset.id}" style="margin-left:8px">Delete</button>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
            ${asset.projectId} · ${asset.status} · ${asset.provider} · v${asset.version}
          </div>
          <div style="font-size:13px;margin-top:8px;white-space:pre-wrap">${asset.summary || asset.content.slice(0, 180)}</div>`;

        item.querySelector('[data-delete]')?.addEventListener('click', (event) => {
          event.stopPropagation();
          assets = assets.filter((entry) => entry.id !== asset.id);
          writeAssets(assets);
          render();
          showToast('Intelligence asset deleted.');
        });

        item.addEventListener('click', () => {
          if (title) title.value = asset.title;
          if (project) project.value = asset.projectId;
          if (kind) kind.value = asset.kind;
          if (status) status.value = asset.status;
          if (provider) provider.value = asset.provider;
          if (tags) tags.value = asset.tags.join(', ');
          if (content) content.value = asset.content;
          if (outcome) outcome.value = asset.outcome || '';
          if (summary) summary.value = asset.summary || '';
          save.dataset.assetId = asset.id;
          save.textContent = 'Save new version';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        list.appendChild(item);
      });
  }

  save.addEventListener('click', () => {
    try {
      const existingId = save.dataset.assetId;
      const existing = existingId ? assets.find((asset) => asset.id === existingId) : null;
      const next = createIntelligenceAsset({
        ...existing,
        id: existingId || undefined,
        title: title?.value,
        projectId: project?.value,
        kind: kind?.value,
        status: status?.value,
        provider: provider?.value,
        tags: (tags?.value || '').split(','),
        content: content?.value,
        outcome: outcome?.value,
        summary: summary?.value,
      });

      assets = upsertIntelligenceAsset(assets, next);
      writeAssets(assets);
      save.dataset.assetId = '';
      save.textContent = 'Save intelligence asset';
      [title, project, provider, tags, content, outcome, summary].forEach((element) => {
        if (element) element.value = '';
      });
      if (kind) kind.value = 'prompt';
      if (status) status.value = 'draft';
      render();
      showToast(existing ? 'New asset version saved.' : 'Company intelligence saved.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save asset.');
    }
  });

  document.getElementById('brainCancel')?.addEventListener('click', () => {
    save.dataset.assetId = '';
    save.textContent = 'Save intelligence asset';
    [title, project, provider, tags, content, outcome, summary].forEach((element) => {
      if (element) element.value = '';
    });
  });

  render();
}
