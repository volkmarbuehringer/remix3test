---
name: remix3-playwright-sse-networkidle-hang
description: "Use when a Playwright/e2e navigation or submit times out on a Remix 3 page that mounts an SSE EventSource channel (appointments new/events, chat, agent-events, webhook-requests), or when waitForLoadState('networkidle') never settles — use domcontentloaded + explicit selector/URL waits instead"
metadata:
  origin: auto-extracted
---

# Playwright + Remix 3 SSE: networkidle never settles

**Extracted:** 2026-08-28
**Context:** Validating the `/appointments/new` mobile UX with Playwright; a `waitForLoadState('networkidle')` after navigation hung until the tool timeout, repeatedly.

## Problem
Remix 3 pages serve a live `text/event-stream` channel (e.g. `/appointments/new/events` via the SSE `appointmentChannel`, plus the chat, agent-events, and webhook-requests events routes). The browser keeps the `EventSource` open indefinitely, so **`page.waitForLoadState('networkidle')` never resolves** — Playwright waits forever for zero in-flight requests and the test times out. The same trap hits `Promise.all([waitForLoadState('networkidle'), click(...)])` after a navigate or submit that must settle.

## Solution
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

Notes:
- Pick a real state-specific DOM anchor (list wrapper `[data-appointments-table]`, wizard `[data-wizard-form]`, delete panel `[data-create-panel]`) instead of a timing heuristic.
- Add a short `waitForTimeout` only if a `clientEntry` effect (scrolling, toggling) must settle before you assert.

## When to Use
- Writing or adapting Playwright / E2E / validation scripts against this app's SSE-backed pages.
- A `networkidle` navigation or submit times out after this app starts streaming an events channel.
