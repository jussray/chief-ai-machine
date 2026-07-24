import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [contractText, constitution, pkgText] = await Promise.all([
  read('config/founder-chief-pair.contract.json'),
  read('docs/FOUNDER_INTELLIGENCE_CONSTITUTION.md'),
  read('package.json'),
]);

const contract = JSON.parse(contractText);
const pkg = JSON.parse(pkgText);
const failures = [];
const requireValue = (condition, message) => {
  if (!condition) failures.push(message);
};

requireValue(contract.schemaVersion === 1, 'pair contract schemaVersion must be 1');
requireValue(/^\d{4}-\d{2}-\d{2}\.\d+$/.test(contract.contractVersion), 'contractVersion must be date.revision');
requireValue(contract.pair?.controlRoom === 'jussray/founder-control-room', 'control-room repository drifted');
requireValue(contract.pair?.chiefAI === 'jussray/chief-ai-machine', 'Chief AI repository drifted');
requireValue(pkg.name === 'chief-ai-machine', 'validator is running in the wrong repository');
requireValue(contract.roles?.controlRoom?.join('|') === 'memory|governance|evidence|coordination', 'control-room role contract drifted');
requireValue(contract.roles?.chiefAI?.join('|') === 'reasoning|synthesis|recommendations|executive judgment', 'Chief AI role contract drifted');
requireValue(contract.driftPolicy?.includes('pair drift'), 'pair drift policy is required');
requireValue(contract.runtimeTruthBoundary?.includes('does not prove deployed or runtime behavior'), 'runtime truth boundary is required');

for (const marker of [
  'Founder Control Room and Chief AI paired evolution',
  'Chief AI must not evolve independently',
  'runtime behavior remains unverified',
  'When Chief AI detects that one side has advanced while the other is stale',
]) {
  requireValue(constitution.includes(marker), `constitution missing ${JSON.stringify(marker)}`);
}

for (const field of contract.requiredExecutiveFields ?? []) {
  requireValue(constitution.includes(field), `Chief AI constitution missing executive field ${field}`);
}

if (failures.length > 0) {
  console.error('Founder Control Room / Chief AI pair contract failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(`Pair contract ${contract.contractVersion} passed for Chief AI.`);
console.log('Static repository-policy alignment verified. Runtime behavior remains unverified.');
