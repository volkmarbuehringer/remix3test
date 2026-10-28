# Unitless numeric CSS properties

**Extracted:** 2026-10-28
**Context:** Writing `css()` styles in Remix 3 (`@remix-run/component`), especially
vendor-prefixed properties.

## Problem

`css()` appends `px` to numeric values whose kebab-case key is outside its
`NUMERIC_CSS_PROPS` allowlist (`@remix-run/component/src/style/style.ts`,
`normalizeCssValue`). Vendor-prefixed properties are not on that list, so:

```ts
css({ WebkitLineClamp: 2 })
// emits -webkit-line-clamp: 2px
```

`2px` is invalid for `-webkit-line-clamp`; the browser drops it silently. The
clamp never applies, long text grows unbounded, and
`getComputedStyle(el).webkitLineClamp` is `none`. The same trap can hit other
unitless properties missing from the allowlist.

## Solution

Pass unitless values as strings, not numbers:

```ts
const clamped = css({
  display: '-webkit-box',
  WebkitLineClamp: '2',
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
})
```

- Do not use `2px` either.
- For properties that genuinely need units, pass a CSS string (`'0.5rem'`);
  numbers are only safe when the kebab key is in `NUMERIC_CSS_PROPS`
  (`opacity`, `z-index`, `order`, `line-height`, `font-weight`,
  `flex-grow`/`shrink`, `columns`, ...).
- Verify by checking the generated rule or computed value; a line clamp that
  does nothing is the common symptom.

## When to Use

- A `css()` line clamp or another vendor-prefixed property silently has no
  effect.
- You are about to write `WebkitLineClamp: 2` (or any numeric value for a
  property not listed in `NUMERIC_CSS_PROPS`).
- Reviewing a `css()` block where a numeric value is sent to a property that
  expects a unitless number.
