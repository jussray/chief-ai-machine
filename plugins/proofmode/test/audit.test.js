import { test, expect } from "vitest";
import { classifyRepositoryEvidence } from "../src/audit.js";

function fixture(overrides = {}) {
  return {
    owner: "acme",
    repo: "app",
    repositoryUrl: "https://github.com/acme/app",
    ref: "main",
    headSha: "0123456789abcdef0123456789abcdef01234567",
    readme: "# App\nProduction deployment is live and verified.\n",
    paths: [
      "package.json",
      "src/index.js",
      "src/api.js",
      "src/ui.js",
      "test/api.test.js",
      ".github/workflows/ci.yml",
      "wrangler.toml",
      ".well-known/release.json",
    ],
    treeTruncated: false,
    workflows: [
      {
        name: "CI tests",
        conclusion: "success",
        url: "https://github.com/acme/app/actions/runs/1",
      },
    ],
    deployments: [{ environment: "production", latestState: "success" }],
    ...overrides,
  };
}

test("does not promote repository or deployment evidence into runtime verification", () => {
  const report = classifyRepositoryEvidence(fixture());
  const verified = report.layers.find((item) => item.layer === "verified");
  const deployed = report.layers.find((item) => item.layer === "deployed");
  expect(deployed.state).toBe("partial");
  expect(verified.state).toBe("not_proven");
  expect(verified.summary).toMatch(/did not observe the deployed runtime/i);
});

test("supports tested only when test assets and exact-head workflow evidence are paired", () => {
  const report = classifyRepositoryEvidence(fixture());
  const tested = report.layers.find((item) => item.layer === "tested");
  expect(tested.state).toBe("supported");
});

test("downgrades testing when exact-head workflow success is absent", () => {
  const report = classifyRepositoryEvidence(fixture({ workflows: [{ name: "CI tests", conclusion: "failure", url: "https://github.com/acme/app/actions/runs/2" }] }));
  const tested = report.layers.find((item) => item.layer === "tested");
  expect(tested.state).toBe("partial");
});

test("distinguishes a documented claim from proof of the claim", () => {
  const report = classifyRepositoryEvidence(fixture());
  expect(report.layers.find((item) => item.layer === "claimed").state).toBe("supported");
  expect(report.layers.find((item) => item.layer === "verified").state).toBe("not_proven");
});

test("reports incomplete evidence for a thin repository", () => {
  const report = classifyRepositoryEvidence(fixture({ readme: "# Empty\n", paths: ["README.md"], workflows: [], deployments: [] }));
  expect(report.readiness).toBe("evidence_incomplete");
  expect(report.layers.find((item) => item.layer === "implemented").state).toBe("not_proven");
  expect(report.layers.find((item) => item.layer === "tested").state).toBe("not_proven");
});
