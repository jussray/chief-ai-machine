const API = "https://api.github.com";

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
  if (metadata?.private === false && metadata?.visibility === "public") return;
  throw new ProofModeGitHubError(
    "repository_unavailable",
    "Repository or ref was not found or is not publicly readable. ProofMode v0.1 does not access private repositories.",
  );
}

async function githubJson(path, token) {
  const response = await fetch(`${API}${path}`, {
    headers: githubHeaders(token),
  });
  if (response.status === 404) throw new ProofModeGitHubError("repository_unavailable", "Repository or ref was not found or is not publicly readable. ProofMode v0.1 does not access private repositories.");
  if (response.status === 401) throw new ProofModeGitHubError("source_auth_failed", "GitHub rejected ProofMode's server credential. Verify that the token is valid and has not expired or been revoked.");
  if (isRateLimited(response)) throw new ProofModeGitHubError("source_rate_limited", "GitHub rate-limited the evidence request. Retry after the provider quota recovers.");
  if (response.status === 403) throw new ProofModeGitHubError("source_forbidden", "GitHub refused the evidence request. If a server token is configured, verify repository access and read-only Contents, Actions, and Deployments permissions.");
  if (!response.ok) throw new ProofModeGitHubError("source_error", `GitHub evidence request failed with HTTP ${response.status}.`);
  return response.json();
}

async function optionalGitHubJson(path, fallback, token) {
  try {
    return await githubJson(path, token);
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

export async function loadPublicRepositoryEvidence({ owner, repo, ref, token }) {
  const repoPath = `/repos/${encode(owner)}/${encode(repo)}`;
  const metadata = await githubJson(repoPath, token);
  rejectNonPublicRepository(metadata);

  const resolvedRef = ref?.trim() || metadata.default_branch;
  const commit = await githubJson(`${repoPath}/commits/${encode(resolvedRef)}`, token);
  const headSha = commit.sha;
  const treeSha = commit.commit?.tree?.sha;
  if (!treeSha) throw new ProofModeGitHubError("source_error", "GitHub did not return a tree for the requested ref.");

  const [tree, readme, workflowRuns, deployments] = await Promise.all([
    githubJson(`${repoPath}/git/trees/${encode(treeSha)}?recursive=1`, token),
    optionalGitHubJson(`${repoPath}/readme?ref=${encode(resolvedRef)}`, null, token),
    optionalGitHubJson(`${repoPath}/actions/runs?head_sha=${encode(headSha)}&per_page=20`, { workflow_runs: [] }, token),
    optionalGitHubJson(`${repoPath}/deployments?sha=${encode(headSha)}&per_page=10`, [], token),
  ]);

  const deploymentEvidence = await Promise.all(deployments.slice(0, 5).map(async (deployment) => {
    const statuses = await optionalGitHubJson(`${repoPath}/deployments/${deployment.id}/statuses?per_page=1`, [], token);
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
  };
}
