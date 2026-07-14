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

function fillSelect(select, values) {
  if (!select) return;
  select.replaceChildren(...values.map((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    return option;
  }));
}

function resetEditor(fields, save) {
  fields.forEach((element) => {
    if (element) element.value = '';
  });
  save.dataset.assetId = '';
  save.textContent = 'Save intelligence asset';
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

  fillSelect(kind, ASSET_KINDS);
  fillSelect(status, ASSET_STATUSES);

  const editableFields = [title, project, provider, tags, content, outcome, summary];
  let assets = readAssets();

  function renderEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.style.border = 'none';
    empty.style.padding = '16px 0';
    empty.textContent = 'No company intelligence assets yet. Save a decision, workflow, benchmark, research note, brand voice, playbook, or prompt.';
    list.replaceChildren(empty);
  }

  function render() {
    list.replaceChildren();
    if (count) count.textContent = String(assets.length);

    if (!assets.length) {
      renderEmptyState();
      return;
    }

    [...assets]
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .forEach((asset) => {
        const item = document.createElement('div');
        item.className = 'citem';

        const row = document.createElement('div');
        row.className = 'row';

        const itemTitle = document.createElement('strong');
        itemTitle.textContent = asset.title;

        const kindBadge = document.createElement('span');
        kindBadge.className = 'badge cat';
        kindBadge.style.marginLeft = 'auto';
        kindBadge.textContent = asset.kind;

        const deleteButton = document.createElement('button');
        deleteButton.className = 'mini-btn';
        deleteButton.style.marginLeft = '8px';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', (event) => {
          event.stopPropagation();
          assets = assets.filter((entry) => entry.id !== asset.id);
          writeAssets(assets);
          render();
          showToast('Intelligence asset deleted.');
        });

        row.append(itemTitle, kindBadge, deleteButton);

        const metadata = document.createElement('div');
        metadata.style.fontSize = '12px';
        metadata.style.color = 'var(--text-muted)';
        metadata.style.marginTop = '4px';
        metadata.textContent = `${asset.projectId} · ${asset.status} · ${asset.provider} · v${asset.version}`;

        const excerpt = document.createElement('div');
        excerpt.style.fontSize = '13px';
        excerpt.style.marginTop = '8px';
        excerpt.style.whiteSpace = 'pre-wrap';
        excerpt.textContent = asset.summary || asset.content.slice(0, 180);

        item.append(row, metadata, excerpt);
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
      resetEditor(editableFields, save);
      if (provider) provider.value = 'provider-neutral';
      if (kind) kind.value = 'prompt';
      if (status) status.value = 'draft';
      render();
      showToast(existing ? 'New asset version saved.' : 'Company intelligence saved.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save asset.');
    }
  });

  document.getElementById('brainCancel')?.addEventListener('click', () => {
    resetEditor(editableFields, save);
    if (provider) provider.value = 'provider-neutral';
  });

  render();
}
