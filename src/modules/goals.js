import { createGoalPlan, summarizeGoalPlan, validateGoalPlan } from '../domain/goal-plan.js';
import { showToast } from './ui.js';

export const GOAL_STORAGE_KEY = 'chief-goals-v1';

function readGoals() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GOAL_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGoals(goals) {
  localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goals));
}

function splitLines(value) {
  return String(value || '').split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

export function initGoals() {
  const form = document.getElementById('goalForm');
  const list = document.getElementById('goalList');
  const count = document.getElementById('goalCount');
  const readiness = document.getElementById('goalReadiness');
  if (!form || !list) return;

  function render() {
    const goals = readGoals();
    count.textContent = goals.length;
    const ready = goals.filter((goal) => validateGoalPlan(goal).valid).length;
    readiness.textContent = goals.length ? `${ready}/${goals.length} ready` : '0/0 ready';
    list.innerHTML = goals.length ? '' : '<div class="empty">No founder goals yet. Define the outcome first.</div>';

    goals.forEach((goal, index) => {
      const summary = summarizeGoalPlan(goal);
      const item = document.createElement('article');
      item.className = 'citem goal-item';
      item.innerHTML = `
        <div class="row"><strong>${goal.goal}</strong><span class="badge push">${summary.status}</span></div>
        <div class="sub">${goal.project} · ${goal.priority}</div>
        <div class="goal-meta"><span>${summary.capabilityCount} capabilities</span><span>${summary.proofCount} proof gates</span></div>
        <div class="goal-gate"><b>Next gate</b>${goal.nextGate || 'Not defined'}</div>
        <div class="row"><button class="mini-btn" data-goal-open="${index}">Use in Builder</button><button class="mini-btn push" data-goal-delete="${index}">Remove</button></div>`;
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
