#!/usr/bin/env node

const apiBase = 'https://api.cloudflare.com/client/v4';
const accountId = process.env.CF_ACCOUNT_ID?.trim();
const token = process.env.CF_API_TOKEN?.trim();

function messages(body) {
  return [
    ...(body?.errors ?? []).map((entry) => entry?.message),
    ...(body?.messages ?? []).map((entry) =>
      typeof entry === 'string' ? entry : entry?.message,
    ),
  ].filter(Boolean).join('; ');
}

function safeShape(value) {
  if (!value) return { present: false };
  return {
    present: true,
    length: value.length,
    prefixKind: value.startsWith('cfut_')
      ? 'cfut-user'
      : value.startsWith('cfat_')
        ? 'cfat-account'
        : value.startsWith('cfk_')
          ? 'cfk-global-key'
          : 'unprefixed-or-unknown',
    alphanumericOnly: /^[A-Za-z0-9]+$/.test(value),
    lowercaseHexOnly: /^[a-f0-9]+$/.test(value),
    matchesAccountId: Boolean(accountId && value === accountId),
    hasWhitespace: /\s/.test(value),
    hasNonAscii: /[^\x20-\x7E]/.test(value),
    hasWrappingQuote: /^(?:".*"|'.*')$/.test(value),
    looksLikeAssignment: /^[A-Za-z_][A-Za-z0-9_]*=/.test(value),
    hasBearerPrefix: /^Bearer\s+/i.test(value),
  };
}

async function verify(path) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => null);
  const status = typeof body?.result?.status === 'string' ? body.result.status : null;
  return {
    httpStatus: response.status,
    success: body?.success === true,
    status,
    message: messages(body) || null,
  };
}

if (!accountId || !token) {
  console.log(JSON.stringify({
    classification: 'missing-input',
    accountIdPresent: Boolean(accountId),
    tokenShape: safeShape(token),
  }));
  process.exit(1);
}

const user = await verify('/user/tokens/verify');
const account = await verify(`/accounts/${accountId}/tokens/verify`);

const classification =
  token === accountId
    ? 'account-id-stored-as-token'
    : user.success && user.status === 'active'
      ? 'user-token-active'
      : account.success && account.status === 'active'
        ? 'account-token-active'
        : 'not-accepted-as-user-or-account-token';

console.log(JSON.stringify({
  classification,
  tokenShape: safeShape(token),
  userVerify: user,
  accountVerify: account,
}));

if (classification !== 'user-token-active') process.exitCode = 1;
