---
name: remix3-frame-cliententry-cascade-limit
description: "Many clientEntry inside a Remix 3 Frame triggers handle.update() infinite loop at page sizes >=50"
user-invocable: false
origin: auto-extracted
---

# Remix 3 Frame clientEntry Cascade Limit

**Extracted:** 2026-06-15
**Context:** A Remix 3 Frame that hosts 50+ `clientEntry` components (e.g., per-row delete buttons in a grid table) crashes on pagination with `handle.update() infinite loop detected`.

## Problem

A Remix 3 Frame's grid crashes with `Error: handle.update() infinite loop detected` when the page size is large enough to produce 50+ rows, but only on **subsequent page loads** (pagination, sort, filter), not on the initial load.

**Root cause chain:**
1. All `clientEntry` hydrations within a single Frame share that Frame's scheduler (`scheduler.ts`)
2. The scheduler's `cascadingUpdateCount` increments on every `flush()` call
3. On the **first load**, modules aren't cached yet — hydrations happen asynchronously in separate microtasks, giving `setTimeout(0)` a chance to reset the counter
4. On **subsequent loads** (pagination), modules are already in `context.moduleCache`, so all hydrations run **synchronously** without yielding to the event loop, accumulating the counter past `MAX_CASCADING_UPDATES = 50`
5. The error fires at counter value 51 (`> 50`), even though no actual infinite loop exists

## Solution

Reduce the number of `clientEntry` components within the Frame to stay below the 50 threshold:

1. **Replace per-row clientEntry with server-rendered forms** — use standard `<form method="POST" rmx-target="<frame-name>" data-confirm="...">` instead of per-row `clientEntry` delete buttons
2. **Use event delegation** — a single `clientEntry` can handle all row actions via DOM event delegation (e.g., `target.closest('tr[data-row-id]')`)
3. **Embed row data as JSON** in a `<script id="...-table-data" type="application/json">` tag for the delegated handler to read

Server-rendered forms inside a Frame need:
- `<CsrfTokenInput />` for the CSRF token
- `<input type="hidden" name="_method" value="DELETE" />` for method override (DELETE from POST form)
- Hidden inputs for offset/sort/order/filter state
- `rmx-target="<frame-name>"` for Frame-aware form submission without full page navigation
- Redirect the destroy action to the grid fragment URL (e.g., `/client/grid`) not the full page URL (`/client`)

## When to Use

- A Remix 3 Frame crashes with `handle.update() infinite loop detected` during pagination
- You have many `clientEntry` components (50+) inside a single Frame
- You're building a data grid with per-row action buttons inside a Frame
- You encounter the error only on cached (second+) renders, not on the first page load
