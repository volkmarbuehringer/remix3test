# Bounding a Plain-Layout Data Grid (no page scrollbar)

**Source:** `remix3-plain-layout-bounded-grid`

**Extracted:** 2026-10-09
**Context:** `/verwaltung` appointments/offerings/resources/offering-configs grids render in the top-level `Layout` (NOT `createSidebarLayout`). A default 15-row page overflowed the shared `pageStyle` scroll container by ~150px at a 900px viewport, so the page always showed a scrollbar and the title/filters/table header scrolled away with the rows.

## Problem

The top-level `Layout` (`app/ui/layout.tsx`) already ships a bounded chain: `main { flex: 1; overflow: hidden }` → `pageStyle { flex: 1; overflow-y: auto }`. `body` is `min-height: 100vh` and `<html>` sets `overflow-y: scroll`, but the **document does not scroll** — `pageStyle` (`main > div`) is the scroll container (`documentElement.scrollHeight === clientHeight`; `pageStyle.scrollHeight` is the one that overflows).

A page cannot fix this by putting `height: 100%` or `flex: 1` on its own `<section>`: `pageStyle` also holds a **sibling above the section** — the Verwaltung tab nav (`app/ui/verwaltung-nav.tsx`) — so `height: 100%` on the section overflows by exactly the nav's height. The existing sidebar-shell `fullHeightTargets` mode does not apply (this is the plain `Layout`, which also renders frame fragments for agent panels).

## Solution

Add a **route-scoped** `fullHeight` option to the render helper; never change the shared shell. For the plain Layout the wrapper must include the tab nav so the section becomes the flex remainder:

```ts
// app/ui/verwaltung-layout.tsx
const fullHeightShellStyle = css({
  height: '100%',        // resolves against pageStyle's content box, not 100vh
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  '& > section': { flex: 1, minHeight: 0 }, // non-hover child combinator DOES emit
})

// full-document path only; the isFrame branch keeps the host layout
if (fullHeight) {
  return render(
    <Layout title={title}>
      <div mix={fullHeightShellStyle}>
        <VerwaltungNav />
        {content}
      </div>
    </Layout>,
    init,
  )
}
```

Controllers pass `fullHeight: !data.editRow && !data.creating` so the two-column edit/create layout keeps normal page scrolling.

Carry the fill down to the row region with `flex: 1 1 auto` — **not** `flex: 1`:

```ts
// app/ui/mixins/verwaltung-grid.ts
export const verwaltungGridFill = css({ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' })
export const verwaltungGridWrap = css({ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' })
```

`1 1 auto` is the safety property: the same classes are also applied when there is **no** bounded shell (a frame fragment loaded into an agent panel), where a content-sized ancestor + `flex-basis: 0` + `min-height: 0` collapses the grid to zero height (see `content-sized-flex-panel.md`). Auto basis keeps it content-sized there and filling only when bounded.

Density goes on the table wrapper, desktop-scoped, with `!important` because it competes with the shared cell mixins in sibling `@layer rmx.*` sub-layers (see `cascade-layer-overrides.md`):

```ts
export const verwaltungGridDensity = css({
  '@media (min-width: 769px)': {
    '& thead th': { position: 'sticky', top: 0, zIndex: 1, padding: `${theme.space.xs} ${theme.space.md} !important` },
    '& tbody td': { padding: `${theme.space.xs} ${theme.space.md} !important` },
  },
})
```

Measured at 1280×900 with 15 rows: row height 47→39px, header 35→27px, `pageStyle.scrollHeight === clientHeight`, and the table wrapper `scrollHeight === clientHeight` (no scrollbar anywhere). The page never scrolls at any height; below ~865px viewport only the row region scrolls while chrome stays pinned.

## Verify by measurement

Temporarily boot the real grid in an e2e (`t.serve(await createTestServer((r) => router.fetch(r)))`, seed 15 rows, admin cookie), `page.setViewportSize`, then `page.evaluate` the boxes:

```js
let pageEl = document.querySelector('main > div')
return { pageScroll: pageEl.scrollHeight, pageClient: pageEl.clientHeight,
         wrapScroll: wrap.scrollHeight, wrapClient: wrap.clientHeight,
         rowHeight: row.getBoundingClientRect().height }
```

`pageScroll === pageClient` is the "page never scrolls" assertion. Delete the harness afterwards.

## When to Use

- A `/verwaltung` (or any plain-`Layout`) data grid shows a page scrollbar and you want chrome pinned while only rows scroll.
- You put `height: 100%`/`flex: 1` on a page `<section>` that shares `pageStyle` with a sibling (a tab nav) and it overflows by the sibling's height.
- A fill class is applied both inside and outside a bounded shell (full document vs frame fragment/agent panel): use `flex: 1 1 auto`, or it collapses to zero height unbounded.
