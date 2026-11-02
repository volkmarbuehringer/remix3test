# Unitless numeric CSS properties

**Extracted:** 2026-10-28
**Updated:** 2026-10-31 (fixed upstream in remix #12121, pinned at build `57ecca4cba`)
**Context:** Writing `css()` styles in Remix 3 (`@remix-run/component`), especially
vendor-prefixed properties and `flex` shorthands.

## Problem (pre-#12121 builds)

`css()` appended `px` to numeric values whose kebab-case key was outside its
`NUMERIC_CSS_PROPS` allowlist (`@remix-run/component/src/style/style.ts`,
`normalizeCssValue`). Vendor-prefixed properties were not on that list, so:

```ts
css({ WebkitLineClamp: 2 })
// emitted -webkit-line-clamp: 2px
```

`2px` is invalid for `-webkit-line-clamp`; the browser dropped it silently. The
clamp never applied, long text grew unbounded, and
`getComputedStyle(el).webkitLineClamp` was `none`.

## Current behavior (build `57ecca4cba`, #12121)

- Numeric values stay unitless wherever the grammar accepts a bare number,
  including vendor-prefixed forms (`WebkitLineClamp: 2` → `-webkit-line-clamp: 2`).
- Vendor-prefixed camelCase keys get their leading dash (`webkitLineClamp` →
  `-webkit-line-clamp`, `msFlex` → `-ms-flex`).
- Custom property names keep their casing (`'--gapSize'` stays `--gapSize`).
- `NaN`/`Infinity` values are dropped instead of rendering `NaNpx`.
- Strings still work, and are required for unit-bearing values such as
  `'200ms'` and `'45deg'`.

## New trap: `flex: 1` in an auto-height fill chain

`flex: <number>` now emits the real shorthand, so `flex: 1` is `1 1 0%`
(basis **0%**) instead of the old `1 1 1px`. In a container whose height is
auto (`min-height: 100vh`, not `height`), a percentage basis resolves to
**content**, so a `shell > main > page` fill chain grows with its content
instead of staying viewport-bounded. Symptoms are the mirror of a collapse:
the page scroller reports `scrollHeight - clientHeight === 0`, inner grids stop
scrolling, and mobile "the page should scroll" e2e guards fail.

Use a **definite** zero basis for viewport-fill chains:

```ts
flex: '1 1 0' // basis 0 (length), not `flex: 1` (basis 0%)
```

Keep `flex: '1 1 auto'` for content-sized columns (`dataGridFill`,
content-sized panels) where the basis must follow content. The admin shell
(`app/ui/layout.tsx` `shellCss`/`mainStyle`/`pageStyle`) uses `1 1 0` for this
reason; see `bounded-scroll-flexchain.md` and `full-height-sidebar-shell.md`.

## Solution

- On the current pin, numeric vendor-prefixed unitless values are safe; do not
  add string workarounds for `WebkitLineClamp` any more (existing strings are
  harmless).
- Prefer CSS strings when the intent is unit-bearing; numbers select the
  unitless branch, which can change meaning for shorthands (`flex`,
  `animation`, `borderImage`).
- Verify with `getComputedStyle` or the generated rule; a clamp that does
  nothing, or a scroller that reports zero overflow, is the common symptom.

## When to Use

- A `css()` line clamp or another vendor-prefixed property silently has no
  effect (pre-#12121 builds).
- A viewport-bounded page suddenly stops scrolling after a remix bump.
- You are about to write `flex: 1` in a layout chain whose ancestors have auto
  height.
- Reviewing a `css()` block where a numeric value is sent to a property that
  expects a unitless number.
