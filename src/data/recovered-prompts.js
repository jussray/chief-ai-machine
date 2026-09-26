// Recovered PromptOS capability pack.
// These prompts preserve jobs found in historical/saved PromptOS lineages that are not
// represented as distinct jobs in the current public library. IDs are string-based to
// prevent another collision with the numeric core catalog.

export const RECOVERED_PROMPTS = Object.freeze([
  {
    id: 'recovered-ui-state-completion-map',
    emoji: '🧭',
    title: 'UI State Completion Map',
    sub: 'Every screen, state, breakpoint, and proof path before implementation',
    cat: 'ui',
    platforms: ['chatgpt', 'claude', 'figma'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered from the older UI build-out lineage and differentiated from Full Build-Out Plan: this maps interface states and Playwright proof targets, not general feature scope.',
    versions: {
      chatgpt: `Map this UI flow to completion before code changes.\n\nSurface: [SURFACE]\nCurrent implementation: [EVIDENCE]\nDefinition of done: [DONE]\nConstraints: [CONSTRAINTS]\n\nInventory every route/screen, loading/empty/error/success/permission/offline state, responsive breakpoint, keyboard/touch interaction, accessibility requirement, and cross-screen transition. Mark each VERIFIED / MISSING / UNKNOWN. End with the smallest build order that unlocks real-user testing and a Playwright assertion for every required state.\n\nReturn: STATE MATRIX | MISSING STATES | BUILD ORDER | PLAYWRIGHT PROOF | STOP CONDITION.`,
      claude: `<role>UI completion mapper. Do not implement yet.</role>\n<surface>[SURFACE]</surface>\n<evidence>[EVIDENCE]</evidence>\n<done>[DONE]</done>\n<constraints>[CONSTRAINTS]</constraints>\n<instructions>Inventory every screen/state/breakpoint/interaction and classify VERIFIED, MISSING, or UNKNOWN. Produce the smallest completion order and one Playwright proof target per required state.</instructions>\n<output>STATE MATRIX | GAPS | BUILD ORDER | PLAYWRIGHT PROOF | STOP CONDITION</output>`,
      figma: `Audit [SURFACE] as a complete interface state system. Compare the supplied frames/components against required loading, empty, error, success, permission, offline, responsive, and interaction states. Return a state matrix, missing frames/components, reusable component opportunities, and the exact states engineering must verify in Playwright.`
    }
  },
  {
    id: 'recovered-ui-state-code-executor',
    emoji: '🧩',
    title: 'UI State-to-Code Executor',
    sub: 'Implement one approved UI state without drifting the design system',
    cat: 'ui',
    platforms: ['chatgpt', 'claude'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered from the older UI implementation prompt and narrowed to one approved state, existing tokens, accessibility, and real-path proof.',
    versions: {
      chatgpt: `Implement exactly one approved UI state from this completion map.\n\nRepo/head: [REPO_HEAD]\nTarget state: [STATE]\nExisting component/tokens: [EVIDENCE]\nAcceptance criteria: [DONE]\nConstraints: [CONSTRAINTS]\n\nRules: preserve unrelated behavior; reuse existing design tokens/components before creating new ones; include loading/error/accessibility behavior required by this state; no broad refactor. Return the smallest patch plus the focused test and Playwright real-path assertion that prove this state.`,
      claude: `<role>UI implementation engineer.</role>\n<repo_head>[REPO_HEAD]</repo_head>\n<target_state>[STATE]</target_state>\n<existing_system>[EVIDENCE]</existing_system>\n<done>[DONE]</done>\n<constraints>[CONSTRAINTS]</constraints>\n<rules>One state only. Reuse tokens/components. Preserve unrelated behavior. Include accessibility and failure behavior. Bind completion to a focused test plus Playwright real-path proof.</rules>\n<output>PATCH | TEST | PLAYWRIGHT | RISK | ROLLBACK</output>`
    }
  },
  {
    id: 'recovered-investor-fit-evidence-finder',
    emoji: '💸',
    title: 'Investor Fit Evidence Finder',
    sub: 'Find capital sources by stage, check size, thesis, behavior, and proof of fit',
    cat: 'research',
    platforms: ['chatgpt', 'perplexity'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered investor-match job. Distinct from general market research because every candidate needs evidence of actual investing fit.',
    versions: {
      chatgpt: `Build an evidence-backed investor longlist for [PROJECT].\n\nStage: [STAGE]\nCategory: [CATEGORY]\nGeography: [GEOGRAPHY]\nCapital need/check size: [RANGE]\nTraction/proof: [EVIDENCE]\nConstraints: [CONSTRAINTS]\n\nFor each candidate, verify thesis fit, stage/check-size fit, recent relevant investments, geography, conflicts, and the strongest reason they might still pass. Separate VERIFIED from INFERRED. Rank only candidates with a concrete money path.\n\nReturn: FIT PROFILE | VERIFIED TARGETS | FIT EVIDENCE | RISKS | FIRST WAVE.`,
      perplexity: `Research investors for [PROJECT] using current public evidence. Required fit: [STAGE], [CATEGORY], [GEOGRAPHY], [RANGE]. Verify thesis, check size/stage, recent relevant investments, geography, and conflicts. Do not include a name merely because it appears on an investor list. Return VERIFIED TARGETS | EVIDENCE | RISKS | FIRST WAVE with citations.`
    }
  },
  {
    id: 'recovered-investor-pipeline-ooda-ranker',
    emoji: '🎯',
    title: 'Investor Pipeline OODA Ranker',
    sub: 'Turn a long investor list into a defensible outreach order',
    cat: 'modes',
    platforms: ['chatgpt', 'claude', 'perplexity'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered OODA investor narrowing job. It ranks an existing pipeline rather than discovering investors.',
    versions: {
      chatgpt: `Run OODA on this existing investor pipeline.\n\nGoal: [RAISE_GOAL]\nCandidates + evidence: [PIPELINE]\nConstraints: [CONSTRAINTS]\n\nOBSERVE: classify known fit evidence and missing facts.\nORIENT: score fit, access path, timing, conflict risk, and expected learning value.\nDECIDE: choose the first outreach wave and explicit deprioritizations.\nACT: give the exact verification/outreach order.\n\nReturn: OBSERVE | ORIENT | RANKED PIPELINE | WAVE 1 | VERIFY NEXT.`,
      claude: `<role>Investor pipeline operator using OODA.</role><input>[PIPELINE]</input><goal>[RAISE_GOAL]</goal><constraints>[CONSTRAINTS]</constraints><instructions>Observe evidence, orient by fit/access/timing/conflict/learning value, decide the first wave, then give the exact action order. Do not invent missing investor facts.</instructions>`,
      perplexity: `Validate the current facts needed to rank this investor pipeline: [PIPELINE]. Goal: [RAISE_GOAL]. Verify current role, thesis, recent relevant investments, geography, and publicly visible access paths. Return evidence for ranking, not outreach copy.`
    }
  },
  {
    id: 'recovered-fundraise-objection-redteam',
    emoji: '🧨',
    title: 'Fundraise Objection Redteam',
    sub: 'Generate the strongest investor pass reasons and the proof that could reverse them',
    cat: 'redteam',
    platforms: ['chatgpt', 'claude', 'perplexity'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered fundraising redteam. Distinct from Kill My Idea because the unit of attack is the investability case, not the product idea.',
    versions: {
      chatgpt: `Redteam this fundraising case as a skeptical investor trying to pass.\n\nProject: [PROJECT]\nRaise: [RAISE]\nPitch/evidence: [EVIDENCE]\nConstraints: [CONSTRAINTS]\n\nAttack market, timing, traction, moat, founder execution risk, business model, capital efficiency, and why this requires outside capital. Rank pass reasons by severity. For every reversible objection, name the smallest proof that could change the decision. Do not manufacture traction.\n\nReturn: PASS REASONS | FATAL VS FIXABLE | REVERSAL PROOF | REPAIR ORDER.`,
      claude: `<role>Skeptical investment committee reviewer.</role><case>[EVIDENCE]</case><raise>[RAISE]</raise><instructions>Try to pass on the deal. Rank objections, separate fatal from fixable, and name the smallest proof that could reverse each fixable objection.</instructions>`,
      perplexity: `Stress-test the claims in this fundraising case against current market and comparable-company evidence: [EVIDENCE]. Identify claims investors can falsify quickly, current category headwinds, and what external proof would strengthen the case. Cite sources.`
    }
  },
  {
    id: 'recovered-durable-capital-path-filter',
    emoji: '🌳',
    title: 'Durable Capital Path Filter',
    sub: 'Compare VC, angels, grants, revenue, services, and strategic capital through survival math',
    cat: 'modes',
    platforms: ['chatgpt', 'claude'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered Lindy funding job. Distinct from generic Lindy Mode because it compares funding structures and founder survival constraints.',
    versions: {
      chatgpt: `Apply a durability filter to how [PROJECT] should be funded.\n\nCurrent cash/runway: [REALITY]\nCapital need: [NEED]\nRevenue path: [MONEY_PATH]\nOptions: [OPTIONS]\nConstraints: [CONSTRAINTS]\n\nCompare revenue-first, services, grants, angels, VC, strategic capital, preorders, and partnerships where applicable. Judge control loss, time-to-cash, repeatability, dependency risk, proof requirements, and survival if the next round never comes.\n\nReturn: DURABLE PRIMARY PATH | SECONDARY PATH | AVOID NOW | PROOF NEEDED | KILL CONDITION.`,
      claude: `<role>Capital-structure strategist with a durability bias.</role><reality>[REALITY]</reality><need>[NEED]</need><money_path>[MONEY_PATH]</money_path><options>[OPTIONS]</options><instructions>Compare time-to-cash, dependency, control, repeatability, proof burden, and survival without another round. Choose a primary and backup path.</instructions>`
    }
  },
  {
    id: 'recovered-investor-outreach-evidence-writer',
    emoji: '📬',
    title: 'Investor Outreach Evidence Writer',
    sub: 'Write outreach from verified fit and proof, not generic founder templates',
    cat: 'research',
    platforms: ['chatgpt', 'claude'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered investor outreach job. Differentiated by requiring a verified investor-fit hook and factual proof before any copy.',
    versions: {
      chatgpt: `Write investor outreach only from the evidence below.\n\nInvestor: [INVESTOR]\nVerified fit evidence: [FIT_EVIDENCE]\nProject proof: [PROJECT_EVIDENCE]\nAsk: [ASK]\nRelationship: [cold/warm/follow-up]\nVoice constraints: [CONSTRAINTS]\n\nNo invented familiarity, traction, urgency, or portfolio references. Use one investor-specific hook, one concrete proof point, one clear ask, and a low-friction close.\n\nReturn: SUBJECT | EMAIL | DM | FOLLOW-UP | CLAIMS USED.`,
      claude: `<role>Founder outreach writer grounded only in verified fit evidence.</role><investor>[INVESTOR]</investor><fit>[FIT_EVIDENCE]</fit><proof>[PROJECT_EVIDENCE]</proof><ask>[ASK]</ask><rules>No fake familiarity, traction, urgency, or portfolio references. One specific hook, one proof point, one ask.</rules>`
    }
  },
  {
    id: 'recovered-fundraise-close-mission-map',
    emoji: '🗺️',
    title: 'Fundraise Close Mission Map',
    sub: 'Move from shortlist to diligence to committed capital with explicit gates',
    cat: 'system',
    platforms: ['chatgpt', 'claude'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered fundraising mission-map job. It manages the close sequence, not investor discovery or copywriting.',
    versions: {
      chatgpt: `Map the fundraising mission from current pipeline to committed capital.\n\nRaise goal: [GOAL]\nCurrent pipeline: [PIPELINE]\nAvailable materials/proof: [EVIDENCE]\nConstraints: [CONSTRAINTS]\n\nDefine phases for target verification, outreach, meetings, follow-up, diligence, terms, close, and post-close obligations. Each phase needs entry criteria, exit evidence, owner/action, failure signal, and rollback/pivot rule. Preserve a scoreboard for conversion and learning.\n\nReturn: PHASES | GATES | SCOREBOARD | RISKS | NEXT GATE.`,
      claude: `<role>Fundraise mission operator.</role><goal>[GOAL]</goal><pipeline>[PIPELINE]</pipeline><evidence>[EVIDENCE]</evidence><instructions>Map target verification through close. Every phase needs entry criteria, exit proof, failure signal, and next gate. Track conversion and learning.</instructions>`
    }
  },
  {
    id: 'recovered-shipment-blocker-chain-hunter',
    emoji: '🚧',
    title: 'Shipment Blocker Chain Hunter',
    sub: 'Trace the causal chain keeping a product from a real shipped outcome',
    cat: 'coding',
    platforms: ['chatgpt', 'claude', 'perplexity'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered Blocker Hunter and differentiated from Repo Audit First: this starts from a failed shipment outcome and traces dependency chains across code, config, deploy, and operations.',
    versions: {
      chatgpt: `Find the single causal blocker chain preventing this shipped outcome.\n\nRepo/head: [REPO_HEAD]\nTarget outcome: [OUTCOME]\nObserved failures: [EVIDENCE]\nConstraints: [CONSTRAINTS]\n\nTrace backward from the failed real path through UI, API, auth, data, config, deployment, and external dependencies. Separate root blocker from downstream symptoms. Choose exactly one smallest reversible break in the chain and define proof on the real path.\n\nReturn: REALITY | BLOCKER CHAIN | ROOT BLOCKER | ONE FIX | PROOF | ROLLBACK.`,
      claude: `<role>Shipment blocker investigator.</role><repo_head>[REPO_HEAD]</repo_head><outcome>[OUTCOME]</outcome><evidence>[EVIDENCE]</evidence><instructions>Trace backward from the failed outcome across UI/API/auth/data/config/deploy/external dependencies. Separate root blocker from symptoms. Select one reversible fix and real-path proof.</instructions>`,
      perplexity: `Research only the external/runtime facts needed to resolve this blocker chain: [EVIDENCE]. Verify current platform behavior, deprecations, limits, or outages that could make the observed path fail. Return sourced facts and unknowns, not code changes.`
    }
  },
  {
    id: 'recovered-product-journey-gap-map',
    emoji: '🛤️',
    title: 'End-to-End Product Journey Gap Map',
    sub: 'Trace discovery to use to delivery to money to repeat value',
    cat: 'buildout',
    platforms: ['chatgpt', 'claude'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered completed-product journey. Distinct from feature build-out by spanning the whole user, operational, revenue, and proof journey.',
    versions: {
      chatgpt: `Map the complete product journey for [PROJECT] from first discovery through repeat value.\n\nCurrent product/runtime evidence: [EVIDENCE]\nMoney path: [MONEY_PATH]\nDefinition of done: [DONE]\nConstraints: [CONSTRAINTS]\n\nTrace: discover → understand → trust → sign up/buy → onboard → core value → save/return → support/recovery → payment/delivery → outcome proof → testimonial/referral → repeat revenue. Mark every transition VERIFIED / PARTIAL / MISSING / UNKNOWN and identify the smallest set of gaps that prevent a real completed journey.\n\nReturn: JOURNEY MAP | BROKEN TRANSITIONS | MISSING SYSTEMS | MONEY-PATH GAPS | NEXT PROOF GATE.`,
      claude: `<role>End-to-end product journey auditor.</role><evidence>[EVIDENCE]</evidence><money_path>[MONEY_PATH]</money_path><done>[DONE]</done><instructions>Trace discovery through repeat value and revenue. Classify each transition VERIFIED/PARTIAL/MISSING/UNKNOWN. Identify only gaps that block a complete real journey.</instructions>`
    }
  },
  {
    id: 'recovered-chief-ai-completion-driver',
    emoji: '🤖',
    title: 'Chief AI Completion Driver',
    sub: 'Coordinate evidence, one move, proof, receipts, and the next state',
    cat: 'system',
    platforms: ['chatgpt', 'claude'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered Chief AI project-driver job and narrowed to coordination. It does not replace Goalfix; it orchestrates multiple verified work items while preserving one active move per item.',
    versions: {
      chatgpt: `Act as Chief AI Completion Driver for [PROJECT].\n\nAuthoritative state: [EVIDENCE]\nGoal: [GOAL]\nQueued work: [QUEUE]\nConstraints/authority: [CONSTRAINTS]\n\nFor each work item, bind repo/system identity, exact version/SHA, evidence, authority, one active move, proof requirement, rollback, and successor state. Never continue on a known-bad state. Do not create parallel busywork when one blocker dominates. Produce a compact execution ledger and select the single next gate for the project.\n\nReturn: CURRENT TRUTH | BLOCKERS | ACTIVE MOVES | PROOF LEDGER | RISK | NEXT GATE.`,
      claude: `<role>Chief AI completion coordinator.</role><authoritative_state>[EVIDENCE]</authoritative_state><goal>[GOAL]</goal><queue>[QUEUE]</queue><constraints>[CONSTRAINTS]</constraints><rules>Fingerprint state, stop on known-bad state, one active move per item, require proof and rollback, preserve successor lineage.</rules><output>CURRENT TRUTH | BLOCKERS | ACTIVE MOVES | PROOF LEDGER | NEXT GATE</output>`
    }
  },
  {
    id: 'recovered-hidden-requirement-ledger',
    emoji: '🧠',
    title: 'Hidden Requirement Ledger',
    sub: 'Find omitted dependencies and acceptance criteria in a concrete build',
    cat: 'system',
    platforms: ['chatgpt', 'claude', 'perplexity'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered “What Am I Missing?” but made distinct from Blind-Spot Finder: it audits a concrete artifact/plan for omitted requirements and records evidence needed to close them.',
    versions: {
      chatgpt: `Audit this concrete build/plan for requirements that are missing rather than merely unknown.\n\nArtifact/plan: [EVIDENCE]\nIntended users/outcome: [OUTCOME]\nConstraints: [CONSTRAINTS]\n\nCheck hidden dependencies across auth, permissions, data lifecycle, failure/recovery, accessibility, observability, billing, delivery, privacy, deployment, support, and rollback. For each omission, state why it matters, whether it blocks shipment, and the evidence needed to close it. Do not brainstorm unrelated features.\n\nReturn: REQUIRED-BUT-MISSING | EVIDENCE GAP | BLOCKER? | CLOSURE TEST.`,
      claude: `<role>Requirements omission auditor.</role><artifact>[EVIDENCE]</artifact><outcome>[OUTCOME]</outcome><instructions>Find omitted requirements across authority, data lifecycle, failure/recovery, accessibility, observability, money path, deployment, support, and rollback. No unrelated feature ideation. Attach closure evidence to each gap.</instructions>`,
      perplexity: `Check whether current standards/platform rules create hidden requirements for this plan: [EVIDENCE]. Focus only on externally verifiable requirements such as platform policies, deprecations, accessibility, security, or deployment constraints. Cite sources and separate mandatory from optional.`
    }
  },
  {
    id: 'recovered-toolchain-execution-router',
    emoji: '🌐',
    title: 'Toolchain Execution Router',
    sub: 'Route each step by authority, capability, evidence, cost, and rollback',
    cat: 'system',
    platforms: ['chatgpt', 'claude', 'perplexity'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered Platform Router and differentiated from model benchmarks: it routes a multi-step execution plan across tools/services while respecting authority and proof.',
    versions: {
      chatgpt: `Route this task across the smallest set of tools that can actually execute and verify it.\n\nGoal: [GOAL]\nAvailable tools/services: [TOOLS]\nAuthority/permissions: [AUTHORITY]\nBudget/constraints: [CONSTRAINTS]\nEvidence required: [PROOF]\n\nFor each step choose one owner tool based on authoritative data access, action capability, reversibility, cost, and verification. Avoid redundant wrappers around the same underlying model/service. Show handoffs and the artifact/receipt passed between steps.\n\nReturn: STEP | OWNER TOOL | WHY | INPUT RECEIPT | OUTPUT RECEIPT | ROLLBACK | PROOF.`,
      claude: `<role>Execution toolchain router.</role><goal>[GOAL]</goal><tools>[TOOLS]</tools><authority>[AUTHORITY]</authority><constraints>[CONSTRAINTS]</constraints><proof>[PROOF]</proof><instructions>Assign one owner tool per step by authority, capability, cost, reversibility, and evidence. Avoid redundant tools. Define handoff receipts.</instructions>`,
      perplexity: `Verify current capabilities, limitations, pricing/limits, or deprecations that matter when routing this task across [TOOLS]. Return sourced routing constraints only; do not invent access or permissions.`
    }
  },
  {
    id: 'recovered-edge-origin-deployment-trace',
    emoji: '☁️',
    title: 'Edge-to-Origin Deployment Trace',
    sub: 'Trace DNS, Access, edge, origin, env, build, and runtime as one request path',
    cat: 'cloudflare',
    platforms: ['chatgpt', 'claude', 'perplexity'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered Cloudflare + Vercel inspector and differentiated from Worker/Edge Debug by tracing the complete cross-provider request path.',
    versions: {
      chatgpt: `Trace one failing deployed request from browser to origin.\n\nHost/path: [TARGET]\nExpected deployment/head: [EXPECTED_HEAD]\nEvidence: [DNS_ACCESS_EDGE_ORIGIN_LOGS]\nConstraints: [CONSTRAINTS]\n\nWalk DNS → TLS → Cloudflare Access/policy → Worker/Pages route → origin/Vercel → build artifact → environment bindings → application response. At each hop mark VERIFIED / INFERRED / UNKNOWN / BLOCKED and record the cheapest check. Identify the first hop where expected state diverges from observed state.\n\nReturn: REQUEST TRACE | FIRST DIVERGENCE | ONE FIX | VERIFY | ROLLBACK.`,
      claude: `<role>Cross-provider deployment investigator.</role><target>[TARGET]</target><expected_head>[EXPECTED_HEAD]</expected_head><evidence>[DNS_ACCESS_EDGE_ORIGIN_LOGS]</evidence><instructions>Trace DNS, TLS, Access, edge routing, origin, artifact, env, and app response. Find the first verified divergence, then one fix and rollback.</instructions>`,
      perplexity: `Verify current Cloudflare/Vercel behavior relevant to this deployment trace: [TARGET] [EVIDENCE]. Check current documented routing, Access, DNS, deployment, or runtime constraints that could explain the first divergence. Cite official sources.`
    }
  },
  {
    id: 'recovered-github-execution-contract',
    emoji: '🐙',
    title: 'GitHub Execution Contract',
    sub: 'Convert findings into one bounded branch/commit/test/merge path',
    cat: 'system',
    platforms: ['chatgpt', 'claude'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered GitHub Execution Path and differentiated from PR Reviewer: this compiles approved findings into a reversible GitHub-native execution contract before changes.',
    versions: {
      chatgpt: `Convert these approved findings into a bounded GitHub execution contract.\n\nAuthoritative repo/head: [REPO_HEAD]\nApproved finding: [FINDING]\nAllowed scope: [SCOPE]\nRequired proof: [PROOF]\nConstraints: [CONSTRAINTS]\n\nDefine exact files, smallest branch/commit sequence, focused tests, Playwright path when UI is involved, merge gates, rollback commit/revert path, and stop condition. Do not add unrelated cleanup or create extra PRs.\n\nReturn: SCOPE | FILES | COMMIT PLAN | TESTS | PLAYWRIGHT | MERGE GATE | ROLLBACK | STOP.`,
      claude: `<role>GitHub execution planner.</role><repo_head>[REPO_HEAD]</repo_head><finding>[FINDING]</finding><scope>[SCOPE]</scope><proof>[PROOF]</proof><rules>Smallest reversible diff, no unrelated refactor, focused tests, Playwright for rendered UI, explicit merge gate and rollback.</rules>`
    }
  },
  {
    id: 'recovered-last-mile-launch-closure',
    emoji: '🚀',
    title: 'Last-Mile Launch Closure',
    sub: 'Close only the blockers between almost-done and one real launch path',
    cat: 'shipping',
    platforms: ['chatgpt', 'claude', 'perplexity'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered Launch Readiness Closer and differentiated from generic readiness checklists: it assumes the product is near-ready and only closes verified last-mile blockers.',
    versions: {
      chatgpt: `Treat [PROJECT] as almost ready and identify only the blockers between current reality and one real launch path.\n\nCurrent proof: [EVIDENCE]\nLaunch surface/audience: [SURFACE]\nDefinition of launch: [DONE]\nConstraints: [CONSTRAINTS]\n\nIgnore later enhancements. Classify each remaining issue as LAUNCH BLOCKER / POST-LAUNCH / NOT PROVEN. Rank blockers by causal order. Choose the smallest closure sequence and define the exact real-path evidence required before calling launch.\n\nReturn: LAUNCH REALITY | BLOCKERS | CLOSE ORDER | REAL-PATH PROOF | GO/NO-GO.`,
      claude: `<role>Last-mile launch closer.</role><evidence>[EVIDENCE]</evidence><surface>[SURFACE]</surface><done>[DONE]</done><instructions>Only address verified blockers between current state and one real launch path. Separate post-launch work. Define causal close order and real-path proof.</instructions>`,
      perplexity: `Verify any current external launch requirements that could still block [SURFACE]: [EVIDENCE]. Check current platform rules/deprecations/requirements only. Return sourced blocker status, not a general launch checklist.`
    }
  },
  {
    id: 'recovered-outcome-verified-launch-proof',
    emoji: '✅',
    title: 'Outcome-Verified Launch Proof',
    sub: 'Prove a real external user can reach value, not merely that CI is green',
    cat: 'shipping',
    platforms: ['chatgpt', 'claude'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered from the alternate Launch Readiness prompt but made unique: this requires external-user outcome evidence beyond deployment, CI, screenshots, or founder-only testing.',
    versions: {
      chatgpt: `Decide whether [PROJECT] has launch proof, not just launch readiness.\n\nInternal evidence: [CI_DEPLOY_SCREENSHOTS]\nExternal/user evidence: [USER_OUTCOME_EVIDENCE]\nTarget user outcome: [OUTCOME]\nConstraints: [CONSTRAINTS]\n\nInternal green checks are necessary but insufficient. Require evidence that a non-founder target user can discover/access the product, complete the critical path, receive the promised value, and leave an observable outcome. Separate RUNTIME VERIFIED from OUTCOME VERIFIED.\n\nReturn: INTERNAL PROOF | EXTERNAL PROOF | MISSING OUTCOME EVIDENCE | VERDICT | NEXT PROOF GATE.`,
      claude: `<role>Launch proof auditor.</role><internal>[CI_DEPLOY_SCREENSHOTS]</internal><external>[USER_OUTCOME_EVIDENCE]</external><outcome>[OUTCOME]</outcome><rule>Deployment and founder testing do not equal outcome proof. Require a real target-user path and observable value.</rule><output>INTERNAL PROOF | EXTERNAL PROOF | GAP | VERDICT | NEXT PROOF GATE</output>`
    }
  },
  {
    id: 'recovered-trust-boundary-abuse-matrix',
    emoji: '🛡️',
    title: 'Trust Boundary Abuse Matrix',
    sub: 'Attack role, consent, tenancy, and data-flow boundaries one crossing at a time',
    cat: 'redteam',
    platforms: ['chatgpt', 'claude'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered from the alternate Trust Layer redteam and differentiated from broad privacy/auth audits by modeling concrete boundary crossings and invariant tests.',
    versions: {
      chatgpt: `Build an abuse matrix for this trust model.\n\nActors/roles: [ROLES]\nAssets/data: [ASSETS]\nAllowed flows: [POLICY]\nImplementation evidence: [EVIDENCE]\n\nEnumerate every sensitive boundary crossing: role escalation, cross-tenant access, consent/revocation drift, stale-session access, indirect inference, export/share paths, and service-to-service authority. For each, state the invariant, realistic abuse case, current control, proof test, and smallest hardening step. Keep scenarios defensive and system-focused.\n\nReturn: BOUNDARY | INVARIANT | ABUSE CASE | CONTROL | PROOF TEST | HARDENING.`,
      claude: `<role>Defensive trust-boundary redteam.</role><roles>[ROLES]</roles><assets>[ASSETS]</assets><policy>[POLICY]</policy><evidence>[EVIDENCE]</evidence><instructions>Model role/tenant/consent/session/service boundaries. For each crossing, define the invariant, abuse case, current control, proof test, and smallest hardening action.</instructions>`
    }
  },
  {
    id: 'recovered-revenue-ops-leak-audit',
    emoji: '🛒',
    title: 'Revenue-to-Ops Leak Audit',
    sub: 'Find where storefront demand leaks into margin, fulfillment, returns, or repeat purchase',
    cat: 'shopify',
    platforms: ['chatgpt', 'claude', 'shopify'],
    repos: ['jbh'],
    notes: 'Recovered from the alternate Shopify Store Audit and differentiated from Store Health Snapshot: this follows money from offer through fulfillment and repeat purchase to find operational revenue leakage.',
    versions: {
      chatgpt: `Audit this commerce path for revenue that leaks after or around conversion.\n\nStore evidence: [STORE_DATA]\nOffer/catalog: [OFFER]\nSupplier/fulfillment facts: [OPS]\nConstraints: [CONSTRAINTS]\n\nTrace traffic → product selection → cart → checkout → payment → supplier handoff → fulfillment → delivery → support/returns → repeat purchase. Quantify or classify leaks in conversion, margin, shipping, stock, cancellations, refunds, and repeat value. Separate demand problems from operational problems.\n\nReturn: MONEY PATH | LEAKS | EVIDENCE | TOP FIX | EXPECTED BUSINESS SIGNAL.`,
      claude: `<role>E-commerce revenue and operations auditor.</role><store>[STORE_DATA]</store><offer>[OFFER]</offer><ops>[OPS]</ops><instructions>Trace revenue from offer through fulfillment and repeat purchase. Separate acquisition/conversion leaks from margin/ops/return leaks. Pick one evidence-backed fix.</instructions>`,
      shopify: `Using connected store data, trace the money path from product discovery through order fulfillment, returns, and repeat purchase. Identify products/orders/segments where conversion, margin, inventory, fulfillment, cancellation, or return behavior leaks value. Do not make changes. Return the top evidence-backed leak and the exact store data supporting it.`
    }
  },
  {
    id: 'recovered-offer-creative-evidence-translator',
    emoji: '🎯',
    title: 'Offer-to-Creative Evidence Translator',
    sub: 'Turn one verified offer and proof set into channel-native creative hypotheses',
    cat: 'growth',
    platforms: ['chatgpt', 'claude'],
    repos: ['jbh', 'bip', 'think-tank', 'l99'],
    notes: 'Recovered from the alternate Shopify ad-creative prompt and differentiated from general social prompts: creative claims must come from a verified offer/proof ledger.',
    versions: {
      chatgpt: `Translate this verified offer into testable creative without inventing claims.\n\nOffer: [OFFER]\nAudience: [AUDIENCE]\nVerified proof/claims: [PROOF]\nChannel: [CHANNEL]\nConstraints: [CONSTRAINTS]\n\nCreate 3 materially different creative hypotheses. Each must specify hook, single promise, proof used, objection answered, visual job, CTA, and success metric. No claim may exceed the supplied proof. Keep each hypothesis native to the selected channel.\n\nReturn: HYPOTHESIS | HOOK | PROOF | VISUAL | CTA | METRIC | CLAIM SOURCE.`,
      claude: `<role>Evidence-bound performance creative strategist.</role><offer>[OFFER]</offer><audience>[AUDIENCE]</audience><proof>[PROOF]</proof><channel>[CHANNEL]</channel><rules>Three genuinely different hypotheses. Every claim must map to supplied proof. Include visual job, CTA, and test metric.</rules>`
    }
  },
  {
    id: 'recovered-next-level-breakpoint-simulator',
    emoji: '🧱',
    title: 'Next-Level Breakpoint Simulator',
    sub: 'Model the first failure thresholds at higher users, volume, spend, and operator load',
    cat: 'system',
    platforms: ['chatgpt', 'claude', 'perplexity'],
    repos: ['bip', 'think-tank', 'jbh', 'l99'],
    notes: 'Recovered from the alternate L99 Pressure Test and differentiated from L99 Mode: this is threshold simulation with measurable breakpoints, not maximalist ideation.',
    versions: {
      chatgpt: `Simulate what breaks first when [PROJECT] moves to its next operating level.\n\nCurrent verified capacity: [BASELINE]\nNext-level scenario: [SCENARIO — users/orders/requests/content/team]\nArchitecture/ops evidence: [EVIDENCE]\nConstraints: [CONSTRAINTS]\n\nModel thresholds across latency, quotas, database contention, auth/session load, third-party limits, cost, support burden, fulfillment, observability, and recovery. Do not propose every upgrade. Identify the first 3 measurable breakpoints, their leading indicators, and the cheapest hardening action before each threshold.\n\nReturn: BASELINE | BREAKPOINT | TRIGGER METRIC | CONSEQUENCE | HARDEN BEFORE | CAN WAIT.`,
      claude: `<role>Capacity and operations breakpoint simulator.</role><baseline>[BASELINE]</baseline><scenario>[SCENARIO]</scenario><evidence>[EVIDENCE]</evidence><instructions>Model measurable failure thresholds across technical and operational capacity. Return the first three breakpoints, leading indicators, and smallest pre-threshold hardening actions. Do not turn this into a feature wish list.</instructions>`,
      perplexity: `Validate current external limits/pricing/quotas relevant to this next-level scenario: [SCENARIO] [EVIDENCE]. Return cited thresholds that could become the first breakpoint; separate documented limits from estimates.`
    }
  }
]);
