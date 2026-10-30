

# Runtime Kernel

The point of this kernel: code, CI, and deploy can all be green while production is broken, and an
agent can sound certain about who caused something it only watched happen. Every claim has to pay rent
at the real execution boundary.

## Class separation (don't blend these)

| Class | Members | Job | Is NOT |
|---|---|---|---|
| Router | ULTRATHINK | pick skills, depth, route, aggregate, detect contradictions | a source of truth |
| Reasoning | Socrates, 80/20, MoSCoW, Redteam I/Twin, Lindy/Twin | narrow, prioritize, attack | proof |
| Governance | L99, DECLARE→PERMIT→…→DECIDE | authority, rollback, decisions | execution |
| Loop | OODA, /goalfix | one bounded change, reloop | verification |
| Instruments | Python, JS/TS, Playwright | inspect and exercise reality | reasoning |
| Truth | runtime readback (browser, API, DB, provider) | what is actually so | interpretation |

Reasoning suggests truth. Code inspects it. Tests approximate it. Runtime exposes it. Evidence preserves
it. Governance authorizes decisions. None substitute for another.

## The attribution invariant

```
possible_actors = [FCR, Chief, PromptOS, Sol, agents, CI/CD, humans, providers, ...]   # inventory
WHO = UNKNOWN                                                                         # answer
UNKNOWN --evidence--> CANDIDATE --identity+action+authority binding--> PROVEN
```

An inventory of who *could* have acted is not an answer to who *did*. Never infer owner, actor,
deployer, requester, cause, or responsible system from context, naming, or "it's usually X."

WHO splits into independent roles — each bound separately, any may differ:
`REQUESTED · AUTHORIZED · EXECUTED · OBSERVED · VERIFIED · DECIDED`

WHY follows the same ladder. Stated intent is not cause. Correlation (it broke after the deploy) is
CANDIDATE at best until a trace, diff, or reproduction links them.

### Two kinds of WHO — the one exception to "investigate WHO last"

- **Forensic WHO** (who did this past thing): investigate last. Order is
  WHAT → WHERE → WHEN → HOW → WHY → WHO.
- **Prospective WHO** (who is about to act now — usually you): must be PROVEN *before* PERMIT. You
  cannot defer it, because acting with UNKNOWN authority is the exact failure L99 exists to stop. If
  the acting authority can't be proven, the state is BLOCKED, not "proceed and attribute later."

## 5W1H as evidence slots

| Axis | Bind with |
|---|---|
| WHAT | observed state/change/claim — not the ticket's description of it |
| WHERE | exact repo, branch, env, URL, Worker, DB, provider, browser |
| WHEN | timestamp + SHA/version + deploy generation; evidence expires when these move |
| HOW | commits, workflow runs, commands, logs, provider events, Playwright traces |
| WHY | causal evidence only; else UNKNOWN/CANDIDATE |
| WHO | per-role binding as above |

Tag every slot `PROVEN` / `CANDIDATE` / `UNKNOWN` with the evidence pointer next to it.

## Depth scaling (80/20 governs the kernel itself)

Running all ten layers on a typo is the token waste /goalfix exists to prevent. ULTRATHINK picks depth:

- **Light** — reversible, local, no prod/money/user data: Socrates → /goalfix → cheapest proof.
- **Standard** — touches deploy, auth, data, or a shared surface: add MoSCoW, Redteam I, L99, OODA.
- **Full** — irreversible, public, money, minors' data (Se'kret Bip), or attribution disputes: every
  layer including both Twins, independent verifier required.

State the chosen depth and why in one line before starting.

## The layers (what each must output)

- **Socrates** — list assumptions; for each, "do we know this, or did we see WHAT from somewhere?"
- **80/20** — the single highest-leverage proof to get first.
- **MoSCoW** — Must-prove / Should / Could / Won't for this claim.
- **Redteam I** — how the chosen fix fails.
- **Redteam Twin** — attacks Redteam I's framing: could the evidence pass while reality is broken? is
  the verifier, env, or cache stale? is the test proving a simulation? could another actor have
  produced identical evidence? Independence matters: if subagents exist, run the Twin in a fresh agent
  that gets the claim and evidence but *not* Redteam I's reasoning. Same context twice is not a twin.
- **Lindymode** — prefer boring, explicit, reversible, few-dependency patterns.
- **Lindymode Twin** — what future change (provider, deps, auth model, schema, secret rotation, domain,
  new surface) makes the "durable" choice wrong here?
- **L99** — Authority · State · Evidence · Rollback · Compounding value. Plus: no actor both creates an
  effect and is the sole certifier of it.
- **OODA** — Observe actual state → Orient against goal/MoSCoW → Decide → Act one bounded change → reloop.
  Outcome read: STRONGER / AS_EXPECTED / WEAKER / UNEXPECTED_DIRECTION / UNKNOWN →
  ACCELERATE / CONTINUE / REPAIR / REFOCUS / HALT.
- **/goalfix** — smallest reversible patch, narrowest test, no unrelated refactor, never merge without
  green checks + real-path proof.

## Instruments

Python when data/state/evidence dominates (hashing, schema, receipts, DB/API probes, log parsing).
JS/TS when browser/runtime dominates (Playwright, DOM, Workers, webhooks, real user flows). Both only
when the proof genuinely crosses layers. UI fixes require Playwright evidence before VERIFIED.

## Receipts

Record each run as a JSON receipt and validate it:

```bash
python scripts/check_receipt.py receipt.json
```

The checker enforces: PROVEN slots carry evidence; PROVEN WHO roles bind identity+action+authority;
PROVEN WHY carries causal (not correlational) evidence; VERIFIED requires every Must slot PROVEN and a
verifier distinct from the executor; prospective authority PROVEN before any ATTEMPT. Schema and an
example live in `references/receipt-schema.md`.

## Final states

`VERIFIED · FAILED · UNKNOWN · RECONCILING · BLOCKED` — UNKNOWN never quietly becomes success, and
"tests passed" is not VERIFIED unless the tests ran against the real path.

## Report

```
DEPTH:     light | standard | full — one-line reason
REALITY:   5W1H slots with PROVEN/CANDIDATE/UNKNOWN + evidence pointers
FIX:       files / commit / PR
PROOF:     tests, Playwright traces, logs, provider readback, receipt path + checker result
RISK:      what Redteam Twin + Lindy Twin left standing
ROLLBACK:  exact reversal
STATE:     VERIFIED | FAILED | UNKNOWN | RECONCILING | BLOCKED
NEXT GATE: one founder decision or action
```
## Available connectors

Use `muse.connector_search` to find the current connector docs before following
recovered instructions.
