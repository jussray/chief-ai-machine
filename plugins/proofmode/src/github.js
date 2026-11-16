const API = "https://api.github.com";
const EXACT_SHA = /^[0-9a-f]{40}$/i;
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;
const MAX_TAR_BYTES = 32 * 1024 * 1024;
const MAX_ARCHIVE_FILES = 5000;
const MAX_README_BYTES = 256 * 1024;

export class ProofModeGitHubError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProofModeGitHubError";
    this.code = code;
  }
}

function encode(value) {
  return encodeURIComponent(value);
}

function githubHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "proofmode-plugin/0.1.0",
  };
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (normalizedToken) headers.Authorization = `Bearer ${normalizedToken}`;
  return headers;
}

function responseHeader(response, name) {
  const headers = response?.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  const lower = name.toLowerCase();
  return headers[name] || headers[lower] || "";
}

function isRateLimited(response) {
  if (response.status === 429) return true;
  if (response.status !== 403) return false;
  return responseHeader(response, "x-ratelimit-remaining") === "0"
    || Boolean(responseHeader(response, "retry-after"));
}

function rejectNonPublicRepository(metadata) {
  const visibility = metadata?.visibility;
  const privateFlag = metadata?.private;
  const explicitlyNonPublic = privateFlag === true
    || (typeof visibility === "string" && visibility !== "public");
  if (!explicitlyNonPublic) return;
  throw new ProofModeGitHubError(
    "repository_unavailable",
    "Repository or ref was not found or is not publicly readable. ProofMode v0.1 does not access private repositories.",
  );
}

async function githubJson(path, token, fetchImpl) {
  const response = await fetchImpl(`${API}${path}`, {
    headers: githubHeaders(token),
  });
  if (response.status === 404) throw new ProofModeGitHubError("repository_unavailable", "Repository or ref was not found or is not publicly readable. ProofMode v0.1 does not access private repositories.");
  if (response.status === 401) throw new ProofModeGitHubError("source_auth_failed", "GitHub rejected ProofMode's server credential. Verify that the token is valid and has not expired or been revoked.");
  if (isRateLimited(response)) throw new ProofModeGitHubError("source_rate_limited", "GitHub rate-limited the evidence request. Retry after the provider quota recovers.");
  if (response.status === 403) throw new ProofModeGitHubError("source_forbidden", "GitHub refused the evidence request. If a server token is configured, verify repository access and read-only Contents, Actions, and Deployments permissions.");
  if (response.status === 422) throw new ProofModeGitHubError("source_unprocessable", "GitHub could not materialize the requested exact repository object.");
  if (!response.ok) throw new ProofModeGitHubError("source_error", `GitHub evidence request failed with HTTP ${response.status}.`);
  return response.json();
}

async function optionalGitHubJson(path, fallback, token, fetchImpl) {
  try {
    return await githubJson(path, token, fetchImpl);
  } catch (error) {
    if (error instanceof ProofModeGitHubError && error.code === "repository_unavailable") return fallback;
    throw error;
  }
}

function decodeReadme(payload) {
  if (!payload?.content || payload.encoding !== "base64") return "";
  try {
    const binary = atob(payload.content.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function tarString(bytes, start, length) {
  return new TextDecoder().decode(bytes.slice(start, start + length)).replace(/\0.*$/s, "").trim();
}

function safeArchivePath(rawPath) {
  if (!rawPath || rawPath.startsWith("/") || rawPath.includes("\\") || rawPath.includes("\0")) return null;
  const parts = rawPath.split("/");
  if (parts.some((part) => part === ".." || part === ".")) return null;
  if (parts.length < 2) return null;
  const relative = parts.slice(1).join("/");
  if (!relative || relative.startsWith("/") || relative.split("/").some((part) => !part || part === ".." || part === ".")) return null;
  return relative;
}

export function parseTarArchive(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  if (bytes.byteLength > MAX_TAR_BYTES) {
    throw new ProofModeGitHubError("source_archive_too_large", "GitHub archive exceeded the bounded ProofMode evidence limit.");
  }

  const paths = [];
  let readme = "";
  let offset = 0;
  let files = 0;

  while (offset + 512 <= bytes.byteLength) {
    const header = bytes.slice(offset, offset + 512);
    const empty = header.every((value) => value === 0);
    if (empty) break;

    const rawPath = tarString(header, 0, 100);
    const sizeRaw = tarString(header, 124, 12).replace(/\0/g, "");
    const size = Number.parseInt(sizeRaw || "0", 8);
    const type = String.fromCharCode(header[156] || 48);
    if (!Number.isFinite(size) || size < 0) {
      throw new ProofModeGitHubError("source_archive_invalid", "GitHub archive contained an invalid TAR entry size.");
    }

    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > bytes.byteLength) {
      throw new ProofModeGitHubError("source_archive_invalid", "GitHub archive ended inside a TAR entry.");
    }

    if (type === "0" || type === "\0") {
      const relative = safeArchivePath(rawPath);
      if (relative) {
        files += 1;
        if (files > MAX_ARCHIVE_FILES) {
          throw new ProofModeGitHubError("source_archive_too_large", "GitHub archive contained too many evidence files.");
        }
        paths.push(relative);
        if (!readme && /^readme(?:\.[a-z0-9._-]+)?$/i.test(relative)) {
          const bounded = bytes.slice(contentStart, Math.min(contentEnd, contentStart + MAX_README_BYTES));
          readme = new TextDecoder().decode(bounded);
        }
      }
    }

    offset = contentStart + Math.ceil(size / 512) * 512;
  }

  return {
    paths: [...new Set(paths)].sort(),
    readme,
  };
}

async function gunzipIfNeeded(bytes) {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  if (typeof DecompressionStream !== "function") {
    throw new ProofModeGitHubError("source_archive_unavailable", "This runtime cannot decompress GitHub public archives.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const decompressed = new Uint8Array(await new Response(stream).arrayBuffer());
  if (decompressed.byteLength > MAX_TAR_BYTES) {
    throw new ProofModeGitHubError("source_archive_too_large", "GitHub archive expanded beyond the bounded ProofMode evidence limit.");
  }
  return decompressed;
}

function mayUseExactArchive(error, ref) {
  return EXACT_SHA.test(String(ref || ""))
    && error instanceof ProofModeGitHubError
    && ["source_rate_limited", "source_unprocessable"].includes(error.code);
}

async function exactArchiveEvidence({ owner, repo, sha, metadata, fetchImpl }) {
  const response = await fetchImpl(
    `https://codeload.github.com/${encode(owner)}/${encode(repo)}/tar.gz/${encode(sha)}`,
    { headers: { "User-Agent": "proofmode-plugin/0.1.0" } },
  );
  if (!response.ok) {
    throw new ProofModeGitHubError("source_archive_unavailable", `GitHub public archive request failed with HTTP ${response.status}.`);
  }

  const compressed = new Uint8Array(await response.arrayBuffer());
  if (compressed.byteLength > MAX_ARCHIVE_BYTES) {
    throw new ProofModeGitHubError("source_archive_too_large", "GitHub public archive exceeded the bounded ProofMode download limit.");
  }
  const parsed = parseTarArchive(await gunzipIfNeeded(compressed));

  return {
    owner,
    repo,
    repositoryUrl: metadata?.html_url || `https://github.com/${owner}/${repo}`,
    defaultBranch: metadata?.default_branch || null,
    ref: sha,
    headSha: sha,
    readme: parsed.readme,
    paths: parsed.paths,
    treeTruncated: false,
    workflows: [],
    deployments: [],
    sourceMode: "exact_sha_archive_fallback",
  };
}

export async function loadPublicRepositoryEvidence({ owner, repo, ref, token }, options = {}) {
  const fetchImpl = typeof options.fetchImpl === "function" ? options.fetchImpl : globalThis.fetch;
  const repoPath = `/repos/${encode(owner)}/${encode(repo)}`;
  let metadata;

  try {
    metadata = await githubJson(repoPath, token, fetchImpl);
  } catch (error) {
    if (mayUseExactArchive(error, ref)) {
      return exactArchiveEvidence({ owner, repo, sha: ref.trim(), metadata: null, fetchImpl });
    }
    throw error;
  }

  rejectNonPublicRepository(metadata);
  const resolvedRef = ref?.trim() || metadata.default_branch;

  try {
    const commit = await githubJson(`${repoPath}/commits/${encode(resolvedRef)}`, token, fetchImpl);
    const headSha = commit.sha;
    const treeSha = commit.commit?.tree?.sha;
    if (!treeSha) throw new ProofModeGitHubError("source_error", "GitHub did not return a tree for the requested ref.");

    const [tree, readme, workflowRuns, deployments] = await Promise.all([
      githubJson(`${repoPath}/git/trees/${encode(treeSha)}?recursive=1`, token, fetchImpl),
      optionalGitHubJson(`${repoPath}/readme?ref=${encode(resolvedRef)}`, null, token, fetchImpl),
      optionalGitHubJson(`${repoPath}/actions/runs?head_sha=${encode(headSha)}&per_page=20`, { workflow_runs: [] }, token, fetchImpl),
      optionalGitHubJson(`${repoPath}/deployments?sha=${encode(headSha)}&per_page=10`, [], token, fetchImpl),
    ]);

    const deploymentEvidence = await Promise.all(deployments.slice(0, 5).map(async (deployment) => {
      const statuses = await optionalGitHubJson(`${repoPath}/deployments/${deployment.id}/statuses?per_page=1`, [], token, fetchImpl);
      return { environment: deployment.environment || "unspecified", latestState: statuses[0]?.state || "unknown" };
    }));

    return {
      owner,
      repo,
      repositoryUrl: metadata.html_url,
      defaultBranch: metadata.default_branch,
      ref: resolvedRef,
      headSha,
      readme: decodeReadme(readme),
      paths: Array.isArray(tree.tree) ? tree.tree.filter((item) => item.type === "blob").map((item) => item.path) : [],
      treeTruncated: Boolean(tree.truncated),
      workflows: Array.isArray(workflowRuns.workflow_runs) ? workflowRuns.workflow_runs.map((run) => ({ name: run.name || "Unnamed workflow", conclusion: run.conclusion || "unknown", url: run.html_url })) : [],
      deployments: deploymentEvidence,
      sourceMode: "github_api",
    };
  } catch (error) {
    if (mayUseExactArchive(error, resolvedRef)) {
      return exactArchiveEvidence({ owner, repo, sha: resolvedRef, metadata, fetchImpl });
    }
    throw error;
  }
}
