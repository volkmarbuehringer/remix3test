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
