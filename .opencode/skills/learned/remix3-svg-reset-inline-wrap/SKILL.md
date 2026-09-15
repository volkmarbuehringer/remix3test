---
name: remix3-svg-reset-inline-wrap
description: "Use when an inline icon/glyph in a Remix 3 `remix/ui` page renders on its own line above its label, or a link/span containing an SVG wraps vertically — the `rmx-reset` layer's `:where(img, svg){display: block}`; make the host `inline-flex`."
metadata:
  origin: auto-extracted
---

# Remix 3: inline SVG wraps because of the `rmx-reset` display rule

**Extracted:** 2026-09-15
**Context:** A Remix 3 (`remix/ui`) page renders an icon/glyph next to text (pagination "Weiter ›", a chip, a plain text link with a chevron). The icon appears on the line above the label instead of beside it.

## Problem

`remix/ui` ships a global reset in the `rmx-reset` cascade layer:

```css
:where(img, svg) { display: block; }
```

An `<svg>` is therefore **block-level by default**. In any host that is not a flex/grid container — a plain inline `<a>`, `<span>`, or inline `<div>` — the SVG takes its own line and pushes the text below it. The markup is correct; only the computed layout is wrong, so `tsc`, render tests, and HTML assertions all pass.

Symptom: the chevron renders above "Zurück" instead of `‹ Zurück`.

## Solution

Make the **host** a flex container so the SVG becomes a flex item and sits inline:

```ts
const pageLink = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  // ...
})
```

Fix the shared control, not each call site. In this repo the pagination links are centralized in `app/ui/mixins/admin-table.ts` (`table.pageLink` / `table.pageLinkDisabled`), so one change fixed every admin grid.

Notes:

- If the host is already a flex item (e.g. inside a `display: flex` toolbar), the computed `display` is blockified from `inline-flex` to `flex` — still correct.
- `remix/ui` mixins that already declare `display: inline-flex` (`button()`, `table.searchBtn`, `table.sortLink`, `table.filterTab`) do **not** hit this. The bug appears in hand-rolled links/spans that only set padding/background.
- Prefer `gap` on the host over margins on the glyph.

## How to find the rule

The reset lives inside an `@layer`, so scanning only top-level `document.styleSheets[*].cssRules` for a selector containing `svg` finds nothing. Walk the rules recursively and match the element:

```ts
const hits = await page.evaluate(() => {
  const svg = document.querySelector('a svg')!
  const out: { layer: string; sel: string; style: string }[] = []
  function walk(rules: CSSRuleList, layer: string) {
    for (const rule of Array.from(rules)) {
      const grouping = rule as CSSGroupingRule
      const style = rule as CSSStyleRule
      if (grouping.cssRules && !style.selectorText) {
        walk(grouping.cssRules, layer + ' > ' + ((rule as { name?: string }).name ?? rule.constructor.name))
        continue
      }
      const sel = style.selectorText
      if (sel && svg.matches(sel) && /display/.test(style.style?.cssText ?? '')) {
        out.push({ layer, sel, style: style.style.cssText })
      }
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try { walk(sheet.cssRules, '') } catch {}
  }
  return out
})
// → [{ layer: 'rmx-reset', sel: ':where(img, svg)', style: 'display: block;' }]
```

The fast tell: `getComputedStyle(svg).display === 'block'` on an SVG you wrote inline.

## When to Use

- An icon/glyph and its label render on separate lines in a `remix/ui` page (pagination, toolbars, chips, text links).
- `getComputedStyle(svg).display === 'block'` on an inline SVG.
- Adding a new hand-rolled link/span with an icon — give the host `display: inline-flex; align-items: center; gap`.
