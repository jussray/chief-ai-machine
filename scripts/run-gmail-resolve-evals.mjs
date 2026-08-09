import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const skillPath = new URL('../skills/gmail-resolve/SKILL.md', import.meta.url);
const evalSuitePath = new URL('../skills/gmail-resolve/references/eval-suite.md', import.meta.url);
const fixturesPath = new URL('../skills/gmail-resolve/evals/scenarios.json', import.meta.url);

function evaluateAssertion(assertion, sources) {
  const sourceText = sources[assertion.source];
  if (typeof sourceText !== 'string') {
    return {
      ...assertion,
      passed: false,
      error: `Unknown assertion source: ${assertion.source}`,
    };
  }

  if (assertion.kind === 'contains') {
    return {
      ...assertion,
      passed: sourceText.includes(assertion.value),
    };
  }

  if (assertion.kind === 'regex') {
    try {
      const expression = new RegExp(assertion.value, assertion.flags || '');
      return {
        ...assertion,
        passed: expression.test(sourceText),
      };
    } catch (error) {
      return {
        ...assertion,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    ...assertion,
    passed: false,
    error: `Unknown assertion kind: ${assertion.kind}`,
  };
}

export function evaluateGmailResolveContract({ skill, evalSuite, fixtures }) {
  const scenarios = Array.isArray(fixtures?.scenarios) ? fixtures.scenarios : [];
  const ids = scenarios.map((scenario) => scenario.id);
  const titles = scenarios.map((scenario) => scenario.title);
  const configurationErrors = [];

  if (fixtures?.scope !== 'contract') {
    configurationErrors.push('Fixture scope must remain "contract" until live Gmail execution is actually measured.');
  }
  if (fixtures?.schemaVersion !== 1) {
    configurationErrors.push('Unsupported Gmail Resolve eval schemaVersion.');
  }
  if (new Set(ids).size !== ids.length) {
    configurationErrors.push('Scenario ids must be unique.');
  }
  if (new Set(titles).size !== titles.length) {
    configurationErrors.push('Scenario titles must be unique.');
  }

  const sources = { skill, evalSuite };
  const scenarioResults = scenarios.map((scenario) => {
    const assertions = Array.isArray(scenario.assertions)
      ? scenario.assertions.map((assertion) => evaluateAssertion(assertion, sources))
      : [];
    const failedAssertions = assertions.filter((assertion) => !assertion.passed);

    return {
      id: scenario.id,
      title: scenario.title,
      category: scenario.category,
      expectedOutcome: scenario.expectedOutcome,
      passed: assertions.length > 0 && failedAssertions.length === 0,
      assertions,
    };
  });

  const totalAssertions = scenarioResults.reduce((total, scenario) => total + scenario.assertions.length, 0);
  const passedAssertions = scenarioResults.reduce(
    (total, scenario) => total + scenario.assertions.filter((assertion) => assertion.passed).length,
    0,
  );
  const passedScenarios = scenarioResults.filter((scenario) => scenario.passed).length;
  const failedScenarios = scenarioResults.length - passedScenarios;
  const status = configurationErrors.length === 0 && failedScenarios === 0 && scenarioResults.length > 0
    ? 'pass'
    : 'fail';

  return {
    schemaVersion: fixtures?.schemaVersion ?? null,
    skillVersion: fixtures?.skillVersion ?? null,
    scope: fixtures?.scope ?? null,
    disclaimer: fixtures?.disclaimer ?? null,
    generatedAt: new Date().toISOString(),
    status,
    configurationErrors,
    summary: {
      scenarios: scenarioResults.length,
      passedScenarios,
      failedScenarios,
      totalAssertions,
      passedAssertions,
      failedAssertions: totalAssertions - passedAssertions,
      scenarioPassRate: scenarioResults.length === 0 ? 0 : passedScenarios / scenarioResults.length,
    },
    scenarios: scenarioResults,
  };
}

function parseOutputPath(argv) {
  const equalsArg = argv.find((argument) => argument.startsWith('--output='));
  if (equalsArg) return equalsArg.slice('--output='.length);

  const outputIndex = argv.indexOf('--output');
  if (outputIndex >= 0) return argv[outputIndex + 1] || null;

  return null;
}

function run() {
  const skill = readFileSync(skillPath, 'utf8');
  const evalSuite = readFileSync(evalSuitePath, 'utf8');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const scorecard = evaluateGmailResolveContract({ skill, evalSuite, fixtures });
  const outputPath = parseOutputPath(process.argv.slice(2));

  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(scorecard, null, 2)}\n`);
  }

  console.log(
    `Gmail Resolve contract evals: ${scorecard.summary.passedScenarios}/${scorecard.summary.scenarios} scenarios, `
      + `${scorecard.summary.passedAssertions}/${scorecard.summary.totalAssertions} assertions passed.`,
  );

  if (scorecard.status !== 'pass') {
    for (const error of scorecard.configurationErrors) {
      console.error(`Configuration: ${error}`);
    }
    for (const scenario of scorecard.scenarios.filter((candidate) => !candidate.passed)) {
      console.error(`Scenario failed: ${scenario.id}`);
      for (const assertion of scenario.assertions.filter((candidate) => !candidate.passed)) {
        console.error(`- ${assertion.source}/${assertion.kind}: ${assertion.value}`);
      }
    }
    process.exitCode = 1;
  }
}

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) run();
