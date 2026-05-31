<!-- Context: sse/guides/e2e-testing | Priority: high | Version: 1.6 | Updated: 2026-04-12 -->

# E2E Testing for SSE Demo

Playwright tests for SSE: UI interactions, multi-user, real-time features.

## Quick Start

```bash
cd sse
pnpm exec playwright test        # Run tests
pnpm exec playwright test --ui  # UI mode
pnpm exec playwright test --headed
```

---

## Key Lint Rule

**Use `let` for local variables** (not `const`) inside test callbacks:

```typescript
// WRONG
test('my test', async ({ page }) => {
  const select = page.locator('select')
})

// CORRECT
test('my test', async ({ page }) => {
  let select = page.locator('select')
})
```

---

## Common Patterns

- **UI interactions**: Click, fill, submit forms
- **Real-time**: Wait for SSE events, check message updates
- **Multi-user**: Multiple browser contexts, verify broadcasts

---

## Reference

- Playwright: https://playwright.dev/
- SSE implementation: `guides/sse-implementation.md`
