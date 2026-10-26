# Input-Modality CSS and Reorder Focus in Playwright

**Extracted:** 2026-10-26
**Context:** `/lists` row action toolbar during ↑/↓ reorder. The duplicate-toolbar bug only appeared with a real pointer: a mouse click focused the arrow but did not match `:focus-visible`, while `:focus-within` kept the moved row's toolbar open next to the row that slid under the cursor. `render()` + programmatic `.click()` could not reproduce it.

## Problem

- **Component tests cannot fake pointer modality.** `.click()` does not set `:hover`, and `.focus()` keeps the last input modality. A control gated on `:focus-visible` behaves differently under a real mouse than under programmatic focus, and a `:focus-within`-based reveal can pass a component test while pinning two toolbars open in the browser.
- **Hover-revealed controls are not hittable at rest.** The cluster uses `opacity: 0; pointer-events: none`; Playwright's `action.hover()` fails until its row is hovered first.
- **The hydration gap swallows early clicks.** SSR CSS hover applies before hydration, but the click handler attaches with the deferred client entry. A click in that window is a silent no-op.
- **A reorder changes what is under a stationary pointer.** After the row moves, the cursor usually hovers a different row; focus may stay on the moved row's action. That combination is the bug, and it only exists in a real input session.
- **A transition hides the overlap.** A symmetric opacity crossfade leaves both clusters partially visible for ~120 ms, so a test that samples after a fixed timeout can miss it (or `isVisible()` can report both as visible because the cluster is laid out at opacity 0).

## Solution

### 1. Drive the real pointer path in an e2e test

```ts
let row = page.locator('[data-item-id="item-b"]')
let down = row.locator('[data-item-actions] button[aria-label="Nach unten"]')

// Retry through hydration: hover CSS is already live, the handler is not.
let deadline = Date.now() + 15_000
while (Date.now() < deadline) {
  await row.hover() // reveal the cluster (pointer-events: none at rest)
  await down.hover() // now the action is hittable
  await down.click()
  try {
    await page.waitForFunction(
      () => [...document.querySelectorAll('[data-item-id]')][2]?.dataset.itemId === 'item-b',
      undefined,
      { timeout: 800 },
    )
    break
  } catch {
    // hydration gap — retry
  }
}
```

- Seed equal-height rows (single-line labels) so the pointer's y-coordinate lands on the row that replaces the clicked one; otherwise a height difference moves the hover target and the test flakes.
- For keyboard behavior, switch modality with a real key before focusing/activating:

```ts
await page.mouse.move(5, 5) // no hover in the picture
await page.keyboard.press('Tab') // keyboard modality
await up.focus()
await page.keyboard.press('Enter')
```

### 2. Assert computed style + focus, and identify the row under the pointer

```ts
let state = await page.evaluate(() => {
  let rows = [...document.querySelectorAll('[data-item-id]')]
  return {
    visible: rows.flatMap((row) => {
      let cluster = row.querySelector('[data-item-actions]')
      if (!cluster) return []
      return Number(getComputedStyle(cluster).opacity) > 0.5 ? [row.dataset.itemId] : []
    }),
    active: document.activeElement?.closest('[data-item-id]')?.dataset.itemId ?? null,
    activeLabel: document.activeElement?.getAttribute('aria-label') ?? null,
    focusVisible: document.activeElement?.matches(':focus-visible') ?? null,
  }
})
assert.deepEqual(state.visible, ['the-row-under-the-pointer'])
assert.equal(state.active, 'the-moved-row')
assert.equal(state.focusVisible, false) // mouse-created focus (Chromium/Firefox)
```

- Use `opacity > 0.5`, not `isVisible()`: the cluster is `display: inline-flex` at opacity 0.
- `document.elementFromPoint(x, y)?.closest('[data-item-id]')` tells you which row the stationary cursor actually hovers after the move.
- For a transient crossfade, install a `requestAnimationFrame` sampler before the click and collect `{ t, opacity, top }` for ~500 ms; if the desired behavior is "never two visible", remove the transition and assert the settled state rather than tolerating the fade.

### 3. Prove the test catches the old behavior

Temporarily restore the old CSS/handler, run the single e2e file, and confirm the specific assertion fails. Restore the fix and run both configured browsers:

```sh
NODE_ENV=test npx remix test --type e2e <file> --concurrency 1 --project chromium
```

A regression test that only ever ran green is not evidence.

### 4. Don't infer focus from DOM identity after a keyed reorder

Keyed reconciliation may `insertBefore` the clicked row's node (the focused button is detached → `document.activeElement` falls to `<body>`) or move a sibling and leave the clicked row in place (focus survives). "Keyed by id" does not mean "focus survives". Assert `document.activeElement.closest('[data-item-id]')` and the action label; if focus must continue on the same control, restore it by id in a `handle.queueTask` after the update, with a row fallback when the control is disabled at the visible boundary.

## When to Use

- A hover/focus-revealed control (row toolbar, menu, tooltip) passes a component test but misbehaves with a real mouse.
- The bug or fix depends on `:hover`, `:focus-visible`, `:focus-within`, or pointer-vs-keyboard modality.
- A reorder/filter slides a row out from under a stationary pointer, or changes which row is hovered.
- A transition/crossfade makes an element look duplicated or flicker; you must assert exactly one visible instance.
- You add an e2e regression test and need proof that it fails on the pre-fix code.

## Related

- `remix3-styling` § CSS & Layout → `references/remix3-css-and-layout/hover-reveal.md` — the reveal CSS and `:focus-visible` gating this test protects.
- `remix3-ui` § Client Entries → `references/remix3-client-entries/roving-tabindex-keyboard-lists.md` — focus-by-id after a reorder.
- `references/remix3-testing/select-change-events.md`, `keystroke-loss-hydration-race.md` — hydration-gap retries and early-input loss in e2e.
- `references/remix3-testing/state-isolation-and-e2e-serve.md` — `t.serve` + seeded DB fixtures.
- `app/actions/lists/lists-row-toolbar.test.e2e.ts` — working exemplar.
