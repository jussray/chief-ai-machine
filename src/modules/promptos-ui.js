import { buildCatalogRecipes, canonicalFamilies, openPromptCard } from '../promptos/index.js';
import { showToast } from './ui.js';

const PAGE_SIZE = 24;
const LONG_INPUTS = new Set([
  'goal', 'expected', 'actual', 'currentState', 'competitiveContext', 'brandVoice',
  'designSystem', 'userFlow', 'regulatoryContext', 'constraints', 'surface',
]);

function emitAnalytics(event, recipe = null, extra = {}) {
  window.dispatchEvent(new CustomEvent('chief:promptos', {
    detail: {
      event,
      catalogVersion: 'catalog-v1',
      ...(recipe ? {
        familyId: recipe.familyId,
        platform: recipe.platform,
        stage: recipe.stage,
        riskLens: recipe.riskLens,
      } : {}),
      ...extra,
    },
  }));
}

function addStylesheet() {
  if (document.querySelector('link[data-promptos-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './styles/promptos.css';
  link.dataset.promptosStyle = 'true';
  document.head.appendChild(link);
}

function navButton({ mobile = false } = {}) {
  const button = document.createElement('button');
  button.className = 'nav-item';
  button.dataset.page = 'promptos';
  button.setAttribute('aria-label', 'PromptOS catalog');
  if (mobile) {
    button.textContent = '⚙️';
  } else {
    button.innerHTML = '⚙️ PromptOS <span class="n-count" id="promptosNavCount">5K</span>';
  }
  return button;
}

function mountNavigation() {
  const desktopLibrary = document.querySelector('.sidebar [data-page="library"]');
  if (desktopLibrary && !document.querySelector('.sidebar [data-page="promptos"]')) {
    desktopLibrary.insertAdjacentElement('afterend', navButton());
  }

  const mobileLibrary = document.querySelector('.mobile-nav [data-page="library"]');
  if (mobileLibrary && !document.querySelector('.mobile-nav [data-page="promptos"]')) {
    mobileLibrary.insertAdjacentElement('afterend', navButton({ mobile: true }));
  }
}

function createPage() {
  const section = document.createElement('section');
  section.className = 'page';
  section.id = 'page-promptos';
  section.innerHTML = `
    <div class="page-head">
      <div class="crumb">chief-ai <span>/</span> <b>promptos</b></div>
      <h2>5,000 bounded prompt recipes. Compile only what you need.</h2>
      <p>Filter the recipe index, open one recipe, add the concrete task context, and compile a provider-ready prompt with provenance and proof guardrails.</p>
    </div>
    <div class="promptos-stats" aria-label="PromptOS catalog summary">
      <div class="stat"><div class="n" id="promptosTotal">5,000</div><div class="l">Selected recipes</div></div>
      <div class="stat"><div class="n" id="promptosCandidateTotal">5,940</div><div class="l">Valid candidates</div></div>
      <div class="stat"><div class="n">9</div><div class="l">Canonical families</div></div>
      <div class="stat"><div class="n">On demand</div><div class="l">Prompt compilation</div></div>
    </div>
    <div class="promptos-toolbar" aria-label="PromptOS filters">
      <label class="promptos-search"><span>Search</span><input id="promptosSearch" type="search" placeholder="Repo audit, launch, pricing, UX…" autocomplete="off"></label>
      <label><span>Family</span><select id="promptosFamily"><option value="">All families</option></select></label>
      <label><span>Platform</span><select id="promptosPlatform"><option value="">All platforms</option></select></label>
      <label><span>Stage</span><select id="promptosStage"><option value="">All stages</option></select></label>
      <button class="mini-btn" id="promptosReset" type="button">Reset filters</button>
    </div>
    <div class="promptos-resultbar"><strong id="promptosResultCount">0 recipes</strong><span id="promptosShownCount">0 shown</span></div>
    <div class="promptos-grid" id="promptosGrid" aria-live="polite"></div>
    <div class="promptos-more-wrap"><button class="mini-btn" id="promptosMore" type="button">Load 24 more</button></div>
  `;
  return section;
}

function createDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'promptos-dialog';
  dialog.id = 'promptosDialog';
  dialog.innerHTML = `
    <div class="promptos-dialog-shell">
      <div class="promptos-dialog-head">
        <div><div class="crumb">promptos <span>/</span> <b id="promptosDialogFamily"></b></div><h3 id="promptosDialogTitle"></h3><p id="promptosDialogDescription"></p></div>
        <button class="icon-btn" id="promptosClose" type="button" aria-label="Close PromptOS recipe">✕</button>
      </div>
      <div class="promptos-dialog-grid">
        <div class="promptos-input-panel">
          <div class="panel-title"><span class="dot"></span>Concrete task context</div>
          <div id="promptosInputs"></div>
          <button class="mini-btn solid" id="promptosCompile" type="button">Compile prompt</button>
          <div class="promptos-readiness" id="promptosReadiness" role="status"></div>
        </div>
        <div class="promptos-output-panel">
          <div class="promptos-output-head"><div class="panel-title"><span class="dot"></span>Compiled output</div><button class="mini-btn" id="promptosCopy" type="button" disabled>Copy prompt</button></div>
          <pre id="promptosOutput">Fill the required inputs, then compile.</pre>
          <div class="promptos-provenance" id="promptosProvenance"></div>
        </div>
      </div>
    </div>
  `;
  return dialog;
}

function option(select, value, label = value) {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  select.appendChild(item);
}

function cardFor(recipe, onOpen) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'promptos-card';
  card.dataset.family = recipe.familyId;
  card.innerHTML = `
    <div class="promptos-card-kicker"><span>${recipe.pack}</span><span>${recipe.platform}</span></div>
    <h3></h3>
    <p></p>
    <div class="badges">
      <span class="badge cat"></span>
      <span class="badge"></span>
      <span class="badge"></span>
    </div>
    <div class="promptos-card-foot"><span></span><strong>Compile →</strong></div>
  `;
  card.querySelector('h3').textContent = recipe.title;
  card.querySelector('p').textContent = recipe.description;
  const badges = card.querySelectorAll('.badge');
  badges[0].textContent = recipe.stage;
  badges[1].textContent = recipe.modes.join(', ');
  badges[2].textContent = recipe.riskLens;
  card.querySelector('.promptos-card-foot span').textContent = `${recipe.inputs.length} required inputs`;
  card.addEventListener('click', () => onOpen(recipe));
  return card;
}

export function mountPromptOS() {
  if (document.getElementById('page-promptos')) return;

  addStylesheet();
  mountNavigation();

  const main = document.querySelector('.main');
  if (!main) return;

  const page = createPage();
  const dialog = createDialog();
  main.appendChild(page);
  document.body.appendChild(dialog);

  page.querySelector('#promptosResultCount').textContent = 'Catalog loads when opened';
  page.querySelector('#promptosShownCount').textContent = '0 shown';
  page.querySelector('#promptosMore').hidden = true;

  let initialized = false;
  let recipes = [];
  let visibleCount = PAGE_SIZE;
  let currentRecipe = null;
  let currentResult = null;

  function initializeCatalog() {
    if (initialized) return;
    initialized = true;

    const built = buildCatalogRecipes();
    recipes = built.recipes;

    page.querySelector('#promptosTotal').textContent = recipes.length.toLocaleString();
    page.querySelector('#promptosCandidateTotal').textContent = built.candidateCount.toLocaleString();

    const search = page.querySelector('#promptosSearch');
    const family = page.querySelector('#promptosFamily');
    const platform = page.querySelector('#promptosPlatform');
    const stage = page.querySelector('#promptosStage');
    const grid = page.querySelector('#promptosGrid');
    const resultCount = page.querySelector('#promptosResultCount');
    const shownCount = page.querySelector('#promptosShownCount');
    const more = page.querySelector('#promptosMore');

    for (const item of Object.values(canonicalFamilies)) option(family, item.id, item.title);
    for (const value of [...new Set(recipes.map((recipe) => recipe.platform))].sort()) option(platform, value);
    for (const value of [...new Set(recipes.map((recipe) => recipe.stage))].sort()) option(stage, value);

    function filtered() {
      const query = search.value.trim().toLowerCase();
      return recipes.filter((recipe) => {
        if (family.value && recipe.familyId !== family.value) return false;
        if (platform.value && recipe.platform !== platform.value) return false;
        if (stage.value && recipe.stage !== stage.value) return false;
        if (!query) return true;
        return [recipe.title, recipe.description, recipe.pack, recipe.familyId, recipe.riskLens, ...recipe.modes]
          .some((value) => String(value).toLowerCase().includes(query));
      });
    }

    function openRecipe(recipe) {
      currentRecipe = recipe;
      currentResult = null;
      dialog.querySelector('#promptosDialogFamily').textContent = recipe.familyId;
      dialog.querySelector('#promptosDialogTitle').textContent = recipe.title;
      dialog.querySelector('#promptosDialogDescription').textContent = recipe.description;
      const inputs = dialog.querySelector('#promptosInputs');
      inputs.innerHTML = '';

      for (const key of recipe.inputs) {
        const wrapper = document.createElement('label');
        wrapper.className = 'field';
        const label = document.createElement('span');
        label.textContent = key.replace(/([a-z])([A-Z])/g, '$1 $2');
        const control = document.createElement(LONG_INPUTS.has(key) ? 'textarea' : 'input');
        control.dataset.promptosInput = key;
        control.name = key;
        control.required = true;
        control.autocomplete = 'off';
        wrapper.append(label, control);
        inputs.appendChild(wrapper);
      }

      dialog.querySelector('#promptosOutput').textContent = 'Fill the required inputs, then compile.';
      dialog.querySelector('#promptosReadiness').textContent = `${recipe.inputs.length} required inputs`;
      dialog.querySelector('#promptosReadiness').removeAttribute('data-state');
      dialog.querySelector('#promptosCopy').disabled = true;
      dialog.querySelector('#promptosProvenance').textContent = `${recipe.platform} · ${recipe.stage} · ${recipe.modes.join(', ')} · ${recipe.riskLens}`;
      emitAnalytics('card_opened', recipe);
      dialog.showModal();
      inputs.querySelector('input, textarea')?.focus();
    }

    function render() {
      const list = filtered();
      const visible = list.slice(0, visibleCount);
      grid.replaceChildren(...visible.map((recipe) => cardFor(recipe, openRecipe)));
      resultCount.textContent = `${list.length.toLocaleString()} recipe${list.length === 1 ? '' : 's'}`;
      shownCount.textContent = `${visible.length.toLocaleString()} shown`;
      more.hidden = visible.length >= list.length;
    }

    function resetAndRender() {
      visibleCount = PAGE_SIZE;
      render();
      emitAnalytics('catalog_filtered', null, {
        hasSearch: Boolean(search.value.trim()),
        family: family.value || null,
        platform: platform.value || null,
        stage: stage.value || null,
      });
    }

    for (const control of [search, family, platform, stage]) {
      control.addEventListener(control === search ? 'input' : 'change', resetAndRender);
    }

    page.querySelector('#promptosReset').addEventListener('click', () => {
      search.value = '';
      family.value = '';
      platform.value = '';
      stage.value = '';
      resetAndRender();
    });

    more.addEventListener('click', () => {
      visibleCount += PAGE_SIZE;
      render();
    });

    dialog.querySelector('#promptosClose').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.querySelector('#promptosCompile').addEventListener('click', () => {
      if (!currentRecipe) return;
      const values = {};
      dialog.querySelectorAll('[data-promptos-input]').forEach((control) => {
        values[control.dataset.promptosInput] = control.value;
      });
      currentResult = openPromptCard(currentRecipe, values, {});
      const output = dialog.querySelector('#promptosOutput');
      const readiness = dialog.querySelector('#promptosReadiness');
      const copy = dialog.querySelector('#promptosCopy');
      output.textContent = currentResult.preview;
      copy.disabled = !currentResult.readyToCopy;
      if (currentResult.readyToCopy) {
        readiness.textContent = 'Ready to copy · all required context is present.';
        readiness.dataset.state = 'ready';
        emitAnalytics('compile_ready', currentRecipe);
      } else {
        readiness.textContent = `Missing: ${currentResult.missingInputs.join(', ')}`;
        readiness.dataset.state = 'missing';
        emitAnalytics('compile_missing_input', currentRecipe, { missingCount: currentResult.missingInputs.length });
      }
    });

    dialog.querySelector('#promptosCopy').addEventListener('click', async () => {
      if (!currentRecipe || !currentResult?.readyToCopy) return;
      if (!navigator.clipboard?.writeText) {
        showToast('Clipboard access is unavailable in this browser.');
        return;
      }
      await navigator.clipboard.writeText(currentResult.preview);
      showToast('PromptOS prompt copied.');
      emitAnalytics('prompt_copied', currentRecipe);
    });

    render();
    emitAnalytics('catalog_mounted', null, {
      selectedCount: recipes.length,
      candidateCount: built.candidateCount,
    });
  }

  document.querySelectorAll('[data-page="promptos"]').forEach((button) => {
    button.addEventListener('click', initializeCatalog);
  });
}
