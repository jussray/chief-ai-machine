from pathlib import Path

prompts_path = Path('src/data/prompts.js')
prompts = prompts_path.read_text()
start_marker = '  {\n    id: 1,'
end_marker = '  {\n    id: 2,'
start = prompts.index(start_marker)
end = prompts.index(end_marker, start)

new_object = r'''  {
    id: 1,
    emoji: "🔍",
    title: "Repo Audit First",
    sub: "Read state before touching anything",
    cat: "coding",
    platforms: ["chatgpt","claude","perplexity"],
    repos: ["bip","think-tank","jbh","l99"],
    notes: "Use at the start of every coding session. Inspect the authoritative repository, target branch or PR, exact head, diffs, checks, logs, and runtime evidence before asking questions. Requires classified findings, rollback, a stop condition, and Playwright for rendered UI behavior.",
    versions: {
      chatgpt: "You are a senior software engineer auditing my repository before any edits.\n\nProject:\n- Authoritative repository: [OWNER/REPO]\n- Target branch or PR: [BRANCH_OR_PR]\n- Exact head: [COMMIT_SHA]\n- Stack: [STACK]\n- Founder goal: [GOAL]\n- Suspected area: [AREA_OR_UNKNOWN]\n\nEVIDENCE HIERARCHY:\n1. Authoritative repository, target branch or PR, and exact head\n2. Current diff and recent commits\n3. CI checks, test results, and deployment logs\n4. Runtime behavior and Playwright evidence for UI or rendered flows\n5. Pasted summaries only when stronger evidence is unavailable\n\nGUARDRAILS:\n- Audit first; do not edit, merge, deploy, delete, or rewrite\n- Exhaust available repository evidence before asking questions\n- Prefer minimal, reversible changes and preserve unrelated behavior\n- Never hide failing signals or expose secrets\n- Label every material conclusion VERIFIED, INFERRED, UNKNOWN, or BLOCKED\n- If UI or rendered behavior is involved, require Playwright evidence\n- State rollback and a stop condition before recommending implementation\n\nOUTPUT:\nREALITY: repository, branch or PR, exact head, and VERIFIED state\nFINDINGS: ranked causes with classification and evidence\nSAFE TO CHANGE / DO NOT TOUCH\nRED TEAM: how the leading diagnosis could be wrong\nNEXT FIX: exactly one minimal reversible action\nPROOF REQUIRED: cheapest valid verification sequence\nROLLBACK: safe reversal\nSTOP CONDITION: evidence that permits implementation\nOPEN GATE: one genuinely BLOCKED item only",
      claude: "<role>\nSenior software engineer auditing an authoritative repository before any edits.\n</role>\n\n<context>\nAuthoritative repository: [OWNER/REPO]\nTarget branch or PR: [BRANCH_OR_PR]\nExact head: [COMMIT_SHA]\nStack: [STACK]\nFounder goal: [GOAL]\nSuspected area: [AREA_OR_UNKNOWN]\n</context>\n\n<evidence_hierarchy>\nEvidence hierarchy:\n1. Authoritative repository, target branch or PR, and exact head\n2. Current diff and recent commits\n3. CI checks, tests, and deployment logs\n4. Runtime behavior and Playwright evidence for UI or rendered flows\n5. Pasted summaries only when stronger evidence is unavailable\n</evidence_hierarchy>\n\n<rules>\n- Audit only. Do not edit, merge, deploy, delete, or rewrite.\n- Exhaust available repository evidence before asking questions.\n- Classify every material conclusion VERIFIED, INFERRED, UNKNOWN, or BLOCKED.\n- Prefer one minimal reversible fix and preserve unrelated work.\n- Never suppress failing signals or expose secrets.\n- Require Playwright when UI or rendered behavior is involved.\n- Include rollback and a stop condition before implementation.\n</rules>\n\n<output_format>\nREALITY | FINDINGS | SAFE TO CHANGE | DO NOT TOUCH | RED TEAM | NEXT FIX | PROOF REQUIRED | ROLLBACK | STOP CONDITION | OPEN GATE\n</output_format>",
      perplexity: "Audit this repository before suggesting any changes.\n\nAuthoritative repository: [OWNER/REPO]\nTarget branch or PR: [BRANCH_OR_PR]\nExact head: [COMMIT_SHA]\nStack: [STACK]\nFounder goal: [GOAL]\n\nEVIDENCE HIERARCHY:\n1. Authoritative repository, target branch or PR, and exact head\n2. Current diff and recent commits\n3. CI checks, tests, and deployment logs\n4. Runtime behavior and Playwright evidence for UI or rendered flows\n5. Pasted summaries only when stronger evidence is unavailable\n\nRules:\n- Exhaust available repository evidence before asking questions\n- Do not edit, merge, deploy, delete, or broadly rewrite\n- Label every material conclusion VERIFIED, INFERRED, UNKNOWN, or BLOCKED\n- Preserve working unrelated behavior\n- Require Playwright for UI or rendered paths\n- Recommend exactly one minimal reversible next action\n- Include rollback and a stop condition before implementation\n\nReturn:\nREALITY | FINDINGS | SAFE TO CHANGE / DO NOT TOUCH | RED TEAM | NEXT FIX | PROOF REQUIRED | ROLLBACK | STOP CONDITION | OPEN GATE"
    }
  },
'''

prompts_path.write_text(prompts[:start] + new_object + prompts[end:])

test_path = Path('src/data/prompts.test.js')
tests = test_path.read_text()
test_name = 'keeps Repo Audit First evidence-first across every platform'
if test_name in tests:
    raise SystemExit('Focused regression test already exists; refusing duplicate insertion')

test_insert = r'''

  it('keeps Repo Audit First evidence-first across every platform', () => {
    const prompt = PROMPTS.find((candidate) => candidate.title === 'Repo Audit First');
    if (!prompt) throw new Error('Repo Audit First prompt is missing');

    const variants = {
      chatgpt: prompt.versions.chatgpt,
      claude: prompt.versions.claude,
      perplexity: prompt.versions.perplexity,
    };
    const requiredTerms = [
      'authoritative repository',
      'target branch or pr',
      'exact head',
      'evidence hierarchy',
      'verified',
      'inferred',
      'unknown',
      'blocked',
      'stop condition',
      'rollback',
      'playwright',
    ];

    for (const [platform, value] of Object.entries(variants)) {
      if (typeof value !== 'string') throw new Error(`Repo Audit First is missing ${platform}`);
      const body = value.toLowerCase();
      for (const requirement of requiredTerms) {
        expect(body, `${platform} requires "${requirement}"`).toContain(requirement);
      }
      expect(body, `${platform} exhausts repository evidence before questions`)
        .toContain('exhaust available repository evidence before asking questions');
    }

    const combined = [prompt.notes, ...Object.values(variants)].join('\n').toLowerCase();
    for (const legacy of [
      'typescript-only auditor',
      'manually pasted evidence',
      'senior typescript engineer',
      'paste your file tree + recent logs',
      'no edits until i confirm your read is correct',
      'ask a targeted question instead of guessing',
    ]) {
      expect(combined, `Repo Audit First rejects legacy phrasing "${legacy}"`).not.toContain(legacy);
    }
  });
'''

close = tests.rfind('\n});')
if close == -1:
    raise SystemExit('Could not locate PROMPTS describe closing brace')
test_path.write_text(tests[:close] + test_insert + tests[close:])
