import fs from 'node:fs/promises';
import path from 'node:path';

const WORKFLOW_ROOT = '.github/workflows';
const FULL_SHA = /^[0-9a-f]{40}$/i;

async function workflowFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await workflowFiles(fullPath));
      continue;
    }
    if (/\.ya?ml$/i.test(entry.name)) files.push(fullPath);
  }

  return files.sort();
}

function normalizeUsesTarget(raw) {
  const trimmed = raw.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed.split(/\s+#/)[0].trim();
}

export function mutableUsesInWorkflow(source, file = '<workflow>') {
  const violations = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(/^\s*(?:-\s*)?uses:\s*(.+?)\s*$/);
    if (!match) return;

    const target = normalizeUsesTarget(match[1]);
    if (!target || target.startsWith('./') || target.startsWith('docker://')) return;

    const at = target.lastIndexOf('@');
    const ref = at >= 0 ? target.slice(at + 1) : '';
    if (!FULL_SHA.test(ref)) {
      violations.push({ file, line: index + 1, target });
    }
  });

  return violations;
}

const files = await workflowFiles(WORKFLOW_ROOT);
const violations = [];

for (const file of files) {
  const source = await fs.readFile(file, 'utf8');
  violations.push(...mutableUsesInWorkflow(source, file));
}

if (violations.length) {
  console.error('Mutable GitHub Action references are forbidden. Pin every remote uses: reference to a full 40-character commit SHA.');
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} ${violation.target}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Verified immutable action pins across ${files.length} workflow files.`);
}
