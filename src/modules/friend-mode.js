// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

const DEMO_RESULT = {
  truth: {
    verified: ['You need one next action, not a full plan.'],
    inferred: ['The current pressure spans both life and build work.'],
    unknown: ['Which deadline has the nearest real consequence?'],
    conflicted: [],
  },
  priority: {
    domain: 'stability',
    rationale: 'Stability wins until the immediate constraint is named and reduced.',
    competing: ['build', 'relationships'],
  },
  move: {
    action: 'Name the one deadline that creates a real consequence in the next 48 hours.',
    time: '3 minutes',
    confidence: '0.72',
    script: 'The deadline with the nearest real consequence is ____. The smallest move I can finish today is ____.',
  },
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function truthGroup(label, items, tone) {
  const content = items.length
    ? items.map(item => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li class="friend-empty">None detected</li>';
  return `<article class="friend-truth-card" data-tone="${tone}"><h4>${label}</h4><ul>${content}</ul></article>`;
}

function renderResult(result) {
  const output = document.getElementById('friendOutput');
  if (!output) return;
  output.innerHTML = `
    <section class="friend-stage" aria-labelledby="friendTruthTitle">
      <div class="friend-stage-head"><span>01</span><div><h3 id="friendTruthTitle">Truthmode</h3><p>What the system can support, what it is inferring, and what remains unresolved.</p></div></div>
      <div class="friend-truth-grid">
        ${truthGroup('Verified', result.truth.verified, 'verified')}
        ${truthGroup('Inferred', result.truth.inferred, 'inferred')}
        ${truthGroup('Unknown', result.truth.unknown, 'unknown')}
        ${truthGroup('Conflicted', result.truth.conflicted, 'conflicted')}
      </div>
    </section>
    <section class="friend-stage" aria-labelledby="friendPriorityTitle">
      <div class="friend-stage-head"><span>02</span><div><h3 id="friendPriorityTitle">Priority resolver</h3><p>One dominant lane, with the compressed alternatives still visible.</p></div></div>
      <div class="friend-priority-card">
        <div><span class="friend-kicker">Dominant domain</span><strong>${escapeHtml(result.priority.domain)}</strong></div>
        <p>${escapeHtml(result.priority.rationale)}</p>
        <div class="friend-tags">${result.priority.competing.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
      </div>
    </section>
    <section class="friend-stage" aria-labelledby="friendMoveTitle">
      <div class="friend-stage-head"><span>03</span><div><h3 id="friendMoveTitle">One move</h3><p>The smallest useful action Chief AI can justify right now.</p></div></div>
      <div class="friend-move-card">
        <div class="friend-move-meta"><span>${escapeHtml(result.move.time)}</span><span>confidence ${escapeHtml(result.move.confidence)}</span></div>
        <h3>${escapeHtml(result.move.action)}</h3>
        <blockquote>${escapeHtml(result.move.script)}</blockquote>
        <div class="friend-actions"><button class="mini-btn solid" id="friendCopy">Copy script</button><button class="mini-btn" id="friendDone">Mark done</button><button class="mini-btn" id="friendProof">Inspect proof</button></div>
      </div>
    </section>
    <details class="friend-proof" id="friendProofDrawer">
      <summary>Proof trail</summary>
      <dl>
        <div><dt>Source</dt><dd>Current Friend Mode intake</dd></div>
        <div><dt>Decision policy</dt><dd>friend-mode-shell/v1 · static demonstration</dd></div>
        <div><dt>Tool calls</dt><dd>None</dd></div>
        <div><dt>Redteam</dt><dd>Not run in shell mode</dd></div>
        <div><dt>Authority</dt><dd>Suggestion only · no external action taken</dd></div>
      </dl>
    </details>`;

  document.getElementById('friendCopy')?.addEventListener('click', async () => {
    await navigator.clipboard?.writeText(result.move.script);
    document.getElementById('friendCopy').textContent = 'Copied';
  });
  document.getElementById('friendDone')?.addEventListener('click', event => {
    event.currentTarget.textContent = 'Done ✓';
    event.currentTarget.disabled = true;
  });
  document.getElementById('friendProof')?.addEventListener('click', () => {
    const drawer = document.getElementById('friendProofDrawer');
    if (drawer) drawer.open = true;
  });
}

function installStyles() {
  if (document.getElementById('friendModeStyles')) return;
  const style = document.createElement('style');
  style.id = 'friendModeStyles';
  style.textContent = `
    .friend-shell{display:grid;gap:16px}.friend-intake{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(260px,.6fr);gap:14px}.friend-intake textarea{min-height:170px}.friend-control-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.friend-notice{padding:11px 12px;border:1px solid var(--border);border-radius:var(--r-md);background:var(--surface-2);color:var(--text-muted);font-size:12px}.friend-output{display:grid;gap:14px}.friend-stage{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px}.friend-stage-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}.friend-stage-head>span{font-family:var(--mono);font-size:10px;color:var(--primary);border:1px solid var(--primary-glow);background:var(--primary-dim);border-radius:999px;padding:3px 7px}.friend-stage-head h3{font-family:var(--mono);font-size:14px}.friend-stage-head p{color:var(--text-muted);font-size:12px;margin-top:2px}.friend-truth-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.friend-truth-card{border:1px solid var(--border);border-radius:var(--r-md);padding:12px;background:var(--surface-2)}.friend-truth-card h4{font-family:var(--mono);font-size:11px;margin-bottom:8px}.friend-truth-card ul{padding-left:16px;color:var(--text-muted);font-size:12px}.friend-truth-card[data-tone=verified] h4{color:var(--accent-green)}.friend-truth-card[data-tone=inferred] h4{color:var(--accent-blue)}.friend-truth-card[data-tone=unknown] h4{color:var(--accent-yellow)}.friend-truth-card[data-tone=conflicted] h4{color:var(--accent-red)}.friend-empty{list-style:none;margin-left:-16px}.friend-priority-card,.friend-move-card{border:1px solid var(--border-2);border-radius:var(--r-md);padding:16px;background:var(--surface-2)}.friend-priority-card{display:grid;grid-template-columns:180px 1fr auto;gap:14px;align-items:center}.friend-kicker{display:block;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-faint)}.friend-priority-card strong{font-family:var(--mono);font-size:18px;color:var(--primary)}.friend-priority-card p{color:var(--text-muted)}.friend-tags{display:flex;gap:6px;flex-wrap:wrap}.friend-tags span,.friend-move-meta span{font-family:var(--mono);font-size:10px;padding:3px 8px;border-radius:999px;border:1px solid var(--border);color:var(--text-muted)}.friend-move-meta{display:flex;gap:8px;margin-bottom:12px}.friend-move-card h3{font-family:var(--mono);font-size:18px;line-height:1.35;max-width:50ch}.friend-move-card blockquote{margin:14px 0;padding:12px 14px;border-left:3px solid var(--primary);background:var(--code-bg);color:var(--text-muted);font-family:var(--mono);font-size:12px}.friend-actions{display:flex;gap:8px;flex-wrap:wrap}.friend-proof{border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface);padding:14px 16px}.friend-proof summary{cursor:pointer;font-family:var(--mono);font-size:12px;font-weight:700}.friend-proof dl{display:grid;gap:8px;margin-top:12px}.friend-proof dl div{display:grid;grid-template-columns:140px 1fr;gap:10px;padding-top:8px;border-top:1px solid var(--border)}.friend-proof dt{font-family:var(--mono);font-size:10px;color:var(--text-faint)}.friend-proof dd{color:var(--text-muted);font-size:12px}@media(max-width:900px){.friend-intake{grid-template-columns:1fr}.friend-truth-grid{grid-template-columns:1fr 1fr}.friend-priority-card{grid-template-columns:1fr}.friend-control-grid{grid-template-columns:1fr}}@media(max-width:560px){.friend-truth-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function installNavigation() {
  const brainButton = document.querySelector('.sidebar [data-page="brain"]');
  if (brainButton && !document.querySelector('.sidebar [data-page="friend"]')) {
    const button = document.createElement('button');
    button.className = 'nav-item';
    button.dataset.page = 'friend';
    button.innerHTML = '🫶 Friend Mode <span class="n-count">beta</span>';
    brainButton.insertAdjacentElement('afterend', button);
  }

  const mobileBrain = document.querySelector('.mobile-nav [data-page="brain"]');
  if (mobileBrain && !document.querySelector('.mobile-nav [data-page="friend"]')) {
    const button = document.createElement('button');
    button.className = 'nav-item';
    button.dataset.page = 'friend';
    button.textContent = '🫶';
    mobileBrain.insertAdjacentElement('afterend', button);
  }
}

function installPage() {
  if (document.getElementById('page-friend')) return;
  const main = document.querySelector('main.main');
  const brain = document.getElementById('page-brain');
  if (!main || !brain) return;
  const section = document.createElement('section');
  section.className = 'page';
  section.id = 'page-friend';
  section.innerHTML = `
    <div class="page-head">
      <div class="crumb">chief-ai <span>/</span> <b>friend-mode</b></div>
      <h2>Turn the whole situation into one move that matters.</h2>
      <p>Life and build context share one intake. Truthmode separates evidence from inference, the priority resolver selects one lane, and Chief AI returns one bounded suggestion with a proof trail.</p>
    </div>
    <div class="friend-shell">
      <section class="friend-intake">
        <div class="panel">
          <div class="panel-title"><span class="dot"></span>Tell Chief AI</div>
          <div class="field"><label>What is happening?</label><textarea id="friendInput" placeholder="Dump the situation without cleaning it up first."></textarea></div>
          <div class="friend-actions"><button class="mini-btn solid" id="friendResolve">Resolve one move</button><button class="mini-btn" id="friendClear">Clear</button></div>
        </div>
        <aside class="panel">
          <div class="panel-title"><span class="dot"></span>Current state</div>
          <div class="friend-control-grid">
            <div class="field"><label>Energy</label><select id="friendEnergy"><option>low</option><option selected>medium</option><option>high</option></select></div>
            <div class="field"><label>Time available</label><select id="friendTime"><option>5 minutes</option><option selected>15 minutes</option><option>30 minutes</option></select></div>
          </div>
          <div class="friend-notice"><strong>Shell mode:</strong> no model, memory, inbox, calendar, or external action is connected. The result below demonstrates the product contract without pretending execution exists.</div>
        </aside>
      </section>
      <div class="friend-output" id="friendOutput"><div class="fs-placeholder">Tell Chief AI what is happening, then resolve one move.</div></div>
    </div>`;
  brain.insertAdjacentElement('afterend', section);
}

export function initFriendMode() {
  installStyles();
  installNavigation();
  installPage();

  document.getElementById('friendResolve')?.addEventListener('click', () => {
    const input = document.getElementById('friendInput');
    if (!input?.value.trim()) {
      input?.focus();
      return;
    }
    const result = structuredClone(DEMO_RESULT);
    result.truth.verified.unshift(`You said: “${input.value.trim().slice(0, 140)}${input.value.trim().length > 140 ? '…' : ''}”`);
    renderResult(result);
  });

  document.getElementById('friendClear')?.addEventListener('click', () => {
    const input = document.getElementById('friendInput');
    if (input) input.value = '';
    const output = document.getElementById('friendOutput');
    if (output) output.innerHTML = '<div class="fs-placeholder">Tell Chief AI what is happening, then resolve one move.</div>';
  });
}
