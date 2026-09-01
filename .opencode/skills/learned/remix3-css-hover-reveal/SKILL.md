---
name: remix3-css-hover-reveal
description: "Use when a hover-reveal (row action buttons, delete, tooltip) isn't appearing in a remix/remix-ui app, or when `&:hover > *` / `&:hover [attr]` in `css()` silently does nothing — the remix-ui css() runtime won't generate parent→child reveal selectors under `:hover`; toggle inline opacity from a small clientEntry instead."
metadata:
  origin: auto-extracted
---

# remix3 CSS: hover reveal of child/nested elements

**Extracted:** 2026-08-24
**Context:** Styling a sidebar/row whose action buttons (rename, delete, etc.) should appear only while the row is hovered or keyboard-focused, in a Remix 3 `remix/ui` app.

## Problem
In the `remix/ui` `css()` runtime (this app's nightly `remix`), a reveal rule that selects a **descendant/child only while a hovered ancestor** is applied silently generates *nothing*. All of these are no-ops:

```ts
css({
  '&:hover > *': { opacity: '1' },                 // no rule emitted
  '&:hover > [data-row-action]': { opacity: '1' }, // no rule emitted
  '&:hover [data-row-action]': { opacity: '1' },   // no rule emitted
})
```

Meanwhile `:hover` on the element itself **does** apply (button hover works), and a non-hover child combinator **does** apply (e.g. `& > * { pointerEvents: 'auto' }`). Because the rule is never emitted, you can't diagnose it from the DOM: the row's `:hover` matches (`el.matches(':hover') === true`) yet the child's `getComputedStyle(el).opacity` never changes — and all its rules are missing from `document.styleSheets` (the styles get shadow/adopted stylesheet treatment, so dumping `cssRules` shows nothing).

## Solution
Drive the reveal from a `clientEntry` that toggles **inline** `style.opacity` on the targeted children, wired to the row's `mouseenter/mouseleave` and `focusin/focusout`. Give each hidden button a stable attribute (e.g. `data-row-action`) and set its resting opacity via `css()`.

```tsx
// lists-row-actions.tsx — mirrors the sidebar client entries that already
// re-init on frame `reloadComplete` and abort their prior listeners.
export const RowActions = clientEntry(
  import.meta.url + '#RowActions',
  function RowActions(handle: Handle) {
    let controllers: AbortController[] = []

    function init() {
      for (let ac of controllers) ac.abort()
      controllers = []
      let rows = Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]'))
      if (rows.length === 0) return

      let reveal = (el: HTMLElement) => {
        for (let child of el.querySelectorAll<HTMLElement>('[data-row-action]'))
          child.style.opacity = '1'
      }
      let dim = (el: HTMLElement) => {
        for (let child of el.querySelectorAll<HTMLElement>('[data-row-action]'))
          child.style.opacity = ''
      }

      for (let row of rows) {
        let ac = new AbortController()
        controllers.push(ac)
        row.addEventListener('mouseenter', () => reveal(row), { signal: ac.signal })
        row.addEventListener('mouseleave', () => dim(row), { signal: ac.signal })
        row.addEventListener('focusin', (e) => {
          if (row.contains(e.target as HTMLElement)) reveal(row)
        }, { signal: ac.signal })
        row.addEventListener('focusout', (e) => {
          let t = e.relatedTarget as HTMLElement | null
          if (!t || !row.contains(t)) dim(row)
        }, { signal: ac.signal })
      }
    }

    return () => (
      <div mix={[css({ display: 'none' }),
        ref(() => {
          if (typeof document === 'undefined') return
          init()
          handle.frame.addEventListener('reloadComplete', init, { signal: handle.signal })
        })]} />
    )
  },
)
```

In the markup, tag each reveal target and set the resting opacity in its own style object:

```tsx
<button type="button" data-row-action mix={hideBtnStyle} ...>
// hideBtnStyle = css({ opacity: '0.3', transition: 'opacity 0.12s ease' })
```

## How to verify
In a browser, hover the row then assert the child's computed opacity changed:

```ts
let before = await btn.evaluate((el) => getComputedStyle(el).opacity) // "0.3"
await row.hover(); await page.waitForTimeout(200)
let after  = await btn.evaluate((el) => getComputedStyle(el).opacity) // "1"
```

Use `0.3` as a still-clickable resting state (so `pointer-events` never traps clicks); gate destructive actions separately (e.g. a `data-confirm` delete) rather than via `pointer-events: none` on the hidden button.

## When to Use
- A hover/focus reveal of per-row actions in a remix3 `remix/ui` app isn't appearing.
- You reached for `&:hover > child` / `&:hover [child]` in `css()` and it does nothing.
- The row matches `:hover` but the child's computed style never changes; `:hover` on the element itself still works.
- You need keyboard reachability as well — handle `focusin`/`focusout`, not just `mouseenter`/`mouseleave`.

## Variant: reveal without reserving layout width

The base technique keeps the hidden buttons **in-flow** at a still-clickable `opacity: 0.3`. When the row/column is narrow (e.g. a 220px sidebar) the hidden buttons still reserve flex width and squeeze the row's label. For a no-width-reserve reveal:

- Wrap the actions in a cluster that is `position: absolute; right: 8px; top: 50%; transform: translateY(-50%)` on a `position: relative` row, and give the **cluster** (not just each button) a resting `opacity: 0; pointer-events: none`.
- On reveal toggle **both** inline `opacity` and `pointer-events` (`auto`) on the cluster — `pointer-events: none` on the container is what lets clicks pass through to the row beneath (nothing is trapped), and it must be turned on again to be interactive.
- This is the case that *does* use `pointer-events: none`: the cluster is out of flow, so the earlier advice (keep a `0.3` still-clickable in-flow state) does not apply. Use the absolute/`pointer-events` variant only when you must free the layout width.

For a list whose rows **re-render** on every state change (typing, toggling done), wire the reveal by **delegation** on the stable list container instead of per-row `mouseenter` (which is lost on re-render). Use `mouseover`/`focusin` to find the row via `closest('[role="listitem"]')`, plus `mouseleave`/`focusout` to hide, and keep the setup in a `ref` with an `AbortController` (or a `clientEntry` re-init on `reloadComplete`).

```tsx
// container ref — delegated, survives re-renders
let active: HTMLElement | null = null
function setOp(row: HTMLElement, op: string) {
  let c = row.querySelector<HTMLElement>('[data-item-actions]')
  if (c) { c.style.opacity = op; c.style.pointerEvents = op === '1' ? 'auto' : 'none' }
}
el.addEventListener('mouseover', (e) => {
  let r = (e.target as HTMLElement).closest<HTMLElement>('[role="listitem"]')
  if (r) { if (active && active !== r) setOp(active, ''); setOp(r, '1'); active = r }
}, { signal: ac.signal })
el.addEventListener('mouseleave', () => {
  if (active) { setOp(active, ''); active = null }
}, { signal: ac.signal })
```

Force-visibly reveal an actively-editing row by adding a conditional style (`opacity: 1; pointer-events: auto`) when that row is in edit mode, so its Save/Cancel actions are always visible instead of waiting for hover.
