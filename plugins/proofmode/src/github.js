const API = "https://api.github.com";
const CODELOAD = "https://codeload.github.com";
const EXACT_SHA = /^[0-9a-f]{40}$/i;
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_ARCHIVE_FILES = 6000;
const MAX_README_BYTES = 1024 * 1024;

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

async function githubJson(path, fetchImpl = fetch) {
  const response = await fetchImpl(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "proofmode-plugin/0.1.0",
    },
  });
  if (response.status === 404) throw new ProofModeGitHubError("repository_unavailable", "Repository or ref was not found or is not publicly readable. ProofMode v0.1 does not access private repositories.");
  if (response.status === 403 || response.status === 429) throw new ProofModeGitHubError("source_rate_limited", "GitHub temporarily refused the public evidence request. Try again later.");
  if (!response.ok) throw new ProofModeGitHubError("source_error", `GitHub evidence request failed with HTTP ${response.status}.`);
  return response.json();
}

async function optionalGitHubJson(path, fallback, fetchImpl = fetch) {
  try { return await githubJson(path, fetchImpl); } catch (error) {
    if (error instanceof ProofModeGitHubError) return fallback;
    throw error;
  }
}

function decodeReadme(payload) {
  if (!payload?.content || payload.encoding !== "base64") return "";
  try {
    const binary = atob(payload.content.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { return ""; }
}

async function loadFromGitHubApi({ owner, repo, ref }, fetchImpl) {
  const repoPath = `/repos/${encode(owner)}/${encode(repo)}`;
  const metadata = await githubJson(repoPath, fetchImpl);
  const resolvedRef = ref?.trim() || metadata.default_branch;
  const commit = await githubJson(`${repoPath}/commits/${encode(resolvedRef)}`, fetchImpl);
  const headSha = commit.sha;
  const treeSha = commit.commit?.tree?.sha;
  if (!treeSha) throw new ProofModeGitHubError("source_error", "GitHub did not return a tree for the requested ref.");

  const [tree, readme, workflowRuns, deployments] = await Promise.all([
    githubJson(`${repoPath}/git/trees/${encode(treeSha)}?recursive=1`, fetchImpl),
    optionalGitHubJson(`${repoPath}/readme?ref=${encode(resolvedRef)}`, null, fetchImpl),
    optionalGitHubJson(`${repoPath}/actions/runs?head_sha=${encode(headSha)}&per_page=20`, { workflow_runs: [] }, fetchImpl),
    optionalGitHubJson(`${repoPath}/deployments?sha=${encode(headSha)}&per_page=10`, [], fetchImpl),
  ]);

  const deploymentEvidence = await Promise.all(deployments.slice(0, 5).map(async (deployment) => {
    const statuses = await optionalGitHubJson(`${repoPath}/deployments/${deployment.id}/statuses?per_page=1`, [], fetchImpl);
    return { environment: deployment.environment || "unspecified", latestState: statuses[0]?.state || "unknown" };
  }));

  return {
    owner, repo, repositoryUrl: metadata.html_url, defaultBranch: metadata.default_branch,
    ref: resolvedRef, headSha, readme: decodeReadme(readme),
    paths: Array.isArray(tree.tree) ? tree.tree.filter((item) => item.type === "blob").map((item) => item.path) : [],
    treeTruncated: Boolean(tree.truncated),
    workflows: Array.isArray(workflowRuns.workflow_runs) ? workflowRuns.workflow_runs.map((run) => ({ name: run.name || "Unnamed workflow", conclusion: run.conclusion || "unknown", url: run.html_url })) : [],
    deployments: deploymentEvidence,
    sourceMode: "github_api",
  };
}

function readString(bytes, start, length) {
  let end = start;
  const limit = Math.min(bytes.length, start + length);
  while (end < limit && bytes[end] !== 0) end += 1;
  return new TextDecoder().decode(bytes.subarray(start, end)).trim();
}

function readOctal(bytes, start, length) {
  const raw = readString(bytes, start, length).replace(/\0/g, "").trim();
  if (!raw) return 0;
  const value = Number.parseInt(raw, 8);
  if (!Number.isFinite(value) || value < 0) throw new ProofModeGitHubError("archive_invalid", "GitHub archive contained an invalid file size.");
  return value;
}

function safeArchivePath(path) {
  if (!path || path.startsWith("/") || path.includes("\\")) return false;
  const parts = path.split("/");
  return parts.every((part) => part && part !== "." && part !== "..");
}

function stripArchiveRoot(path) {
  const slash = path.indexOf("/");
  if (slash < 0) return "";
  return path.slice(slash + 1);
}

export function parseTarArchive(bytes, { maxFiles = MAX_ARCHIVE_FILES } = {}) {
  const paths = [];
  let readme = "";
  let offset = 0;
  let treeTruncated = false;

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;

    const name = readString(header, 0, 100);
    const prefix = readString(header, 345, 155);
    const archivePath = prefix ? `${prefix}/${name}` : name;
    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > bytes.length) throw new ProofModeGitHubError("archive_invalid", "GitHub archive ended before a declared file was complete.");

    if (type === "0" || type === "\0") {
      const path = stripArchiveRoot(archivePath);
      if (safeArchivePath(path)) {
        paths.push(path);
        if (paths.length > maxFiles) {
          treeTruncated = true;
          paths.length = maxFiles;
          break;
        }
        if (!readme && path.toLowerCase() === "readme.md" && size <= MAX_README_BYTES) {
          readme = new TextDecoder().decode(bytes.subarray(dataStart, dataEnd));
        }
      }
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }

  return { paths, readme, treeTruncated };
}

async function readStreamWithLimit(stream, maxBytes) {
  if (!stream) throw new ProofModeGitHubError("archive_unavailable", "GitHub archive response did not contain a body.");
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ProofModeGitHubError("archive_too_large", "Exact-head archive exceeded ProofMode's bounded evidence limit.");
    }
    chunks.push(value);
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

async function loadFromExactShaArchive({ owner, repo, ref }, fetchImpl) {
  const sha = ref?.trim();
  if (!EXACT_SHA.test(sha || "")) {
    throw new ProofModeGitHubError("source_rate_limited", "GitHub temporarily refused the public evidence request. Exact-SHA fallback is unavailable for a moving branch or tag ref.");
  }

  const response = await fetchImpl(`${CODELOAD}/${encode(owner)}/${encode(repo)}/tar.gz/${encode(sha)}`, {
    headers: { "User-Agent": "proofmode-plugin/0.1.0" },
  });
  if (response.status === 404) throw new ProofModeGitHubError("repository_unavailable", "Repository or exact ref was not publicly readable from the bounded archive source.");
  if (response.status === 403 || response.status === 429) throw new ProofModeGitHubError("source_rate_limited", "GitHub temporarily refused both API and exact-head archive evidence requests. Try again later.");
  if (!response.ok) throw new ProofModeGitHubError("source_error", `GitHub exact-head archive request failed with HTTP ${response.status}.`);
  if (typeof globalThis.DecompressionStream !== "function") throw new ProofModeGitHubError("archive_unavailable", "This runtime cannot decompress GitHub's exact-head evidence archive.");

  const decompressed = response.body.pipeThrough(new globalThis.DecompressionStream("gzip"));
  const bytes = await readStreamWithLimit(decompressed, MAX_ARCHIVE_BYTES);
  const archive = parseTarArchive(bytes);

  return {
    owner,
    repo,
    repositoryUrl: `https://github.com/${encode(owner)}/${encode(repo)}`,
    defaultBranch: null,
    ref: sha,
    headSha: sha,
    readme: archive.readme,
    paths: archive.paths,
    treeTruncated: archive.treeTruncated,
    workflows: [],
    deployments: [],
    sourceMode: "exact_sha_archive_fallback",
  };
}

export async function loadPublicRepositoryEvidence({ owner, repo, ref }, { fetchImpl = fetch } = {}) {
  try {
    return await loadFromGitHubApi({ owner, repo, ref }, fetchImpl);
  } catch (error) {
    if (error instanceof ProofModeGitHubError && error.code === "source_rate_limited" && EXACT_SHA.test(ref?.trim() || "")) {
      return loadFromExactShaArchive({ owner, repo, ref }, fetchImpl);
    }
    throw error;
  }
}
