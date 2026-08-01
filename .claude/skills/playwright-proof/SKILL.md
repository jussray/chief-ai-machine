---
name: playwright-proof
description: Verify real browser behavior with Playwright and produce exact-head desktop/mobile evidence. Use for UI fixes, responsive layouts, navigation, forms, authentication, console or network regressions, live-site validation, and every Se’kret Bip UI/runtime completion claim.
---

# Playwright Proof

Prove `$ARGUMENTS` through the user path, not merely component rendering.

1. Record repository, exact commit, environment, URL, journey, expected outcome, and viewports.
2. Start or identify the production-equivalent app without replacing real behavior with mocks unless the product uses them.
3. Run the narrowest test covering entry, primary action, success, and meaningful failure.
4. Verify desktop and mobile for responsive UI work.
5. Capture assertions, decisive screenshots, trace on failure, console errors, failed requests, and relevant status codes.
6. Visually inspect hierarchy, clipping, placement, naming, and polish. Selector assertions alone are insufficient.
7. Report infrastructure failures separately when the test never executed.

Do not call work done when the flow was skipped, retried into green, screenshot-only, or tested against the wrong commit. Report commit, command, projects/viewports, counts, URL, artifacts, console/network findings, and unverified remainder.
