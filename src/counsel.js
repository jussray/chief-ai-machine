/* global FormData */
import {
  LEGAL_AREA_TAXONOMY,
  LEGAL_BOOK_CATEGORIES,
  LEGAL_SOURCE_FAMILIES,
} from '../plugins/lawyer/src/source-registry.js';
import {
  LEGAL_TRUTH_STATES,
  classifyLegalSource,
  evaluateLegalFinding,
} from '../plugins/lawyer/src/authority.js';

const STORAGE_KEY = 'truth-weaver-counsel.issues.v1';
const RED_TEAM_CATEGORIES = Object.freeze([
  'Contrary controlling authority',
  'Wrong or unresolved jurisdiction',
  'Superseding or amended law',
  'Exception or exemption',
  'Procedural bar or missed deadline',
  'Missing legal element',
  'Weak or inadmissible evidence',
  'Burden of proof mismatch',
  'Standing, venue, or forum defect',
  'Remedy unavailable or limited',
]);

const AUTHORITY_LAYERS = Object.freeze([
  ['International / treaty', 'Treaties, conventions, transnational instruments, and status/implementation rules.'],
  ['Supranational / national', 'Constitutions, legislation, regulations, official gazettes, and national high courts.'],
  ['State / province / territory / tribal', 'Subnational constitutions, codes, regulations, court decisions, and recognized Indigenous legal authority.'],
  ['County / municipal / tribunal', 'Local ordinances, bylaws, court or tribunal rules, administrative decisions, and local implementation.'],
]);

const AREA_ICONS = ['⌂','◈','♟','⌁','✎','⚖','♡','◎','§','☷','◇','△','⊕','◉','◫','⬡','✦','⌘','◌','♢','☼','♧','⌬','▤','⌖','∞','✤','⚓','✓','↗','⊙','□','⋯'];
let sourceFilter = 'all';
let searchQuery = '';
let selectedIssueId = null;
let issues = loadIssues();

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function labelize(value = '') {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix = 'item') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadIssues() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistIssues() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2800);
}

function addResearchLog(issue, action, detail = '') {
  issue.researchLog ||= [];
  issue.researchLog.unshift({ id: uid('log'), at: nowIso(), action, detail });
  issue.updatedAt = nowIso();
}

function createIssue(data) {
  const issue = {
    id: uid('issue'),
    title: data.title.trim(),
    description: data.description.trim(),
    jurisdiction: data.jurisdiction.trim(),
    asOfDate: data.asOfDate || new Date().toISOString().slice(0, 10),
    area: data.area || 'custom',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    facts: '',
    elements: '',
    evidence: '',
    remedies: '',
    procedure: '',
    findings: [],
    redTeam: RED_TEAM_CATEGORIES.map((category) => ({ category, complete: false, note: '' })),
    researchLog: [],
  };
  addResearchLog(issue, 'Issue created', `Jurisdiction entered: ${issue.jurisdiction}`);
  issues.unshift(issue);
  selectedIssueId = issue.id;
  persistIssues();
  renderIssues();
  renderWorkspace();
  return issue;
}

function currentIssue() {
  return issues.find((issue) => issue.id === selectedIssueId) || null;
}

function updateIssue(patch, logAction = 'Issue updated') {
  const issue = currentIssue();
  if (!issue) return;
  Object.assign(issue, patch);
  addResearchLog(issue, logAction);
  persistIssues();
  renderIssues();
}

function matchesQuery(...values) {
  if (!searchQuery) return true;
  const haystack = values.join(' ').toLowerCase();
  return haystack.includes(searchQuery);
}

function renderAreas() {
  const grid = $('#areaGrid');
  const quickArea = $('#quickArea');
  const visible = LEGAL_AREA_TAXONOMY.filter((area) => matchesQuery(area));
  grid.innerHTML = visible.map((area, index) => `
    <button class="area-card" type="button" data-area="${escapeHtml(area)}">
      <span class="area-icon">${AREA_ICONS[index % AREA_ICONS.length]}</span>
      <strong>${escapeHtml(labelize(area))}</strong>
      <span>Route issue research</span>
    </button>`).join('');
  quickArea.innerHTML = LEGAL_AREA_TAXONOMY.map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(labelize(area))}</option>`).join('');
  $$('.area-card').forEach((button) => button.addEventListener('click', () => {
    quickArea.value = button.dataset.area;
    $$('.area-card').forEach((card) => card.classList.toggle('active', card === button));
    $('#quickIssueForm [name="title"]').focus();
    toast(`${labelize(button.dataset.area)} selected`);
  }));
}

function renderSources() {
  const list = $('#sourceList');
  const sources = LEGAL_SOURCE_FAMILIES.filter((source) => {
    const role = classifyLegalSource(source);
    return (sourceFilter === 'all' || role === sourceFilter)
      && matchesQuery(source.name, source.coverage, source.jurisdictionScope, source.sourceType, source.note);
  });
  list.innerHTML = sources.length ? sources.map((source) => {
    const role = classifyLegalSource(source);
    return `<article class="source-card" data-source-role="${role}">
      <div><h3>${escapeHtml(source.name)}</h3><p>${escapeHtml(source.coverage || '')}</p>
        <div class="source-meta"><span class="badge ${role}">${role}</span><span class="badge">${escapeHtml(source.sourceType)}</span><span class="badge">${escapeHtml(source.jurisdictionScope)}</span>${source.official ? '<span class="badge">official publisher</span>' : ''}</div>
      </div>
      <a class="source-link" href="${escapeHtml(source.baseUrl)}" target="_blank" rel="noreferrer">Open source ↗</a>
    </article>`;
  }).join('') : '<div class="empty-state">No registered source families match this filter.</div>';
}

function renderBooks() {
  $('#bookGrid').innerHTML = LEGAL_BOOK_CATEGORIES.filter((category) => matchesQuery(category)).map((category) => `
    <article class="book-card"><strong>${escapeHtml(labelize(category))}</strong><span>SECONDARY BY DEFAULT</span></article>`).join('');
}

function renderAuthorityMap() {
  $('#authorityMap').innerHTML = AUTHORITY_LAYERS.map(([name, copy]) => `<article class="authority-level"><p class="eyebrow">AUTHORITY LAYER</p><h3>${escapeHtml(name)}</h3><small>${escapeHtml(copy)}</small></article>`).join('');
}

function coverageState(source) {
  if (source.adapterImplemented === true) return 'implemented';
  return source.baseUrl ? 'linked' : 'missing';
}

function renderCoverage() {
  $('#coverageGrid').innerHTML = LEGAL_SOURCE_FAMILIES.filter((source) => matchesQuery(source.name, source.coverage, source.jurisdictionScope)).map((source) => {
    const state = coverageState(source);
    const text = state === 'implemented' ? 'Implemented source adapter' : state === 'linked' ? 'Linked source family' : 'Not yet integrated';
    return `<article class="coverage-card"><span class="status ${state}">${text}</span><h3>${escapeHtml(source.name)}</h3><p>${escapeHtml(source.note || source.coverage || '')}</p></article>`;
  }).join('');
}

function renderIssues() {
  const list = $('#issueList');
  const visible = issues.filter((issue) => matchesQuery(issue.title, issue.description, issue.jurisdiction, issue.area));
  $('#issueEmpty').hidden = issues.length > 0;
  list.innerHTML = visible.map((issue) => `<button class="issue-item ${issue.id === selectedIssueId ? 'active' : ''}" type="button" data-issue-id="${issue.id}"><strong>${escapeHtml(issue.title)}</strong><small>${escapeHtml(issue.jurisdiction)} · ${escapeHtml(labelize(issue.area))}</small></button>`).join('');
  $$('.issue-item').forEach((button) => button.addEventListener('click', () => {
    selectedIssueId = button.dataset.issueId;
    renderIssues();
    renderWorkspace();
  }));
}

const WORKSPACE_TABS = [
  ['facts', 'Facts'],
  ['jurisdiction', 'Jurisdiction'],
  ['law', 'Governing Law'],
  ['elements', 'Elements'],
  ['evidence', 'Evidence'],
  ['remedies', 'Remedies & Defenses'],
  ['procedure', 'Procedure & Deadlines'],
  ['counter', 'Counterauthority'],
  ['books', 'Books & Commentary'],
  ['log', 'Research Log'],
];

function renderWorkspace() {
  const root = $('#workspace');
  const issue = currentIssue();
  if (!issue) {
    root.innerHTML = '<div class="workspace-empty">Select or create an issue to open the legal research workspace.</div>';
    return;
  }
  root.innerHTML = `
    <div class="workspace-head">
      <div><div class="workspace-path">ISSUE → FACTS → JURISDICTION → GOVERNING LAW → OPTIONS</div><h3>${escapeHtml(issue.title)}</h3><p class="muted">${escapeHtml(issue.jurisdiction)} · as of ${escapeHtml(issue.asOfDate)}</p></div>
      <button class="button ghost" id="deleteIssue" type="button">Delete local issue</button>
    </div>
    <div class="workspace-tabs" role="tablist">${WORKSPACE_TABS.map(([id, label], index) => `<button class="workspace-tab ${index === 0 ? 'active' : ''}" type="button" role="tab" data-tab="${id}">${label}</button>`).join('')}</div>
    ${factsPanel(issue)}${jurisdictionPanel(issue)}${lawPanel(issue)}${textPanel(issue,'elements','Elements / rules','List the legal elements or rules that must be satisfied.','elements')}${textPanel(issue,'evidence','Evidence','Map evidence to each element. Distinguish verified evidence from allegations.','evidence')}${textPanel(issue,'remedies','Remedies & defenses','What remedies, defenses, exceptions, exemptions, or limitations might apply?','remedies')}${textPanel(issue,'procedure','Procedure & deadlines','Court/agency path, filing rules, service, limitations periods, hearing dates, deadlines.','procedure')}${counterPanel(issue)}${booksPanel()}${logPanel(issue)}
  `;
  bindWorkspace(issue);
}

function factsPanel(issue) {
  return `<section class="workspace-panel active" data-panel="facts"><div class="workspace-grid"><div><label>Plain-language issue<textarea id="issueDescription">${escapeHtml(issue.description)}</textarea></label></div><div><label>Facts and allegations<textarea id="issueFacts" placeholder="Separate VERIFIED FACTS from ALLEGED FACTS.">${escapeHtml(issue.facts || '')}</textarea></label></div></div></section>`;
}

function jurisdictionPanel(issue) {
  return `<section class="workspace-panel" data-panel="jurisdiction"><div class="workspace-grid"><label>Entered jurisdiction<input id="issueJurisdiction" value="${escapeHtml(issue.jurisdiction)}" /></label><label>As-of date<input id="issueAsOf" type="date" value="${escapeHtml(issue.asOfDate)}" /></label></div><div class="guard-message">COUNSEL never infers governing jurisdiction from device location. Court/tribunal hierarchy and conflict-of-law questions remain research tasks until resolved.</div></section>`;
}

function lawPanel(issue) {
  const findings = issue.findings || [];
  return `<section class="workspace-panel" data-panel="law">
    <div class="workspace-grid">
      <div><h4>Add legal proposition</h4><label>Proposition<textarea id="findingProposition" placeholder="State one material proposition of law."></textarea></label><label>Authority type<select id="findingSourceType"><option value="statute">Statute / code</option><option value="regulation">Regulation / rule</option><option value="judicial_decision">Judicial decision</option><option value="constitution">Constitution</option><option value="treaty">Treaty / instrument</option><option value="ordinance">Ordinance / bylaw</option><option value="court_rule">Court rule</option><option value="treatise">Treatise / book (secondary)</option></select></label><label>Citation / identifier<input id="findingCitation" placeholder="Citation, section, docket, instrument ID…" /></label></div>
      <div><h4>Verification inputs</h4><label>Jurisdiction<input id="findingJurisdiction" value="${escapeHtml(issue.jurisdiction)}" /></label><label><input id="findingOfficial" type="checkbox" style="width:auto"> Official or authenticated source confirmed</label><label><input id="findingCurrent" type="checkbox" style="width:auto"> Currentness / as-of status verified</label><button class="button primary" id="verifyFinding" type="button">Attempt VERIFIED LAW</button><div id="findingGuard" class="guard-message">No authority = no VERIFIED LAW badge.</div></div>
    </div>
    <div class="source-meta" style="margin:18px 0">${LEGAL_TRUTH_STATES.map((state) => `<span class="badge">${escapeHtml(state)}</span>`).join('')}</div>
    <div class="finding-list">${findings.length ? findings.map((finding) => `<article class="finding-card"><span class="truth-state ${finding.truthState === 'VERIFIED LAW' ? 'verified' : 'blocked'}">${escapeHtml(finding.truthState)}</span><p>${escapeHtml(finding.proposition)}</p><small class="muted">${escapeHtml(finding.reason)}</small></article>`).join('') : '<div class="empty-state">No saved legal findings yet.</div>'}</div>
  </section>`;
}

function textPanel(issue, id, title, placeholder, field) {
  return `<section class="workspace-panel" data-panel="${id}"><label>${escapeHtml(title)}<textarea class="persist-text" data-field="${field}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(issue[field] || '')}</textarea></label></section>`;
}

function counterPanel(issue) {
  return `<section class="workspace-panel" data-panel="counter"><p class="muted">Red-team the position before relying on it. Checked items mean researched, not defeated or resolved.</p><div class="redteam-list">${issue.redTeam.map((item, index) => `<label class="redteam-card"><input type="checkbox" data-redteam-index="${index}" ${item.complete ? 'checked' : ''}><span><strong>${escapeHtml(item.category)}</strong><textarea data-redteam-note="${index}" placeholder="Research note / contrary authority / unresolved question">${escapeHtml(item.note || '')}</textarea></span></label>`).join('')}</div></section>`;
}

function booksPanel() {
  return `<section class="workspace-panel" data-panel="books"><div class="guard-message">Books & commentary are research accelerators, not automatic governing authority.</div><div class="book-grid">${LEGAL_BOOK_CATEGORIES.map((category) => `<article class="book-card"><strong>${escapeHtml(labelize(category))}</strong><span>SECONDARY BY DEFAULT</span></article>`).join('')}</div></section>`;
}

function logPanel(issue) {
  return `<section class="workspace-panel" data-panel="log">${(issue.researchLog || []).map((entry) => `<article class="fact-box"><strong>${escapeHtml(entry.action)}</strong><p class="muted">${escapeHtml(new Date(entry.at).toLocaleString())}${entry.detail ? ` · ${escapeHtml(entry.detail)}` : ''}</p></article>`).join('') || '<div class="empty-state">No research log entries.</div>'}</section>`;
}

function bindWorkspace(issue) {
  $$('.workspace-tab', $('#workspace')).forEach((button) => button.addEventListener('click', () => {
    $$('.workspace-tab', $('#workspace')).forEach((tab) => tab.classList.toggle('active', tab === button));
    $$('.workspace-panel', $('#workspace')).forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === button.dataset.tab));
  }));
  $('#deleteIssue')?.addEventListener('click', () => {
    issues = issues.filter((entry) => entry.id !== issue.id);
    selectedIssueId = issues[0]?.id || null;
    persistIssues();
    renderIssues();
    renderWorkspace();
    toast('Local issue deleted');
  });
  $('#issueDescription')?.addEventListener('change', (event) => updateIssue({ description: event.target.value }, 'Issue description updated'));
  $('#issueFacts')?.addEventListener('change', (event) => { issue.facts = event.target.value; addResearchLog(issue, 'Facts updated'); persistIssues(); });
  $('#issueJurisdiction')?.addEventListener('change', (event) => { issue.jurisdiction = event.target.value; addResearchLog(issue, 'Jurisdiction edited', event.target.value); persistIssues(); renderIssues(); });
  $('#issueAsOf')?.addEventListener('change', (event) => { issue.asOfDate = event.target.value; addResearchLog(issue, 'As-of date updated', event.target.value); persistIssues(); });
  $$('.persist-text', $('#workspace')).forEach((textarea) => textarea.addEventListener('change', () => { issue[textarea.dataset.field] = textarea.value; addResearchLog(issue, `${labelize(textarea.dataset.field)} updated`); persistIssues(); }));
  $$('[data-redteam-index]', $('#workspace')).forEach((checkbox) => checkbox.addEventListener('change', () => { const item = issue.redTeam[Number(checkbox.dataset.redteamIndex)]; item.complete = checkbox.checked; addResearchLog(issue, 'Red-team checklist updated', item.category); persistIssues(); }));
  $$('[data-redteam-note]', $('#workspace')).forEach((textarea) => textarea.addEventListener('change', () => { issue.redTeam[Number(textarea.dataset.redteamNote)].note = textarea.value; persistIssues(); }));
  $('#verifyFinding')?.addEventListener('click', () => verifyFinding(issue));
}

function verifyFinding(issue) {
  const proposition = $('#findingProposition').value.trim();
  if (!proposition) { toast('Add a proposition first'); return; }
  const sourceType = $('#findingSourceType').value;
  const citation = $('#findingCitation').value.trim();
  const jurisdictionId = $('#findingJurisdiction').value.trim();
  const source = {
    id: uid('authority'),
    name: citation || 'Unidentified authority',
    sourceType,
    sourceRole: ['treatise','hornbook','practice_guide','law_review','commentary'].includes(sourceType) ? 'secondary' : 'primary',
    jurisdictionId,
    citation,
    official: $('#findingOfficial').checked,
    authentic: $('#findingOfficial').checked,
    currentnessStatus: $('#findingCurrent').checked ? 'verified' : 'unknown',
  };
  const result = evaluateLegalFinding({ jurisdictionId, sources: [source], contrarySources: [] });
  issue.findings.unshift({ id: uid('finding'), proposition, truthState: result.truthState, verifiedLaw: result.verifiedLaw, reason: result.reason, source, createdAt: nowIso() });
  addResearchLog(issue, 'Legal proposition evaluated', `${result.truthState}: ${proposition}`);
  persistIssues();
  const guard = $('#findingGuard');
  guard.classList.toggle('ok', result.verifiedLaw);
  guard.textContent = `${result.truthState}: ${result.reason}`;
  toast(result.verifiedLaw ? 'VERIFIED LAW gate satisfied' : `Promotion blocked: ${result.truthState}`);
  setTimeout(() => renderWorkspace(), 900);
}

function bindGlobal() {
  $('#quickIssueForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const issue = createIssue(data);
    event.currentTarget.reset();
    $('#quickArea').value = issue.area;
    location.hash = 'issues';
    toast('Research issue created locally');
  });
  $$('.chip').forEach((button) => button.addEventListener('click', () => {
    sourceFilter = button.dataset.sourceFilter;
    $$('.chip').forEach((chip) => chip.classList.toggle('active', chip === button));
    renderSources();
  }));
  $('#globalSearch').addEventListener('input', (event) => {
    searchQuery = event.target.value.trim().toLowerCase();
    renderAreas();
    renderSources();
    renderBooks();
    renderCoverage();
    renderIssues();
  });
  $('#exportIssues').addEventListener('click', () => {
    const payload = JSON.stringify({ contract: 'truth-weaver-counsel-local-export@v1', exportedAt: nowIso(), issues }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `truth-weaver-counsel-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast('Local issues exported');
  });
}

renderAreas();
renderSources();
renderBooks();
renderAuthorityMap();
renderCoverage();
selectedIssueId = issues[0]?.id || null;
renderIssues();
renderWorkspace();
bindGlobal();
