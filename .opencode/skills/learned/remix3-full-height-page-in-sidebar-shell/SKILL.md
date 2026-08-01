---
name: remix3-full-height-page-in-sidebar-shell
description: 'Fill available height in a Remix 3 admin sidebar shell with config-gated shell styles, not height: 100vh'
origin: auto-extracted
---

# Full-Height Pages Inside the Remix 3 Sidebar Shell

**Extracted:** 2026-08-01
**Context:** Chat/agent pages rendered via `createSidebarLayout` (e.g. `/admin/workflowagent2`) showed a permanent ~10% vertical scrollbar at load and the input bar sat below the fold.

## Problem

A page inside the admin sidebar shell (via `renderAdminPage` / `createSidebarLayout`) that sets `height: 100vh` overflows its container. `100vh` is the *viewport* height, but the visible box is `viewport − MainNav − footer − breadcrumbs − shell padding`. The chat page is exactly as tall as the stacked chrome, so the shared `pageStyle` scroll container (`app/ui/layout.tsx`) always shows a scrollbar.

It cannot be fixed by changing only the page. Remix 3 `Frame` splices content inline with **no wrapper element**, so the page is a direct child of the shared `pageStyle` scroll container. Without height-constraining the shell itself, `flex: 1; min-height: 0` on the page has nothing definite to fill — an earlier fix attempt that only changed the page never worked.

## Solution

Constrain the shell height for target pages via a config-gated full-height mode on `createSidebarLayout`. Do NOT change the shared shell styles globally: `shellStyle`/`contentStyle` are reused by the lists and appointment layouts, and a blanket `height: 100%` breaks the sticky sidebar on tall pages (its containing block shrinks to one viewport, so the sidebar stops sticking after one screen).

```ts
// app/ui/sidebar-layout.tsx
fullHeightTargets?: string[] // pathname prefixes that should fill the available height

// when the request pathname matches a target, add:
//   shellStyle   → height: 100%; grid-template-rows: minmax(0, 1fr)
//   contentStyle → height: 100%
```

```ts
// app/ui/admin-layout.tsx — register the chat pages
fullHeightTargets: [
  routes.admin.agentEvents.index.href(),
  routes.admin.workflowAgent.index.href(),
  routes.admin.supportAgent.index.href(),
],
```

The page then fills the remaining height as a flex child of `contentStyle`:

```ts
// app/ui/<agent>-page.tsx
const pageStyle = css({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,          // NOT height: 100vh
  minHeight: 0,
  overflow: 'hidden',
})
```

**Standalone exception:** a page rendered directly inside the plain `Layout` — not the sidebar shell (e.g. route-agent at `/route-agent`) — has a definite-height scroll container as its parent, so `height: 100%` works there and it must NOT be registered in `fullHeightTargets`.

**Verify, don't assume:** a change marked complete in OpenSpec does not mean the code landed — grep the actual files for the old `height: '100vh'` pattern before trusting it.

## When to Use

- Adding a full-height page (chat, editor, dashboard) under `/admin` via `createSidebarLayout`
- A Remix 3 admin page shows a load-time vertical scrollbar because content is viewport-height inside a shorter scroll container
- "Input pinned to bottom" chat layout — also give the inner `Frame` container `flex: 1; min-height: 0` so an auto-growing input bar doesn't jump the layout
