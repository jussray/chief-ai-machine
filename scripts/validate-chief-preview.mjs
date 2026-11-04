import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const CHIEF_PREVIEW_HOST = /^[a-f0-9]{8}-chief-ai\.mcgill-raylene\.workers\.dev$/;

// Only accept a completed exact-head check from the installed Cloudflare app.
// Never use untrusted check text as an HTTP destination with Access credentials.
export function selectTrustedChiefPreview(data, expectedSha, cloudflareAppId = 85455) {
  if (!SHA_PATTERN.test(expectedSha || '') || !Number.isSafeInteger(cloudflareAppId) || cloudflareAppId < 1) {
    throw new Error('Invalid exact-head proof inputs');
  }
  if (!data || !Array.isArray(data.check_runs)) {
    throw new Error('Invalid Cloudflare check response');
  }

  const matches = data.check_runs.filter((check) => (
    check?.name === 'Workers Builds: chief-ai'
    && check.head_sha === expectedSha
    && check.app?.id === cloudflareAppId
    && check.status === 'completed'
    && check.conclusion === 'success'
  ));
  if (matches.length === 0) throw new Error('Missing trusted exact-head Cloudflare build');

  const urls = matches.map((check) => {
    const summary = check.output?.summary;
    if (typeof summary !== 'string') throw new Error('Missing Cloudflare preview receipt');
    const receipts = [...summary.matchAll(/^Preview URL:[ \t]*(\S+)[ \t]*$/gm)];
    if (receipts.length !== 1) throw new Error('Ambiguous Cloudflare preview receipt');

    const raw = receipts[0][1];
    let preview;
    try {
      preview = new URL(raw);
    } catch {
      throw new Error('Invalid Cloudflare preview URL');
    }
    if (preview.protocol !== 'https:'
      || preview.username
      || preview.password
      || preview.port
      || preview.search
      || preview.hash
      || preview.pathname !== '/'
      || !CHIEF_PREVIEW_HOST.test(preview.hostname)
      || (raw !== preview.origin && raw !== `${preview.origin}/`)) {
      throw new Error('Untrusted Cloudflare preview origin');
    }
    return preview.origin;
  });

  if (new Set(urls).size !== 1) throw new Error('Conflicting exact-head Cloudflare preview origins');
  return urls[0];
}

// Version promotion must be bound to the same trusted preview identity.
// A matching check name or an unvalidated provider summary is not authority.
export function selectTrustedChiefVersion(data, expectedSha, cloudflareAppId = 85455) {
  const preview = selectTrustedChiefPreview(data, expectedSha, cloudflareAppId);
  const trusted = data.check_runs.filter((check) => (
    check?.name === 'Workers Builds: chief-ai'
    && check.head_sha === expectedSha
    && check.app?.id === cloudflareAppId
    && check.status === 'completed'
    && check.conclusion === 'success'
  ));
  const ids = trusted.map((check) => {
    const summary = check.output?.summary;
    if (typeof summary !== 'string') throw new Error('Missing trusted Cloudflare version receipt');
    const receipts = [...summary.matchAll(/^Version ID:[ \\t]*([0-9a-f-]+)[ \\t]*$/gim)];
    if (receipts.length !== 1) throw new Error('Ambiguous Cloudflare Version ID');
    const id = receipts[0][1].toLowerCase();
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id)) {
      throw new Error('Malformed Cloudflare Version ID');
    }
    if (id.slice(0, 8) !== new URL(preview).hostname.slice(0, 8)) {
      throw new Error('Cloudflare version is not bound to the verified preview');
    }
    return id;
  });
  if (new Set(ids).size !== 1) throw new Error('Conflicting Cloudflare Version IDs');
  return ids[0];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let raw = '';
    for await (const chunk of process.stdin) raw += chunk;
    const expectedSha = process.env.EXPECTED_HEAD_SHA;
    const appId = Number(process.env.CLOUDFLARE_CHECK_APP_ID);
    const mode = process.argv[2] || 'preview';
    if (mode !== 'preview' && mode !== 'version') throw new Error('Unsupported proof mode');
    const data = JSON.parse(raw);
    process.stdout.write(mode === 'version'
      ? selectTrustedChiefVersion(data, expectedSha, appId)
      : selectTrustedChiefPreview(data, expectedSha, appId));
  } catch {
    // Do not echo an untrusted URL, response body, token or authorization header.
    process.stderr.write('Trusted exact-head Chief preview is unavailable.\n');
    process.exitCode = 1;
  }
}
