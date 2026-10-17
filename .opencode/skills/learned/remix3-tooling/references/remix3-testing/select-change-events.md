# Native `<select>` change events are unreliable in this e2e suite

## What This Covers

Driving a remix-ui `on('change')` handler on a native `<select>` from Playwright.
Read this when an e2e interaction on a select (sort control, picker, filter)
"does nothing" — no DOM change, no undo chip, no network request — and the
following assertions fail with no obvious cause.

## The delta

- `page.selectOption('<select>', value)` fires the remix `on('change')` handler
  in **Chromium** but **not in Firefox** — a synthetic change on a native select
  never reaches the handler there (same family as the documented
  `fill()`/`on('input')` gap and the hover-reveal pointer-event unreliability).
- A synthetic `sel.dispatchEvent(new Event('change', { bubbles: true }))` after
  `sel.value = 'az'` does **not** reach the handler in Chromium either — a raw
  `addEventListener('change')` on the same element fires, the remix mixin
  handler does not. The `on()` mixin attaches via plain `addEventListener`
  (no `isTrusted` gate), so do not assume the two are equivalent on selects.
- The identical synthetic `change` dispatch **does** reach handlers on
  `<input type="checkbox">` (the row-selection tests rely on it). Host element
  type matters.
- Keyboard ArrowDown / typeahead on a focused closed dropdown works in Chromium
  only; Firefox ignores both via Playwright.

## Solution

1. Drive native selects with `page.selectOption` (works in Chromium).
2. **Retry the interaction until the DOM reflects the change** — the change
   listener is attached by the client entry's render pass, so a `selectOption`
   landing in the hydration gap is a silent no-op. Same retry pattern as
   `selectItems` in the lists e2e files.
3. Scope the mutation assertions to Chromium with `isFirefox(page)`: keep a
   smoke check (the control still renders) and `return`, matching the suite's
   existing Firefox pattern.

## When to Use

- An e2e test must change a native `<select>` owned by a remix client entry.
- `selectOption` / a dispatched change appears to do nothing and assertions on
  the reorder / picked value / network fail with the DOM unchanged.