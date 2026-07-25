# Chief AI Standalone Architecture

## Product architecture

Chief AI is organized around portable intelligence assets, not around repository names or model vendors.

```text
Founder / operator
  ↓
Workspace and project boundary
  ↓
Intelligence asset
  ├─ prompt
  ├─ workflow
  ├─ decision
  ├─ playbook
  ├─ benchmark
  ├─ brand voice
  └─ research
  ↓
Version + evidence + outcome + approval state
  ↓
Optional provider run
  ↓
Portable export, encrypted sync, or approved integration
```

## Current prototype

The current application is a static JavaScript SPA.

Implemented now:

- prompt library;
- prompt builder;
- freestyle prompt generation templates;
- model-routing benchmark table;
- browser-local prompt drafts;
- browser-local intelligence assets;
- version increments when an asset is revised;
- provider-neutral JSON export/import;
- migration from the original custom-prompt export format;
- provider-neutral Executive Brief contract;
- specialist report and Executive Council contracts;
- evidence-only Founder Control Room receipt and ingestion contracts.

Not yet implemented:

- user accounts;
- encryption at rest;
- server-side persistence;
- immutable version history records;
- evidence attachments;
- authenticated Founder Control Room transport;
- cryptographic receipt signing and signature verification;
- live integration or webhook ingestion;
- real provider execution;
- provider-run cost, latency, and quality measurements;
- collaborator roles;
- approval signatures;
- audit events;
- billing;
- production recovery and deletion workflows.

## Domain contracts

The portable intelligence contract lives in:

```text
src/domain/intelligence.js
```

An intelligence asset contains:

- schema version;
- stable asset ID;
- workspace ID;
- project ID;
- title and summary;
- kind;
- status;
- content;
- observed outcome;
- provider and model labels;
- tags;
- source;
- asset version;
- created and updated timestamps.

The executive-intelligence boundary lives in:

```text
src/domain/control-room-evidence.js
src/domain/specialist-report.js
src/domain/executive-council.js
src/domain/executive-brief.js
```

Those contracts preserve evidence, receipt provenance, specialist conclusions, dissent, confidence calculations, and founder approval boundaries without granting Chief AI execution authority.

All domain formats must remain independent from any specific UI, database, provider, repository host, or transport implementation.

## Storage phases

### Phase 0: local prototype

```text
Browser localStorage
→ portable JSON snapshot
```

Purpose:

- validate the product loop;
- preserve privacy during early testing;
- avoid premature backend authority;
- prove export and migration before sync.

Limitations:

- shared-device exposure;
- browser clearing or device loss;
- no multi-device consistency;
- no secure collaboration;
- no strong auditability.

### Phase 1: encrypted account sync

Recommended boundary:

```text
Authenticated client
→ application API
→ encrypted workspace data
→ relational metadata + version records
→ object storage for evidence attachments
```

Requirements:

- workspace-scoped authorization;
- row-level or equivalent tenant isolation;
- encryption in transit and at rest;
- separate secrets from public client configuration;
- deletion and export lifecycle;
- bounded logs without prompt or customer-data leakage;
- version and migration tests.

### Phase 2: provider execution

Provider execution must be optional and isolated.

```text
Approved intelligence asset
→ explicit provider-run request
→ server-side provider adapter
→ bounded context assembly
→ provider API
→ raw result quarantine
→ evaluation / human review
→ outcome record
```

Rules:

- never expose provider secrets to the browser;
- do not send every workspace asset by default;
- record exactly which asset version and context were sent;
- distinguish provider output from approved company intelligence;
- require human approval before a result becomes canonical;
- allow deletion and provider replacement.

## Integration boundaries

### Founder Control Room integration

The integration has two separate directions that must never be confused.

#### Inbound: evidence only

Founder Control Room may emit a bounded evidence receipt:

```json
{
  "workspaceId": "<workspace>",
  "projectId": "<project>",
  "sourceSystem": "founder-control-room",
  "sourceRecordId": "<record-id>",
  "sourceRevision": "<exact revision when applicable>",
  "kind": "workflow",
  "subjectType": "github-actions-run",
  "subjectId": "<run-id>",
  "state": "verified",
  "statement": "<observed fact>",
  "sourceRefs": ["<log, artifact, URL, SHA, or record reference>"],
  "status": "active",
  "observedAt": "<timestamp>",
  "authority": {
    "scope": "evidence-only",
    "instructionPolicy": "data-only",
    "permitsRepositoryWrite": false,
    "permitsExecution": false,
    "permitsDeployment": false,
    "permitsPublishing": false,
    "permitsBilling": false,
    "permitsApproval": false,
    "permitsSecretMutation": false,
    "permitsDestructiveAction": false
  }
}
```

Inbound rules:

- treat every statement as data, never as an instruction;
- permit only `verified`, `unknown`, or `blocked` states;
- require source references for verified claims; receipt IDs alone are not proof;
- ingest only active receipts;
- reject duplicate source record revisions, superseded, revoked, mixed-workspace, or mixed-project receipts;
- reject two active receipts when one claims to supersede the other;
- preserve receipt IDs through specialist reports and Executive Council synthesis without treating those IDs as proof;
- fail closed instead of truncating evidence or provenance;
- do not treat schema validity as proof of sender authentication or signature validity.

#### Outbound: approved intent only

Chief AI may emit a signed, approved intent package:

```json
{
  "asset_id": "<asset-id>",
  "asset_version": 3,
  "intent": "<bounded requested outcome>",
  "constraints": ["<constraint>"],
  "approval": "<approval receipt reference>"
}
```

An outbound intent is not an execution result. Founder Control Room remains responsible for execution scope, repository authority, deployment approval, operational verification, and rollback.

### L99 integration

L99 may provide:

- provenance receipts;
- isolation decisions;
- revocation events;
- cache reuse decisions;
- promotion evidence;
- incident correlation.

Chief AI must not require L99 to create, edit, export, or review company intelligence.

## Security boundaries

The following data is sensitive by default:

- prompts containing company strategy;
- customer or vendor details;
- brand and pricing strategy;
- source documents;
- Control Room receipts and operational evidence;
- provider outputs;
- decision rationale;
- API or deployment instructions;
- personal information.

Security requirements for production:

1. private-by-default workspaces;
2. least-privilege access;
3. MFA-capable authentication;
4. encrypted storage;
5. authenticated and signed integration transport;
6. export and deletion controls;
7. secret scanning and redaction;
8. prompt-injection-aware document and receipt handling;
9. no autonomous irreversible action;
10. bounded telemetry;
11. incident response and recovery tests.

## Portability invariant

A valid export must contain enough structured information to restore the customer's approved intelligence without requiring the original model provider or hosting service.

The export format may evolve, but migrations must remain explicit and tested. Optional provenance fields added to schema-one specialist and council records must remain backward-compatible with records created before those fields existed.
