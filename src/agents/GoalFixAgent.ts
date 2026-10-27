import { Agent, callable, routeAgentRequest } from 'agents';

/**
 * GoalFixAgent: Automated repo audit, bottleneck identification, focused fix, and verification.
 *
 * Triggered by:
 * - GitHub PR comment: /goalfix <goal>
 * - Direct API call: POST /agents/goalfix/{instance-id}
 *
 * Workflow:
 * 1. OBSERVE: Clone repo, inspect branch, gather evidence
 * 2. AUDIT: Identify bottleneck (verified/inferred/unknown)
 * 3. FIX: Apply smallest reversible patch
 * 4. VERIFY: Run tests, type checks, Playwright proof
 * 5. REPORT: Return REALITY/FIX/PROOF/RISK/ROLLBACK/NEXT GATE
 */

interface Env {
  [key: string]: any;
}

interface Connection {
  [key: string]: any;
}

export interface GoalFixState {
  goal: string;
  repoUrl: string;
  targetBranch: string;
  baseSha: string;
  headSha: string;
  stage: 'pending' | 'observing' | 'auditing' | 'fixing' | 'verifying' | 'completed' | 'failed';
  bottleneck: {
    classification: 'VERIFIED_BOTTLENECK' | 'INFERRED_BOTTLENECK' | 'UNKNOWN_BOTTLENECK' | null;
    description: string;
    evidence: string[];
  };
  fixApplied: {
    filesChanged: string[];
    commit: string;
    reversible: boolean;
  } | null;
  verificationResults: {
    typecheck: { passed: boolean; output: string };
    tests: { passed: boolean; output: string };
    playwright: { passed: boolean; evidence: string };
  } | null;
  report: string;
  errors: string[];
}

export class GoalFixAgent extends Agent<Env, GoalFixState> {
  initialState: GoalFixState = {
    goal: '',
    repoUrl: '',
    targetBranch: '',
    baseSha: '',
    headSha: '',
    stage: 'pending',
    bottleneck: {
      classification: null,
      description: '',
      evidence: [],
    },
    fixApplied: null,
    verificationResults: null,
    report: '',
    errors: [],
  };

  async onConnect(connection: Connection) {
    if (this.state.stage === 'pending' && this.state.goal) {
      this.startWorkflow();
    }
  }

  async startWorkflow() {
    try {
      this.setState({ stage: 'observing' });

      // OBSERVE: Fetch repo state, branch, SHAs
      const repoObservation = await this.observeRepository();
      if (!repoObservation.ok) {
        throw new Error(`Repo observation failed: ${repoObservation.error}`);
      }

      this.setState({
        baseSha: repoObservation.baseSha,
        headSha: repoObservation.headSha,
      });

      // AUDIT: Identify bottleneck
      this.setState({ stage: 'auditing' });
      const audit = await this.auditForBottleneck();
      this.setState({
        bottleneck: {
          classification: audit.bottleneck,
          description: audit.description,
          evidence: audit.evidence,
        },
      });

      // FIX: Apply smallest reversible patch
      this.setState({ stage: 'fixing' });
      const fix = await this.applySmallestFix();
      if (!fix.ok) {
        throw new Error(`Fix application failed: ${fix.error}`);
      }

      this.setState({
        fixApplied: {
          filesChanged: fix.filesChanged,
          commit: fix.commit,
          reversible: fix.reversible,
        },
      });

      // VERIFY: Run checks
      this.setState({ stage: 'verifying' });
      const verification = await this.runVerification();
      this.setState({
        verificationResults: verification,
      });

      // REPORT
      const report = this.generateReport();
      this.setState({
        report,
        stage: 'completed',
      });

      this.broadcast({
        type: 'goalfix_completed',
        state: this.state,
      });
    } catch (error) {
      this.setState({
        stage: 'failed',
        errors: [...this.state.errors, String(error)],
        report: `GoalFix failed: ${error}`,
      });

      this.broadcast({
        type: 'goalfix_failed',
        error: String(error),
      });
    }
  }

  private async observeRepository() {
    // Clone/fetch repo, identify branch, capture SHAs
    // TODO: Integrate with Founder Control Room repo-truth
    return {
      ok: true,
      baseSha: 'TODO',
      headSha: 'TODO',
    };
  }

  private async auditForBottleneck() {
    // Analyze logs, tests, lint, type checks to identify bottleneck
    // Apply ULTRATHINK + Product Design + Redteam I reasoning
    return {
      bottleneck: 'INFERRED_BOTTLENECK' as const,
      description: 'TODO: Run analysis',
      evidence: [],
    };
  }

  private async applySmallestFix() {
    // Apply the minimal reversible patch identified
    return {
      ok: true,
      filesChanged: [],
      commit: 'TODO',
      reversible: true,
    };
  }

  private async runVerification() {
    return {
      typecheck: { passed: false, output: 'TODO' },
      tests: { passed: false, output: 'TODO' },
      playwright: { passed: false, evidence: 'TODO' },
    };
  }

  private generateReport() {
    const { goal, bottleneck, fixApplied, verificationResults } = this.state;
    return `
# GoalFix Report

**Goal:** ${goal}

## Reality
Repo: ${this.state.repoUrl}
Branch: ${this.state.targetBranch}
Base SHA: ${this.state.baseSha}
Head SHA: ${this.state.headSha}

## Bottleneck
Classification: ${bottleneck.classification}
Description: ${bottleneck.description}
Evidence: ${bottleneck.evidence.join(', ')}

## Fix Applied
Files: ${fixApplied?.filesChanged.join(', ') || 'None'}
Commit: ${fixApplied?.commit || 'N/A'}
Reversible: ${fixApplied?.reversible || false}

## Verification
Typecheck: ${verificationResults?.typecheck.passed ? '✅' : '❌'}
Tests: ${verificationResults?.tests.passed ? '✅' : '❌'}
Playwright: ${verificationResults?.playwright.passed ? '✅' : '❌'}

## Risk
${this.state.errors.length > 0 ? `Errors: ${this.state.errors.join('\n')}` : 'None detected'}

## Rollback
Reverse to base SHA: \`git reset --hard ${this.state.baseSha}\`

## Next Gate
${verificationResults?.playwright.passed ? 'Ready for merge review' : 'Verification incomplete'}
    `.trim();
  }

  @callable()
  setGoal(goal: string, repoUrl: string, targetBranch: string) {
    this.setState({
      goal,
      repoUrl,
      targetBranch,
    });
    this.startWorkflow();
    return { started: true, goal };
  }

  @callable()
  getStatus() {
    return {
      stage: this.state.stage,
      goal: this.state.goal,
      bottleneck: this.state.bottleneck.classification,
      report: this.state.report,
    };
  }
}

export default {
  async fetch(req: Request, env: Env) {
    return routeAgentRequest(req, env) ?? new Response('Not found', { status: 404 });
  },
};
