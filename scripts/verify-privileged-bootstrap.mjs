import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OLD_UNTRUSTED_PIN = 'c1acda4363099b7233d5857e8d2e4c97163ef42d';
const RESERVED_CANDIDATE_CONTEXT = 'Verify candidate ProofMode runtime with Playwright';
const PROTECTED_ENVIRONMENT = 'environment: proofmode-access-admin';

const read = (rootDir, relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

export function evaluatePrivilegedBootstrap({ authority, workflows } = {}) {
  const violations = [];
  const config = authority || {};
  const workflowRules = config.workflowRules || {};
  const semantics = config.proofContextSemantics || {};
  const bootstrap = semantics.privilegedBootstrap || {};
  const capability = String(workflows?.capability || '');
  const proofMode = String(workflows?.proofMode || '');
  const admin = String(workflows?.admin || '');
  const production = String(workflows?.production || '');
  const allText = [capability, proofMode, admin, production, JSON.stringify(config)].join('\n');

  const requiredRuleValues = {
    candidateAuthoredWorkflowsMayConsumeProtectedSecrets: false,
    candidateAuthoredWorkflowsMayEnterProtectedEnvironment: false,
    privilegedWorkflowSourceMustEqualCurrentMain: true,
    stalePrivilegedWorkflowSourceFailsClosed: true,
    secretBearingWorkflowDispatchForbidden: true,
    providerAdminUsesDefaultBranchRepositoryDispatch: true,
  };
  for (const [rule, expected] of Object.entries(requiredRuleValues)) {
    if (workflowRules[rule] !== expected) {
      violations.push({ classification: 'privileged-workflow-rule-mismatch', rule, expected, actual: workflowRules[rule] ?? null });
    }
  }

  if (allText.includes(OLD_UNTRUSTED_PIN)) {
    violations.push({ classification: 'historical-untrusted-admin-pin-reintroduced', sha: OLD_UNTRUSTED_PIN });
  }

  if (
    bootstrap.state !== 'BLOCKED_UNTIL_TRUSTED_MAIN_CARRIER'
    || bootstrap.trustedAdminWorkflowSha !== null
    || bootstrap.trustedSourceRule !== 'exact-current-main-only'
    || bootstrap.trigger !== 'repository_dispatch'
    || bootstrap.candidateWorkflowMayInvokeAdmin !== false
    || bootstrap.candidateWorkflowMayReadProtectedSecrets !== false
  ) {
    violations.push({ classification: 'privileged-bootstrap-contract-mismatch', bootstrap });
  }

  for (const [name, text] of [['capability', capability], ['proofmode', proofMode], ['admin', admin], ['production', production]]) {
    if (text.includes('workflow_dispatch:')) {
      violations.push({ classification: 'secret-bearing-arbitrary-ref-dispatch-forbidden', workflow: name });
    }
  }

  if (!admin.includes('repository_dispatch:') || !admin.includes('types: [proofmode_access_admin]')) {
    violations.push({ classification: 'admin-default-branch-dispatch-missing' });
  }
  if (admin.includes('workflow_call:')) {
    violations.push({ classification: 'candidate-callable-admin-workflow-forbidden' });
  }
  if (!admin.includes(PROTECTED_ENVIRONMENT)) {
    violations.push({ classification: 'admin-protected-environment-missing' });
  }
  if (!admin.includes('EXPECTED_MAIN_SHA: ${{ github.event.client_payload.expected_main_sha }}')) {
    violations.push({ classification: 'admin-exact-main-binding-missing' });
  }
  if (!admin.includes('Access repair is repository-owner only')) {
    violations.push({ classification: 'admin-repair-owner-gate-missing' });
  }

  for (const [name, text, eventType] of [
    ['capability', capability, 'chief_candidate_runtime_evidence'],
    ['proofmode', proofMode, 'proofmode_candidate_runtime_evidence'],
  ]) {
    if (!text.includes('repository_dispatch:') || !text.includes(`types: [${eventType}]`)) {
      violations.push({ classification: 'trusted-runtime-default-branch-dispatch-missing', workflow: name });
    }
    const sourceStart = text.indexOf('  source-contract:');
    const dispatchStart = text.indexOf('  dispatch-identity:');
    const evidenceStart = text.indexOf('  trusted-runtime-evidence:');
    if (!(sourceStart >= 0 && dispatchStart > sourceStart && evidenceStart > dispatchStart)) {
      violations.push({ classification: 'trusted-runtime-job-topology-invalid', workflow: name });
      continue;
    }
    const candidateRegion = text.slice(sourceStart, evidenceStart);
    const protectedRegion = text.slice(evidenceStart);
    if (candidateRegion.includes(PROTECTED_ENVIRONMENT) || candidateRegion.includes('CLOUDFLARE_ACCESS_CLIENT_SECRET')) {
      violations.push({ classification: 'candidate-region-secret-bearing', workflow: name });
    }
    if (!protectedRegion.includes(PROTECTED_ENVIRONMENT) || !protectedRegion.includes('ref: ${{ github.sha }}')) {
      violations.push({ classification: 'trusted-evidence-main-binding-missing', workflow: name });
    }
    if (protectedRegion.includes('ref: ${{ env.EXPECTED_HEAD_SHA }}')) {
      violations.push({ classification: 'protected-job-candidate-checkout-forbidden', workflow: name });
    }
  }

  if (proofMode.includes(RESERVED_CANDIDATE_CONTEXT)) {
    violations.push({ classification: 'reserved-candidate-context-emitted-by-github-actions' });
  }
  if (semantics.preMergeCandidateContext !== RESERVED_CANDIDATE_CONTEXT) {
    violations.push({ classification: 'reserved-candidate-context-config-mismatch', actual: semantics.preMergeCandidateContext || null });
  }

  if (!production.includes('push:') || !production.includes('branches: [main]') || production.includes('repository_dispatch:')) {
    violations.push({ classification: 'production-proof-must-be-main-push-only' });
  }
  if (!production.includes(PROTECTED_ENVIRONMENT) || !production.includes('if [ "$EVENT_REF" != "refs/heads/main" ]; then')) {
    violations.push({ classification: 'production-current-main-guard-missing' });
  }

  return {
    schemaVersion: 1,
    state: bootstrap.state || null,
    trustedAdminWorkflowSha: bootstrap.trustedAdminWorkflowSha ?? null,
    violations,
    ok: violations.length === 0,
  };
}

export function writePrivilegedBootstrapReport({
  rootDir = process.cwd(),
  outputPath = 'artifacts/privileged-bootstrap-report.json',
} = {}) {
  const authority = JSON.parse(read(rootDir, 'config/operational-authority.json'));
  const workflows = {
    capability: read(rootDir, '.github/workflows/chief-capability-plan-playwright.yml'),
    proofMode: read(rootDir, '.github/workflows/proofmode-mcp-playwright.yml'),
    admin: read(rootDir, '.github/workflows/proofmode-access-service-auth.yml'),
    production: read(rootDir, '.github/workflows/proofmode-production-playwright.yml'),
  };
  const report = evaluatePrivilegedBootstrap({ authority, workflows });
  const absolute = path.resolve(rootDir, outputPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  return report;
}

const direct = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (direct) {
  const report = writePrivilegedBootstrapReport();
  if (!report.ok) process.exitCode = 1;
}
