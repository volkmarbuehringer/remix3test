# Author `display` in `css()` Beats `[hidden]`

**Source:** `remix3-hidden-attribute-display-override`

**Extracted:** 2026-09-15
**Context:** Remix 3 (`remix/ui` `css()` mixins) components that show/hide an element by toggling the native `hidden` attribute from a `clientEntry` or an event handler.

## Problem

The native `hidden` attribute is hidden only by the **user-agent** stylesheet rule `[hidden] { display: none }`.
An author rule that sets `display` (`inline-flex`, `flex`, `block`, …) wins the origin cascade, so the UA rule
never applies and the element stays visible.

`remix/ui`'s `css()` emits an author class rule, so any host whose descriptor sets `display` becomes immune
to `hidden`:

```ts
export const clearSelectionBtnCss = css({
  display: 'inline-flex', // author rule — beats the UA [hidden] rule
  // ...
})
```

```ts
clearBtn.hidden = n === 0 // no visual effect — the button stays visible
clearBtn.toggleAttribute('hidden', n === 0) // same
```

Symptom: a control shows when it should be hidden — a "clear selection" button visible with nothing
selected, an empty pending/validation banner reserving a flex line, a helper box that never collapses. It is
tempting to "fix" it by setting `style.display = 'none'` in JS, which then drifts from the attribute contract.

## Solution

Add a nested `[hidden]` guard to the same `css()` descriptor. It compiles to `.class[hidden]`, which
out-specifies the bare `.class` rule (same cascade layer):

```ts
export const clearSelectionBtnCss = css({
  display: 'inline-flex',
  // ...
  '&[hidden]': { display: 'none' },
})
```

The repo applies this guard to every element it toggles via `hidden` in
`app/actions/admin/uploads/uploads-grid-css.ts` (`pendingListCss`, `validationErrorCss`,
`clearSelectionBtnCss`).

Consistent alternatives:
- Toggle a `data-*` attribute and style `&[data-x='true'] { display: none }`.
- Conditionally render the element server-side instead of toggling `hidden`.
- If a `clientEntry` must hide it, keep toggling the attribute and the CSS guard — not `style.display`.

If the `display` comes from a *different* composed mixin/layer rather than this descriptor, also read
`remix3-css-and-layout` → `references/cascade-layer-overrides.md` before choosing `!important`.

## When to Use

- A `hidden` / `toggleAttribute('hidden', …)` toggle has no visible effect.
- The element's `css()` descriptor (or an upstream mixin it composes) sets `display`.
- A previously working `hidden`-based show/hide "stops working" after `display` is added to the style.
- Reviewing a `css()` descriptor that sets `display` on an element the JS toggles with `hidden`.
