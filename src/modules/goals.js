/* global Event, FormData */
import { createGoalPlan, normalizeGoalPlan, summarizeGoalPlan, validateGoalPlan } from '../domain/goal-plan.js';
import { showToast } from './ui.js';

export const GOAL_STORAGE_KEY = 'chief-goals-v1';

function readGoals() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GOAL_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map((goal) => normalizeGoalPlan(goal)).filter(Boolean);
    if (JSON.stringify(normalized) !== JSON.stringify(parsed)) writeGoals(normalized);
    return normalized;
  } catch {
    return [];
  }
}

function writeGoals(goals) {
  localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(Array.isArray(goals) ? goals : []));
}

function splitLines(value) {
  return String(value || '').split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function makeTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function summarizeItems(items, emptyText) {
  if (!Array.isArray(items) || items.length === 0) return emptyText;
  const visible = items.slice(0, 2).join(' → ');
  const remaining = items.length - 2;
  return remaining > 0 ? `${visible} +${remaining}` : visible;
}

function makeTraceStep(label, value, muted = false) {
  const step = document.createElement('div');
  step.className = `goal-trace-step${muted ? ' is-muted' : ''}`;
  step.appendChild(makeTextElement('span', 'goal-trace-label', label));
  step.appendChild(makeTextElement('strong', 'goal-trace-value', value));
  return step;
}

function makeDecisionTrace(goal) {
  const trace = document.createElement('section');
  trace.className = 'goal-trace';
  trace.setAttribute('aria-label', 'Chief decision trace');

  const evidence = summarizeItems(goal.evidence, 'Evidence not recorded yet');
  const route = summarizeItems(goal.strategicLenses, 'No reasoning route recorded');
  const capabilities = summarizeItems(goal.capabilities, 'No capabilities selected');
  const judgment = goal.definitionOfDone || 'Definition of done not recorded';
  const proof = summarizeItems(goal.proofRequirements, 'No proof requirement recorded');
  const nextMove = goal.nextGate || 'Next gate not defined';

  trace.append(
    makeTraceStep('Reality', evidence, !goal.evidence?.length),
    makeTraceStep('Reasoning route', route, !goal.strategicLenses?.length),
    makeTraceStep('Capabilities', capabilities, !goal.capabilities?.length),
    makeTraceStep('Judgment', judgment, !goal.definitionOfDone),
    makeTraceStep('Proof', proof, !goal.proofRequirements?.length),
    makeTraceStep('Next move', nextMove, !goal.nextGate),
  );

  const authority = document.createElement('div');
  authority.className = 'goal-authority';
  authority.appendChild(makeTextElement('span', 'goal-trace-label', 'Authority'));
  authority.appendChild(makeTextElement('strong', '', 'Chief recommends. Founder approval remains the execution gate.'));
  trace.appendChild(authority);

  return trace;
}

export function initGoals() {
  const form = document.getElementById('goalForm');
  const list = document.getElementById('goalList');
  const count = document.getElementById('goalCount');
  const readiness = document.getElementById('goalReadiness');
  if (!form || !list || !count || !readiness) return;

  function render() {
    const goals = readGoals();
    count.textContent = String(goals.length);
    const ready = goals.filter((goal) => validateGoalPlan(goal).valid).length;
    readiness.textContent = goals.length ? `${ready}/${goals.length} ready` : '0/0 ready';
    list.replaceChildren();

    if (!goals.length) {
      list.appendChild(makeTextElement('div', 'empty', 'No founder goals yet. Define the outcome first.'));
      return;
    }

    goals.forEach((goal, index) => {
      const summary = summarizeGoalPlan(goal);
      const item = document.createElement('article');
      item.className = 'citem goal-item';

      const headingRow = document.createElement('div');
      headingRow.className = 'row';
      headingRow.appendChild(makeTextElement('strong', '', goal.goal));
      headingRow.appendChild(makeTextElement('span', 'badge push', summary.status));

      const sub = makeTextElement('div', 'sub', `${goal.project} · ${goal.priority}`);

      const meta = document.createElement('div');
      meta.className = 'goal-meta';
      meta.appendChild(makeTextElement('span', '', `${summary.capabilityCount} capabilities`));
      meta.appendChild(makeTextElement('span', '', `${summary.proofCount} proof gates`));

      const trace = makeDecisionTrace(goal);

      const actions = document.createElement('div');
      actions.className = 'row goal-actions';
      const openButton = makeTextElement('button', 'mini-btn solid', 'Continue in Builder');
      openButton.type = 'button';
      openButton.dataset.goalOpen = String(index);
      const deleteButton = makeTextElement('button', 'mini-btn push', 'Remove');
      deleteButton.type = 'button';
      deleteButton.dataset.goalDelete = String(index);
      actions.append(openButton, deleteButton);

      item.append(headingRow, sub, meta, trace, actions);
      list.appendChild(item);
    });

    list.querySelectorAll('[data-goal-delete]').forEach((button) => {
      button.addEventListener('click', () => {
        const goals = readGoals();
        goals.splice(Number(button.dataset.goalDelete), 1);
        writeGoals(goals);
        render();
      });
    });

    list.querySelectorAll('[data-goal-open]').forEach((button) => {
      button.addEventListener('click', () => {
        const goal = readGoals()[Number(button.dataset.goalOpen)];
        if (!goal) return;
        document.querySelector('[data-page="builder"]')?.click();
        const repo = document.getElementById('bRepo');
        const task = document.getElementById('bTask');
        const constraints = document.getElementById('bConstraints');
        if (repo) repo.value = goal.project;
        if (task) task.value = `${goal.goal}\nDefinition of done: ${goal.definitionOfDone}\nNext gate: ${goal.nextGate}`;
        if (constraints) constraints.value = [...goal.constraints, `Proof: ${goal.proofRequirements.join('; ')}`, `Rollback: ${goal.rollback}`].filter(Boolean).join('\n');
        repo?.dispatchEvent(new Event('input', { bubbles: true }));
        task?.dispatchEvent(new Event('input', { bubbles: true }));
        constraints?.dispatchEvent(new Event('input', { bubbles: true }));
        showToast('Goal loaded into Builder.');
      });
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const data = new FormData(form);
      const plan = createGoalPlan({
        goal: data.get('goal'),
        project: data.get('project'),
        priority: data.get('priority'),
        definitionOfDone: data.get('definitionOfDone'),
        evidence: splitLines(data.get('evidence')),
        constraints: splitLines(data.get('constraints')),
        strategicLenses: splitLines(data.get('strategicLenses')),
        capabilities: splitLines(data.get('capabilities')),
        proofRequirements: splitLines(data.get('proofRequirements')),
        rollback: data.get('rollback'),
        nextGate: data.get('nextGate'),
      });
      const validation = validateGoalPlan(plan);
      if (!validation.valid) {
        showToast(validation.errors[0]);
        return;
      }
      const goals = readGoals();
      goals.unshift(plan);
      writeGoals(goals.slice(0, 50));
      form.reset();
      form.querySelector('[name="priority"]').value = 'now';
      render();
      showToast('Founder goal saved and gated.');
    } catch (error) {
      showToast(error.message || 'Goal could not be saved.');
    }
  });

  render();
}
