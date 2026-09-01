---
name: remix3-frame-shell-duplicate-breadcrumb
description: "Use when a Remix 3 frame-shell page (a route with its own sidebar/custom layout) shows the breadcrumb twice on a full GET, or when adding a new frame-shell route the page name appears as two headings — the top-level Layout wraps every non-/admin//ai path in a breadcrumb while the shell renders its own, so register the new route there."
metadata:
  origin: auto-extracted
---

# Frame-shell page duplicates the top-level Layout's breadcrumb

**Extracted:** 2026-09-01
**Context:** Redesigning `/lists` in this app (custom `lists-layout.tsx` shell) — the page rendered the breadcrumb twice on first load, and the user reported "two headings with lists."

## Problem
A route that renders its own frame shell (a custom layout with a sidebar + a `<Breadcrumbs>` in the content pane) **also** gets a breadcrumb from the top-level `Layout`. `app/ui/layout.tsx` renders breadcrumbs for every path *except* the hardcoded `/admin` and `/ai` prefixes:

```tsx
{currentPath.startsWith('/admin') || currentPath.startsWith('/ai') ? null : (
  <Breadcrumbs items={getBreadcrumbs(currentPath)} />
)}
```

So on a **full GET** of such a page (e.g. `/lists`) the breadcrumb is emitted twice: once by the outer document `Layout`, once inside the shell's content. They stack, so the page name appears as two near-identical headings. (Count `aria-label="Breadcrumb"` in the rendered HTML to confirm — it should be `1` for a normal page and `2` for a duplicated shell page.)

The shells already hand-suppress `/admin` and `/ai` because those shells render their own breadcrumb; the list is not extensible, so any *new* frame-shell route silently duplicates.

## Solution
Keep the shell's breadcrumb (it must persist across frame navigations), and register the new route in the top-level `Layout`'s suppression list:

```tsx
{currentPath.startsWith('/admin') ||
currentPath.startsWith('/ai') ||
currentPath.startsWith('/lists') ? null : (
  <Breadcrumbs items={getBreadcrumbs(currentPath)} />
)}
```

Do **not** fix it by deleting the shell's breadcrumb: `Layout` is the document shell and is not re-rendered on frame (`X-Remix-Target`) navigations, so the shell's breadcrumb is the only one that survives in-page navigation. Suppress the top-level one instead.

This is the mirror of `remix3-session-flash-frames`: flash needs its own banner *in* the fragment because fragments bypass the top-level `Layout`; breadcrumb is rendered *by* the fragment, so the top-level `Layout` must be told not to also render it.

## When to Use
- A frame-shell page (custom sidebar/layout, e.g. `/lists`, a new admin-like section) shows the page name twice on first load.
- Adding a new route that renders its own breadcrumb inside a frame shell — register it in `layout.tsx` pre-emptively.
- `aria-label="Breadcrumb"` appears twice in a full-GET render of a shell page.
