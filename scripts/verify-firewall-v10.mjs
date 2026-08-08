import { readFileSync } from 'node:fs';

const policyPath = 'security/firewall-v10.policy.json';
const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
const failures = [];

function requireTruthy(path, value) {
  if (!value) failures.push(`${path} must be truthy`);
}

function requireEqual(path, value, expected) {
  if (value !== expected) failures.push(`${path} expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`);
}

function requireArray(path, value, min = 1) {
  if (!Array.isArray(value) || value.length < min) failures.push(`${path} must contain at least ${min} item(s)`);
}

requireEqual('version', policy.version, '10');
requireTruthy('repository', policy.repository);
requireTruthy('cloudflare.managedWaf.enabled', policy.cloudflare?.managedWaf?.enabled);
requireArray('cloudflare.primaryHosts', policy.cloudflare?.primaryHosts);
requireTruthy('controls.rateLimiting.enabled', policy.controls?.rateLimiting?.enabled);
requireArray('controls.rateLimiting.routes', policy.controls?.rateLimiting?.routes, 2);
requireTruthy('controls.botDefense.enabled', policy.controls?.botDefense?.enabled);
requireTruthy('controls.auth.failClosed', policy.controls?.auth?.failClosed);
requireTruthy('controls.auth.privateRoutesRequireServerVerifiedSession', policy.controls?.auth?.privateRoutesRequireServerVerifiedSession);
requireTruthy('controls.auth.forbiddenClientSecrets', policy.controls?.auth?.forbiddenClientSecrets);
requireTruthy('controls.headers.csp', policy.controls?.headers?.csp);
requireTruthy('controls.headers.hsts', policy.controls?.headers?.hsts);
requireTruthy('controls.integrations.githubWritesRequireExactHead', policy.controls?.integrations?.githubWritesRequireExactHead);
requireTruthy('controls.integrations.hubspotWritesRequireExplicitApproval', policy.controls?.integrations?.hubspotWritesRequireExplicitApproval);
requireTruthy('controls.integrations.draftOnlyByDefault', policy.controls?.integrations?.draftOnlyByDefault);
requireTruthy('controls.observability.securityEventsRequiredBeforeBlockMode', policy.controls?.observability?.securityEventsRequiredBeforeBlockMode);
requireTruthy('controls.observability.noSilentNulls', policy.controls?.observability?.noSilentNulls);
requireTruthy('controls.productDesign.blockedStateMustBeHumanReadable', policy.controls?.productDesign?.blockedStateMustBeHumanReadable);
requireTruthy('controls.productDesign.legitimateUsersGetRecoveryPath', policy.controls?.productDesign?.legitimateUsersGetRecoveryPath);
requireTruthy('controls.productDesign.noMisleadingConnectedOrProtectedClaims', policy.controls?.productDesign?.noMisleadingConnectedOrProtectedClaims);

const invalidRoute = policy.controls.rateLimiting.routes.find((route) => !route.match || !route.limit || !route.periodSeconds || !route.action);
if (invalidRoute) failures.push(`rate limit route is incomplete: ${JSON.stringify(invalidRoute)}`);

if (policy.activationStage === 'block-production' && !policy.controls.observability.securityEventsRequiredBeforeBlockMode) {
  failures.push('block-production requires observed security events first');
}

if (failures.length) {
  console.error('Firewall v10 policy failed verification:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Firewall v10 policy verified for ${policy.repository}`);
