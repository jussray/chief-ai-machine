import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f0-9]{40}$/i;

export function classifyProductionIdentity(httpStatus, rawBody, expectedSha) {
  if (!SHA.test(String(expectedSha ?? ''))) {
    throw new Error('INVALID_EXPECTED_SHA');
  }
  if (String(httpStatus) !== '200') return 'runtime_http_error';

  let parsed;
  try {
    parsed = JSON.parse(String(rawBody));
  } catch {
    return 'runtime_non_json';
  }
  const observed = parsed && typeof parsed === 'object' ? parsed.sha : null;
  if (typeof observed !== 'string' || !SHA.test(observed)) {
    return 'runtime_json_missing_sha';
  }
  return observed.toLowerCase() === expectedSha.toLowerCase()
    ? 'exact_runtime_green'
    : 'runtime_sha_mismatch';
}

function printFixedCode(code) {
  switch (code) {
    case 'runtime_http_error': console.log('RUNTIME_HTTP_ERROR'); break;
    case 'runtime_non_json': console.log('RUNTIME_NON_JSON'); break;
    case 'runtime_json_missing_sha': console.log('RUNTIME_JSON_MISSING_SHA'); break;
    case 'runtime_sha_mismatch': console.log('RUNTIME_SHA_MISMATCH'); break;
    case 'exact_runtime_green': console.log('EXACT_RUNTIME_GREEN'); break;
    default:
      console.error('RUNTIME_IDENTITY_CLASSIFICATION_FAILED');
      process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [httpStatus, expectedSha] = process.argv.slice(2);
    const rawBody = readFileSync(0, 'utf8');
    printFixedCode(classifyProductionIdentity(httpStatus, rawBody, expectedSha));
  } catch {
    console.error('RUNTIME_IDENTITY_CLASSIFICATION_FAILED');
    process.exitCode = 1;
  }
}
