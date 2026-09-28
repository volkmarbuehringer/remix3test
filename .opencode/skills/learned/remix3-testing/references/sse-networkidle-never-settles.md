# SSE pages: `networkidle` never settles

**Source:** `remix3-playwright-sse-networkidle-hang`

**Context:** Validating `/appointments/new` mobile UX with Playwright — `waitForLoadState('networkidle')` after navigation hung until the tool timeout, repeatedly.

Remix 3 pages serve a live `text/event-stream` channel (`/appointments/new/events` via the SSE `appointmentChannel`, plus chat, agent-events, and webhook-requests routes). The browser keeps the `EventSource` open indefinitely, so **`page.waitForLoadState('networkidle')` never resolves** — Playwright waits forever for zero in-flight requests. The same trap hits `Promise.all([waitForLoadState('networkidle'), click(...)])` after a navigate or submit.

Never use `networkidle` on a page (or after an action) that mounts an SSE/streaming connection. Wait on something that actually completes:

```js
// navigation — wait for a stable DOM anchor, not network idle
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.waitForSelector('[data-appointments-table]', { timeout: 8000 })

// signed-in submit → redirect: wait for the URL to change
await page.fill('input[name="email"]', email)
await page.fill('input[name="password"]', pwd)
await page.click('button[type="submit"]')
await page.waitForURL((u) => u.pathname === '/' && !u.pathname.startsWith('/auth'), { timeout: 8000 })

// click that swaps the wizard panel
await page.waitForSelector('[data-wizard-form]', { timeout: 8000 })
```

- Pick a real state-specific DOM anchor (list wrapper `[data-appointments-table]`, wizard `[data-wizard-form]`, delete panel `[data-create-panel]`) instead of a timing heuristic.
- Add a short `waitForTimeout` only if a `clientEntry` effect (scrolling, toggling) must settle before you assert.
