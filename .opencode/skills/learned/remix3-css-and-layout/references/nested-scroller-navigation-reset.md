# Nested Scroller Offset After Frame Navigation

**Source:** `remix3-nested-scroller-navigation-reset`

**Extracted:** 2026-10-09
**Context:** `/admin` data grids (chatlog, messages, lists, users, clients, webhooks, uploads) kept the previous page's scroll offset after pagination. With variable row heights the destination page height is unpredictable, so the browser clamped the stale offset — measured a 235–251px jump (`scrollTop` 253 → 14/18) and, on a shorter final page, a jump to the top.

## Problem

The app's real scroll container is `main > div` (`pageStyle`, `flex: 1; overflow-y: auto`), **not the document** (see `plain-layout-bounded-grid.md`). The Remix 3 frame runtime's default scroll reset is the Navigation API's `event.scroll()` (`@remix-run/component` `runtime/navigation.ts`: `if (scroll !== 'manual') event.scroll()`), which resets the **document**/top-level scrolling element only. A frame navigation that swaps `admin-content` therefore leaves the nested `pageStyle` offset untouched, and the browser clamps it when the new content is shorter.

## Solution

1. **Reset the app scroller after same-document navigations**, matching the framework's `after-transition` default. Mark the container and mount one persistent `clientEntry` in the top-level `Layout` (the document shell is not replaced by frame swaps, so it persists):

```tsx
// app/ui/layout.tsx
<div mix={pageStyle} data-page-scroller="true">…</div>
<PageScrollReset />  // clientEntry, returns null
```

```ts
// app/ui/page-scroll-reset.browser.tsx
window.navigation.addEventListener('navigate', (event) => {
  // push/replace only: traverse (Back/Forward) keeps native restoration
  // opt out when the source set data-rmx-reset-scroll="manual" ("false" alias)
})
window.navigation.addEventListener('navigatesuccess', () => {
  document
    .querySelectorAll('[data-page-scroller], [data-grid-scroll]')
    .forEach((el) => el.scrollTo({ top: 0, behavior: 'auto' }))
})
```

2. `frame.reload()` (SSE invalidation via `ConnectionIndicator`, chatlog detail) does **not** create a Navigation API navigation, so live grids are not yanked to the top.
3. A page that manages its own scroller must be excluded: the appointment create/delete panel (`CreatePanelScrollLive`) scrolls its header into view on mobile, and a generic reset would cancel it. Guard on `[data-create-panel]`, or opt the trigger out with `data-rmx-reset-scroll="manual"`.
4. Reset the bounded row region too (`data-grid-scroll` on `verwaltungGridWrap`'s host) — it has the same preserved-offset behaviour inside the bounded shell.
5. Reserve the scrollbar gutter (`scrollbarGutter: 'stable'`) on both scrollers: variable row heights toggle the scrollbar, and an unreserved gutter shifts the whole grid sideways.

## Verify by measurement

Temporary `t.serve` e2e: seed variable-content rows, `page.goto`, `page.evaluate(() => { el.scrollTop = el.scrollHeight })`, click "Weiter", then assert `[data-page-scroller].scrollTop === 0`. Before the fix the value was the clamped remainder (e.g. 18); after, 0. See `app/actions/admin/admin-grid-scroll.test.e2e.ts`.

## When to Use

- A grid inside the sidebar/plain `Layout` jumps or lands mid-page when paginating, sorting, or filtering.
- The jump appears only for pages with variable row heights, because the clamp target moves.
- You expect `data-rmx-reset-scroll` to reset an inner scroll container — it will not; the runtime resets only the document.
