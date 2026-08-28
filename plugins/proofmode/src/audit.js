const LAYERS = ["claimed", "implemented", "tested", "deployed", "verified"];
const STATES = new Set(["supported", "partial", "not_proven", "blocked"]);

const SOURCE_DIRS = /^(src|app|server|api|worker|lib|packages|supabase|functions)\//i;
const CODE_FILE = /\.(js|mjs|cjs|ts|tsx|jsx|py|go|rs|java|kt|swift|rb|php|cs)$/i;
const MANIFEST = /^(package\.json|pyproject\.toml|requirements\.txt|go\.mod|cargo\.toml|pom\.xml|build\.gradle|composer\.json)$/i;
const TEST_PATH = /(^|\/)(__tests__|tests?|e2e|specs?)(\/|\.)|\.(test|spec)\.[^.]+$/i;
const WORKFLOW_PATH = /^\.github\/workflows\//i;
const DEPLOY_PATH = /(^|\/)(wrangler\.(toml|jsonc?)|vercel\.json|netlify\.toml|fly\.toml|Dockerfile|docker-compose\.ya?ml|cloudbuild\.ya?ml)$|(^|\/)(deploy|deployment|release)[^/]*\.(ya?ml|json|toml)$/i;
const RELEASE_MARKER_PATH = /(^|\/)\.well-known\/|release[-_.]?marker|release\.json$|version\.json$|^VERSION$/i;
const CLAIM_LINE = /\b(production|deployed|live|verified|tested|passing|integrated|implemented|launch|release)\b/i;
const TEST_WORKFLOW = /\b(test|ci|verify|lint|build|quality|gate|check)\b/i;

function githubFileUrl(input, path) {
  return `https://github.com/${encodeURIComponent(input.owner)}/${encodeURIComponent(
    input.repo
  )}/blob/${encodeURIComponent(input.headSha)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function evidence(source, summary, url) {
  return { source, summary, ...(url ? { url } : {}) };
}

function layer(layerName, state, summary, items = []) {
  if (!LAYERS.includes(layerName) || !STATES.has(state)) {
    throw new Error(`Invalid ProofMode layer result: ${layerName}/${state}`);
  }
  return {
    layer: layerName,
    state,
    summary,
    evidence: items.slice(0, 8),
  };
}

function readmeClaims(input) {
  return input.readme
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && CLAIM_LINE.test(line))
    .map((line) => line.replace(/^#+\s*/, "").slice(0, 240))
    .slice(0, 8);
}

function isExactHeadTestWorkflow(run, headSha) {
  const event = typeof run?.event === "string" ? run.event.toLowerCase() : "unknown";
  if (event === "pull_request_target") return false;
  if (run?.headSha && run.headSha !== headSha) return false;
  return run?.conclusion === "success" && TEST_WORKFLOW.test(run?.name || "");
}

export function classifyRepositoryEvidence(input) {
  const paths = input.paths || [];
  const claims = readmeClaims(input);
  const codePaths = paths.filter(
    (path) => !TEST_PATH.test(path) && (SOURCE_DIRS.test(path) || CODE_FILE.test(path))
  );
  const manifests = paths.filter((path) => MANIFEST.test(path));
  const testPaths = paths.filter((path) => TEST_PATH.test(path));
  const workflowPaths = paths.filter((path) => WORKFLOW_PATH.test(path));
  const deployPaths = paths.filter((path) => DEPLOY_PATH.test(path));
  const markerPaths = paths.filter((path) => RELEASE_MARKER_PATH.test(path));
  const successfulWorkflows = (input.workflows || []).filter((run) =>
    isExactHeadTestWorkflow(run, input.headSha)
  );
  const successfulDeployments = (input.deployments || []).filter((deployment) =>
    ["success", "active"].includes(deployment.latestState)
  );

  const claimed = claims.length
    ? layer(
        "claimed",
        "supported",
        `Found ${claims.length} project claim${claims.length === 1 ? "" : "s"} in repository documentation. This proves the claims exist, not that they are true.`,
        claims.map((claim) => evidence("README", claim, `${input.repositoryUrl}#readme`))
      )
    : layer(
        "claimed",
        "not_proven",
        "No release, production, implementation, testing, or verification claims were detected in the README."
      );

  const implementedItems = [
    ...manifests.slice(0, 3).map((path) => evidence("manifest", path, githubFileUrl(input, path))),
    ...codePaths.slice(0, 5).map((path) => evidence("source", path, githubFileUrl(input, path))),
  ];
  const implemented =
    codePaths.length >= 3 && manifests.length >= 1
      ? layer(
          "implemented",
          "supported",
          `Repository structure contains implementation source plus a project manifest (${codePaths.length} non-test code artifacts detected).`,
          implementedItems
        )
      : codePaths.length > 0 || manifests.length > 0
        ? layer(
            "implemented",
            "partial",
            "Some implementation artifacts are present, but the repository structure is too thin to call implementation strongly evidenced.",
            implementedItems
          )
        : layer(
            "implemented",
            "not_proven",
            "No recognizable implementation source or project manifest was found."
          );

  const testedItems = [
    ...testPaths.slice(0, 4).map((path) => evidence("test artifact", path, githubFileUrl(input, path))),
    ...successfulWorkflows.slice(0, 4).map((run) =>
      evidence(
        "exact-head workflow",
        `${run.name}: success${run.event ? ` (${run.event})` : ""}`,
        run.url
      )
    ),
  ];
  const tested =
    testPaths.length > 0 && successfulWorkflows.length > 0
      ? layer(
          "tested",
          "supported",
          "Test artifacts exist and at least one eligible test/verification-style GitHub Actions workflow succeeded for the exact audited commit. pull_request_target runs are excluded because they execute in base-branch context and can misattribute unrelated PR evidence to the audited SHA.",
          testedItems
        )
      : testPaths.length > 0 || successfulWorkflows.length > 0 || workflowPaths.length > 0
        ? layer(
            "tested",
            "partial",
            "Testing machinery exists, but ProofMode could not pair test artifacts with an eligible successful verification-style workflow on the exact audited commit.",
            testedItems.length
              ? testedItems
              : workflowPaths.slice(0, 6).map((path) => evidence("workflow", path, githubFileUrl(input, path)))
          )
        : layer(
            "tested",
            "not_proven",
            "No repository test artifacts or exact-head verification workflow evidence was found."
          );

  const deployedItems = [
    ...deployPaths.slice(0, 5).map((path) => evidence("deployment config", path, githubFileUrl(input, path))),
    ...successfulDeployments.slice(0, 3).map((deployment) =>
      evidence(
        "GitHub deployment record",
        `${deployment.environment}: ${deployment.latestState}`,
        `${input.repositoryUrl}/deployments`
      )
    ),
  ];
  const deployed =
    successfulDeployments.length > 0 || deployPaths.length > 0
      ? layer(
          "deployed",
          "partial",
          "Deployment evidence exists, but repository configuration or a deployment-platform record does not prove that the intended runtime is healthy or serving this exact commit.",
          deployedItems
        )
      : layer(
          "deployed",
          "not_proven",
          "No deployment configuration or successful exact-commit GitHub deployment record was found."
        );

  const verifiedItems = markerPaths.slice(0, 6).map((path) =>
    evidence("repository release-marker artifact", path, githubFileUrl(input, path))
  );
  const verified = layer(
    "verified",
    "not_proven",
    markerPaths.length
      ? "Release-marker machinery exists in the repository, but ProofMode v0.1 did not observe the deployed runtime. Repository files cannot verify themselves."
      : "No live runtime witness was observed. ProofMode v0.1 intentionally does not promote repository evidence into runtime verification.",
    verifiedItems
  );

  const layers = [claimed, implemented, tested, deployed, verified];
  const readiness =
    implemented.state === "supported" && tested.state === "supported"
      ? "repository_supported_runtime_unverified"
      : "evidence_incomplete";

  const nextChecks = [];
  if (tested.state !== "supported") {
    nextChecks.push("Record a successful eligible test/verification workflow for the exact commit being evaluated.");
  }
  if (deployed.state === "not_proven") {
    nextChecks.push("Provide deployment evidence tied to the exact audited commit.");
  }
  nextChecks.push(
    "Verify a live release marker or health witness that returns the exact deployed commit before calling the project verified."
  );
  if (input.treeTruncated) {
    nextChecks.push("Repeat the audit with a bounded source inventory because GitHub reported a truncated recursive tree.");
  }

  return {
    repository: `${input.owner}/${input.repo}`,
    repositoryUrl: input.repositoryUrl,
    ref: input.ref,
    headSha: input.headSha,
    readiness,
    layers,
    nextChecks,
    limitations: [
      "Public GitHub repository evidence only in v0.1.",
      "No live runtime probing is performed in v0.1.",
      "pull_request_target workflows are not accepted as exact-head test proof because their head SHA represents base-branch context.",
      "A supported layer means the stated evidence threshold was met; it is not a universal production-readiness certification.",
    ],
  };
}

export function getLayer(report, requestedLayer) {
  return report.layers.find((item) => item.layer === requestedLayer) || null;
}
