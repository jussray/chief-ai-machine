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

async function githubJson(path) {
  const response = await fetch(`${API}${path}`, {
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

async function optionalGitHubJson(path, fallback) {
  try { return await githubJson(path); } catch (error) {
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

export async function loadPublicRepositoryEvidence({ owner, repo, ref }) {
  const repoPath = `/repos/${encode(owner)}/${encode(repo)}`;
  const metadata = await githubJson(repoPath);
  const resolvedRef = ref?.trim() || metadata.default_branch;
  const commit = await githubJson(`${repoPath}/commits/${encode(resolvedRef)}`);
  const headSha = commit.sha;
  const treeSha = commit.commit?.tree?.sha;
  if (!treeSha) throw new ProofModeGitHubError("source_error", "GitHub did not return a tree for the requested ref.");

  const [tree, readme, workflowRuns, deployments] = await Promise.all([
    githubJson(`${repoPath}/git/trees/${encode(treeSha)}?recursive=1`),
    optionalGitHubJson(`${repoPath}/readme?ref=${encode(resolvedRef)}`, null),
    optionalGitHubJson(`${repoPath}/actions/runs?head_sha=${encode(headSha)}&per_page=20`, { workflow_runs: [] }),
    optionalGitHubJson(`${repoPath}/deployments?sha=${encode(headSha)}&per_page=10`, []),
  ]);

  const deploymentEvidence = await Promise.all(deployments.slice(0, 5).map(async (deployment) => {
    const statuses = await optionalGitHubJson(`${repoPath}/deployments/${deployment.id}/statuses?per_page=1`, []);
    return { environment: deployment.environment || "unspecified", latestState: statuses[0]?.state || "unknown" };
  }));

  return {
    owner, repo, repositoryUrl: metadata.html_url, defaultBranch: metadata.default_branch,
    ref: resolvedRef, headSha, readme: decodeReadme(readme),
    paths: Array.isArray(tree.tree) ? tree.tree.filter((item) => item.type === "blob").map((item) => item.path) : [],
    treeTruncated: Boolean(tree.truncated),
    workflows: Array.isArray(workflowRuns.workflow_runs) ? workflowRuns.workflow_runs.map((run) => ({ name: run.name || "Unnamed workflow", conclusion: run.conclusion || "unknown", url: run.html_url })) : [],
    deployments: deploymentEvidence,
  };
}
