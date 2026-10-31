# Playwright reference (for goalfix verification)

The verification crib for UI/runtime work — especially Se'kret Bip, where visual and behavioral bugs don't show up in unit tests. Playwright evidence is required before calling that work done.

## Locators — prefer user-facing, in this order
- `getByRole('button', { name: 'Save' })` — most resilient
- `getByText('Welcome back')`, `getByLabel('Email')`, `getByPlaceholder('Search…')`, `getByAltText('logo')`, `getByTitle('Close')`
- `getByTestId('submit-btn')` — when nothing user-facing fits
- Escape hatch only as a last resort: `locator('.btn-primary')`, `locator('xpath=//button')`. Brittle CSS/xpath chains are what make suites flaky.

## Narrowing
- `.filter({ hasText: 'Pro' })`, `.filter({ has: getByText('$9') })`
- `.first()`, `.last()`, `.nth(2)`, `.or(x)`, `.and(x)`, and chaining like `row.getByRole('button')`
- Two or more matches on a strict locator throws a strict-mode error — narrow it.

## Actions
- `.click()`, `.dblclick()`, `.click({ button: 'right' })`
- `.fill('hello')` (note: `type()` is deprecated — use `fill()`), `.pressSequentially('h-i')`, `.press('Enter')`
- `.check()` / `.uncheck()`, `.selectOption('blue')`, `.hover()`, `.dragTo(target)`, `.setInputFiles('cv.pdf')`

## Assertions — always `await expect(locator)`
- `.toBeVisible()` / `.toBeHidden()`, `.toBeEnabled()` / `.toBeDisabled()`, `.toBeChecked()`, `.toBeFocused()`
- `.toHaveText('exact')`, `.toContainText('part')`, `.toHaveValue('x')`, `.toHaveCount(3)`, `.toHaveAttribute('id', 'x')`
- Negate with `.not.toBeVisible()`. Page-level: `expect(page).toHaveURL(/dash/)`, `expect(page).toHaveTitle('App')`

## The rules that keep suites honest
- Assertions auto-retry (~5s) and locators auto-wait — never use `waitForTimeout()` or manual sleeps.
- Always `await` your expects. `expect.soft(loc)` continues past a failure instead of stopping.
- Test money paths first (signup, checkout, core action). Test what the user sees, not implementation details.
- One unhappy path per flow (bad input, network failure, expired session). Tests stay independent — any order, zero shared state, each seeds its own data.
- Headless in CI, headed locally for debugging. Capture screenshots and traces on failure only — that's the evidence for the goalfix PROOF block.
