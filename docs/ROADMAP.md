# Chief AI Standalone Roadmap

## Goal

Validate that founders will repeatedly use and pay for portable company intelligence, not merely admire a prompt library once.

## Phase 0 — Product boundary and portable prototype

Status: in progress.

Deliverables:

- [x] standalone product doctrine;
- [x] separation from Founder Control Room and L99;
- [x] provider-neutral intelligence asset contract;
- [x] Company Brain prototype surface;
- [x] version increments for revised assets;
- [x] portable JSON snapshot;
- [x] backward-compatible import of original custom prompts;
- [x] domain tests;
- [ ] manual browser acceptance test on phone and desktop;
- [ ] documented restore drill using an exported snapshot.

Exit evidence:

- a user saves at least ten real company intelligence assets;
- at least three assets are revised after an observed outcome;
- an export is restored into a clean browser without losing data;
- the product remains useful without connecting GitHub.

## Phase 1 — Founder workflow validation

Build only the pieces required to test repeat use:

1. workspace and project navigation;
2. asset filters and full-text search;
3. immutable version timeline;
4. evidence links or attachments;
5. outcome and confidence fields;
6. approval and retirement receipts;
7. explicit promotion from prompt draft to intelligence asset;
8. weekly review view: what changed, what worked, what should be retired.

Customer tests:

- solo founder with multiple businesses;
- consultant or agency operator with separated clients;
- nontechnical small-business owner using more than one AI provider.

Metrics:

- weekly active workspaces;
- intelligence assets reused;
- assets revised after outcomes;
- time saved versus restarting from a blank chat;
- export completion rate;
- percentage of created assets that become approved;
- retention after four weeks.

Do not optimize for total prompts saved. Hoarding is not value.

## Phase 2 — Private encrypted sync

Required before marketing multi-device or team use:

- authenticated accounts;
- private workspaces;
- encrypted persistence;
- tenant authorization tests;
- deletion, export, and recovery;
- version migrations;
- secret and sensitive-data controls;
- audit trail;
- billing boundary;
- operational backups and restore drills.

No production sync claim is allowed until cross-workspace denial tests and deletion behavior are proven.

## Phase 3 — Provider comparison

Add explicit, optional provider execution:

- provider adapters;
- server-side secrets;
- bounded context selection;
- model and version recording;
- cost and latency capture;
- blind or rubric-based quality review;
- human approval before promotion;
- provider replacement and rerun workflows.

The output of a model is never automatically approved company intelligence.

## Phase 4 — Integrations

### Founder Control Room

Send approved intent packages for separately authorized execution.

### L99

Consume optional provenance, isolation, revocation, and promotion evidence.

### Other integrations

Potential integrations include documents, CRM, email, calendar, commerce, design, and project-management systems. Each integration must be read-scoped by default and must not become a hidden requirement for the standalone product.

## Commercial tests

Test three offers before expanding the platform:

### Offer A — Founder Intelligence OS

For solo founders managing strategy, brand, operations, sales, and product work across AI providers.

### Offer B — Client Intelligence Workspace

For consultants and agencies that need client-separated prompts, decisions, evidence, and reusable workflows.

### Offer C — Private Company Brain

For privacy-sensitive teams that need portability, approval, and self-hosted or private-cloud options.

Cannot verify willingness to pay until real users complete repeated workflows and accept a priced offer.

## Stop conditions

Pause or narrow the product if:

- users save prompts but do not reuse them;
- users cannot distinguish a draft from approved intelligence;
- most value comes only from the existing prompt library;
- provider comparison is not tied to a business outcome;
- customers refuse to store company strategy without stronger privacy guarantees;
- the product requires Founder Control Room to feel complete.

## First proof milestone

Chief AI has earned standalone status when at least five external users, unaffiliated with the current repos, each:

1. create a workspace;
2. save multiple asset types;
3. reuse at least one approved asset;
4. record an outcome;
5. export their company intelligence;
6. return the following week;
7. indicate willingness to pay for continued use.
