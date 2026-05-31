<!-- Context: development/remix3/guides/e2e-testing | Priority: medium | Version: 1.5 | Updated: 2026-04-07 -->

# E2E Testing with Playwright

**Purpose**: Playwright testing patterns for Remix data routes and real-time applications.

## Key Points

- **E2E = End-to-End**: Tests that span multiple systems to verify complete flow
- **UI Flow**: User interactions → UI changes (`page.getByRole('button').click()`)
- **Integration**: Multiple systems work together (SSE + DB + Auth + Router)
- Always use unique test data (timestamp + random suffix) to prevent parallel conflicts
- Multi-user testing: Use separate browser contexts for real-time features (SSE/WebSockets)
- Wait for SSE sync: `await page.waitForTimeout(500)` after actions
- **Always run lint before committing** e2e tests
- **Use `let`** for local variables (not `const`) inside test callbacks

## Lint Rules for E2E Tests

**IMPORTANT**: Always run lint on e2e tests before committing.

The project's lint rule `remix-style(prefer-let-locals)` requires using `let` for local bindings and reserves `const` for module scope. In e2e tests (which run inside test callbacks and are not at module scope), all local variables should use `let`, not `const`.

```typescript
// WRONG (const for local bindings inside test)
test('my test', async ({ page }) => {
  const select = page.locator('select[name="foo"]')
  const options = select.locator('option')
})

// CORRECT (let for local bindings inside test)
test('my test', async ({ page }) => {
  let select = page.locator('select[name="foo"]')
  let options = select.locator('option')
})
```

Run lint before committing:

```bash
pnpm run lint
```

## Minimal Example

```typescript
// Unique test data
function uniqueRoom(name: string) {
  return `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// UI Flow test
test('join button shows leave after joining', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Join Room' }).click()
  await expect(page.getByRole('button', { name: 'Leave Room' })).toBeVisible()
})

// Multi-user (SSE)
test('messages broadcast', async ({ browser }) => {
  const ctx1 = await browser.newContext()
  const ctx2 = await browser.newContext()
  const p1 = await ctx1.newPage(), p2 = await ctx2.newPage()
  // ... test real-time messaging
  await ctx1.close(); await ctx2.close()
})
```


**Related**: `guides/data-route-checklist.md`, `guides/test-coverage.md`