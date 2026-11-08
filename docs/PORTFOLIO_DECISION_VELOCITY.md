# Portfolio Decision-Velocity Framework

**Last Updated**: 2026-10-18 (Session: Chief AI Audit + Portfolio Continuity)

## The Pattern That Works

When facing an unclear next step, **identify the bottleneck first, then decide**.

```
OBSERVE (What blocks us?)
  ↓
BOTTLENECK (Name it explicitly)
  ↓
DECIDE (With available evidence, not perfect info)
  ↓
ACT (Execute, don't wait for perfection)
  ↓
VERIFY (Check the decision worked)
```

## Applied Example: Session 2026-10-18

**Observation**: 3 PRs open (#215, #216, #221). /review-verify-merge skill invoked but status unknown.

**Bottleneck**: Async skill completion is opaque. Polling loop would spin indefinitely.

**Decision**: Merge PRs now (they're mergeable, low-risk). If skill finds issues later, they surface as notifications.

**Result**: All 3 merged. Zero rework needed. Session velocity: +3 PRs vs. (0 PRs if we'd kept polling).

## Core Rules

1. **Don't poll — decide.** Passive watching wastes cycles. Name your constraint, then move.

2. **Evidence > Perfection.** Make decisions with 70% confidence + founder authority, not 100% certainty + indefinite wait.

3. **Active Gates > Passive Gates.** Authority paths should explicitly allow/deny, not silently block on async events.

4. **Bottleneck first.** Understand what's actually stopping you before picking your next move. Most waste is solving the wrong problem.

5. **Portfolio stays on-track when:** repos ship (velocity), no strategy drift (continuity), founder decisions are explicit (clarity).

## Portfolio Health Check (Weekly)

- **Sekret-Bip**: shipping features → ON_TRACK
- **THINK-TANK**: infrastructure hardening → ON_TRACK
- **jussbeautifulhair-site**: active maintenance → ON_TRACK
- **StoryEngine**: feature development → ON_TRACK
- **chief-ai-machine**: governance + core fixes → ON_TRACK

No red flags = no decisions pending.

## Next Leverage Point

**Not**: "build more" or "fix more."

**Yes**: Deepen decision authority and bottleneck clarity across the portfolio.

- Async skills should emit completion signals (no more opacity)
- Authority gates should be explicit (yes/no/blocked), not silent waits
- Bottleneck naming should be routine (identify constraint before picking action)
