# Persistent Live Regions for Swapped Status Messages

**Extracted:** 2026-11-17
**Context:** Remix 3 frame apps (and any partial-swap UI): a one-shot success/status message is rendered into swapped content, and the visual banner alone does not announce it. App applications: `app/ui/flash-announcer.browser.tsx` (PRG flash) and `app/ui/grid-status-announcer.browser.tsx` (grid footer).

## Problem

A `role="status"` live region created *together with its content* by a frame swap is a brand-new live region; screen readers do not announce its initial content. Adding `aria-live` to the swapped banner therefore does not fix success messages. `role="alert"` is announced on insertion, so errors can use it; using `alert` for success is too intrusive and double-announces with a persistent region.

## Solution

1. **Persistent region in the document shell**, outside every frame: `[data-flash-status]` with `role="status" aria-live="polite" aria-atomic="true"` (`app/ui/document.tsx`). `GridStatusAnnouncer` does the same for the grid footer from `app/ui/layout.tsx`.
2. **A client entry mirrors text into it.** The initial scan after hydration catches a server-rendered message (PRG document load); a filtered `MutationObserver` catches frame swaps and text changes. Skip error messages — they own `role="alert"`.
3. **The visual success banner has no live role**; the persistent region is the announcement. Errors use `role="alert"` on the banner.
4. **Scope the observer to the swap container** (`[data-page-scroller]` here), not `document.body`: chat tokens and typing otherwise run the filter on every mutation. The initial scan covers chrome outside the scroller.
5. **Dedupe per element + text** (`WeakMap<Element, string>`): a repeated message in a new node should announce; a reused node with unchanged text should not.
6. **No-JS:** the region is never filled; success is visible but not announced (page load is the only cue). Errors still use `role="alert"`.

SSR is safe: the entry's setup runs in `handle.queueTask`, a no-op during SSR; the region div renders statically.

## Testing

- **Browser test (direct render)** with a fixture swap container: initial server-rendered message, swap insertion, text change, error skip, and an unrelated mutation inside the container. See `app/ui/flash-announcer.test.browser.tsx`.
- **One e2e for hydration + the real swap**: direct render bypasses `clientEntry` marker resolution, so it cannot prove the entry hydrates. Drive a real in-frame PRG and assert the region text; see `app/actions/settings/settings-flash-announcement.test.e2e.ts` (page-size form → `[data-flash-status]`).
- **Server test** pins the markers (`data-flash-*`) and `role="alert"`; see `app/ui/layout.test.ts`.

## App Applications

- `app/ui/flash-announcer.browser.tsx` + `app/ui/document.tsx` — PRG flash. Canonical flash ownership/vocabulary details: `references/remix3-frame-cliententry/session-flash-frames.md` §1c.
- `app/ui/grid-status-announcer.browser.tsx` + `app/ui/layout.tsx` — grid footer summary.

## When to Use

- A success/status message is visible after a frame swap but a screen reader does not announce it.
- Adding a live-region announcer `clientEntry` (persistent status, toast, save result) in a frame/partial-swap app.
- A new announcer's browser test passes but the real page never announces: add the hydration e2e and scope the observer.
