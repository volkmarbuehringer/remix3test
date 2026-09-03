---
name: remix3-content-sized-flex-panel
description: "Use when a Remix 3 flex-column panel/card collapses to just its header after you make it content-sized (remove flex:1, or cap with max-height to center it) in a bounded full-height shell, or when flex:1 (flex-basis:0) children stop contributing to a container's natural height — switch them to flex:1 1 auto so content sizes the panel while the inner list still shrinks/scrolls"
metadata:
  origin: auto-extracted
---

# Content-Sized Flex Panel Collapse (flex-basis: 0 children)

**Extracted:** 2026-09-03
**Context:** Remix 3 `/lists` editor (custom layout rendered in the top-level `Layout`). Converting a full-height editor card into a content-sized, vertically centered one made the card collapse to just its header — the body and element list vanished and the page looked "destroyed" (the card rendered ~40px tall).

## Problem
A flex-column container whose children use `flex: 1` (= `flex: 1 1 0%`, i.e. **flex-basis: 0%**) only has height because something stretches it. When the container itself is `flex: 1` against a bounded parent, `flex-grow` stretches it and the `flex: 1` children fill the space — that is the normal scheme.

The moment you make the container **content-sized** — remove `flex: 1` from it, or cap it with `max-height` so it can shrink for centering — those `flex: 1` children stop contributing to its natural height (basis 0 = no content height). The container collapses to just its **non-flex** children (typically a header), and everything below (body / scrollable list) is hidden by `overflow: hidden`. Symptom: "the main window is only visible to a small part."

## Solution
Change every `flex: 1` level in the chain to `flex: 1 1 auto` (or `flexGrow: 1; flexShrink: 1; flexBasis: 'auto'`). Auto basis lets each level contribute its content to the container's natural height (so it sizes correctly when content-sized and centered), while `flex-shrink: 1` + `min-height: 0` still lets the inner list shrink and scroll when the container is capped for tall content.

```js
// Container is now content-sized (NOT flex: 1) so it can be centered:
let cardStyle = css({
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 'calc(100% - 6rem)', // leave free space above/below
  minHeight: 0,
  overflow: 'hidden',
})

// Every level that was `flex: 1` must become auto basis:
let cardBodyStyle = css({
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,        // was flex: 1
  flexShrink: 1,
  flexBasis: 'auto',  // <-- the key: auto, not 0
  minHeight: 0,
})
// Repeat `flexGrow: 1; flexShrink: 1; flexBasis: 'auto'` on the list wrapper
// and the scrollable list so they keep contributing to the natural height.
```

**Center it in a bounded shell:** the content column is a flex column that fills the bounded viewport; add `justify-content: center` to it so the content-sized card is vertically centered (free space above and below) instead of pinned to the top.

```js
section: css({ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 })
```

**Fixed-height companion (no jump):** if you also need a sidebar to keep a stable height across pages, keep it full-height instead of content-sized, add a small bottom gap with `margin-bottom`, and pin the pagination to the bottom of the panel with `margin-top: auto` so empty space never appears below the pagination.

## Relationship to remix3-bounded-scroll-flexchain
That skill covers the **fill** case (`flex: 1` + `min-height: 0` so bounded scroll regions actually scroll). This one covers the **content-size** case — the collapse you hit when you stop stretching the container. Two sides of the same flex-chain problem; the auto-basis fix is what lets a panel be both content-sized and internally scrollable.

## When to Use
- A Remix 3 flex-column card/panel collapses to just its header after you change it from `flex: 1` to content-sized (`max-height`, centering, auto height).
- You want a vertically centered / content-sized panel inside a bounded full-height shell and the inner scroll region disappears.
- Children with `flex: 1` (basis 0) stop contributing to a container's natural height.
