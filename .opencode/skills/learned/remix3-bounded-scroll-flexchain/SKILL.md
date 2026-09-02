---
name: remix3-bounded-scroll-flexchain
description: "Use when a viewport-bounded Remix 3 page's inner list/sidebar won't scroll, or when a flex:1 child is clipped by an overflow:hidden wrapper that is display:block, or a full-height page shows fewer items than the configured page size — the flex chain needs min-height:0 at every level"
metadata:
  origin: auto-extracted
---

# Viewport-Bounded Scroll Regions: flex chain & the block-clip gotcha

**Extracted:** 2026-09-02
**Context:** Remix 3 `/lists` editor — a custom layout (not the sidebar-shell factory) rendered inside the top-level `Layout`. After bounding the shell to the viewport, a 25-item element list stopped scrolling, a 5-item list pushed rows below the fold, and the sidebar clipped its list.

## Problem
Once a Remix 3 page's shell is bounded to the available height (`height: 100%` on the page grid + `grid-template-rows: minmax(0, 1fr)`), nested flex containers need `min-height: 0` so children can shrink below their content. The silent failure: a **`display: block` wrapper with `overflow: hidden` clips a `flex: 1` child instead of letting it scroll**. The child keeps its content height and the block wrapper clips it at the wrapper's height (forced by the bounded parent), so later rows are unreachable even though `overflow-y: auto` is set on the child. Symptoms: "a 25-item list stopped scrolling", "I can only see 4/23 elements", "the sidebar page size looks too small".

## Solution
Make every level shrinkable and give the real scroll region `flex: 1; min-height: 0; overflow-y: auto`. The wrapper visually containing the scroll child must be `display: flex; flex-direction: column; min-height: 0` — NOT a bare `display: block; overflow: hidden`.

```
shell    height:100%; grid-template-rows:minmax(0,1fr)
  section display:flex; flex-direction:column; min-height:0
    card  flex:1; min-height:0; overflow:hidden; display:flex; flex-direction:column
      body flex:1; min-height:0; display:flex; flex-direction:column
        wrapper flex:1; min-height:0; overflow:hidden; display:flex; flex-direction:column  <- MUST be flex column
          list   flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column
```

Sidebar, when the full-height shell also bounds the aside:
```
aside  display:flex; flex-direction:column; min-height:0; overflow:hidden
  nav  flex:1; min-height:0; overflow-y:auto
```
Keep the header (and search, if desired) outside `nav` so it stays fixed while the list scrolls.

## Scrollbar styling
Use standard properties — `scrollbarWidth: 'thin'`, `scrollbarColor: '<thumb> <track>'` (with theme tokens) — because the remix-ui `css()` runtime emits nested `&::-webkit-scrollbar` rules that **Firefox ignores**, leaving the list without a scrollbar. Note: scoping with `@supports not selector(::-webkit-scrollbar)` does **not** work, since Firefox reports `CSS.supports('selector(::-webkit-scrollbar)')` as `true`.

## When to Use
- A viewport-bounded full-height Remix 3 page's inner list/sidebar won't scroll despite `overflow-y: auto`.
- A `flex: 1` child is clipped by an `overflow: hidden` wrapper that is `display: block`.
- Full-height bounding leaves a sidebar/list showing fewer items than the configured page size.
