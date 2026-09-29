---
name: remix3-client-entry-decomposition
description: "Use when a Remix 3 `clientEntry` / `.browser.tsx` file grows past ~1,000 lines and must be split without behavior change — extract pure styles/state/API/drag modules, then split controller from view with a typed view model of setter and ref callbacks."
metadata:
  origin: auto-extracted
---

# Decomposing a Large Remix 3 clientEntry

**Extracted:** 2026-09-29
**Context:** `app/actions/lists/public/lists-client.tsx` reached 3,523 lines — one closure, ~95 nested functions, a ~1,100-line JSX return. Split into `lists-styles.ts`, `lists-state.ts`, `lists-api.ts`, `lists-drag.ts`, and `lists-view.tsx` (client 3,523 → 1,321) with zero behavior change, verified by typecheck + 148 unit + 22 e2e tests.

## Problem

A single `clientEntry` closure holds state, DOM wiring, network calls, styles, and JSX together:

- No logic is unit-testable; only browser e2e can reach it.
- Every edit risks the whole feature.
- Styles and helpers drown the state machine.

## Solution

Extract in this order, keeping the tree green after each step:

1. **Styles → `*-styles.ts`.** Module-level `export const xStyle = css({…})` (plus style-only functions like badge helpers). `css()` is pure, so this is behavior-neutral and pure line reduction.
2. **Pure state → `*-state.ts`.** Types plus operations returning new arrays — `sortItems`, `toggleDoneAt`, `clearDoneItems`, `removeItemsByIds`, `editItemFields`, `itemsFingerprint`, `filterItems` — with a unit test. Closure methods collapse to one-liners (`items = toggleDoneAt(items, index, Date.now())`).
3. **Network → `*-api.ts`.** One function per endpoint returning a discriminated outcome (`{ status: 'ok' | 'conflict' | 'not_found' | 'bad_request' | 'error'; network: boolean }`). Carry a `network` flag so the exact user-facing error strings (`… (Netzwerkfehler)`) survive; the closure only maps outcomes to state.
4. **Cohesive DOM subsystem → `*-drag.ts`.** A `createX(ctx)` factory that owns its transient state and listeners and reaches app state through a small context of getters + effect callbacks (`commitReorder`, `setLoadError`, `showConflict`, `reloadFrame`, `update`) + `signal`. Guard `if (typeof document !== 'undefined')` before listeners — the factory body runs during SSR too.
5. **Render → `*-view.tsx`.** `export function renderX(view: XView)` plus the `XView` type. The closure keeps one `buildView()`, and ends with `return () => renderX(buildView())`.

## The view-model rule (the part that bites)

- You **cannot** keep reads via destructuring and writes via assignment. `let { title } = view` copies a primitive; `title = e.currentTarget.value` then writes the local, not the closure. Convert **every** inline mutation to a setter callback that performs the original write:
  `on('input', (e) => view.setTitle(e.currentTarget.value))` where `setTitle = (v) => { title = v; setDirty(); handle.update() }`.
- Ref callbacks that wrote closure vars (`ref((el) => { titleInputRef = el })`) become hooks: `ref((el) => view.onTitleInputRef(el))`.
- A helper that needs a ref for DOM work stays in the closure as one callback: `clearListFilter()` clears `listFilter` *and* `filterInputRef.value`. Don't split it across the boundary.
- State read-only in the view (e.g. `loadingList`) can be checked as `view.loadingList` in the early returns.

## Safety rules for the mechanical move

- **Never extract a block by line offset after any prior edit.** Line numbers shift; an offset slice deletes the wrong lines. Anchor on unique content instead: read the file, `indexOf` a start and end marker, `slice` that string, and use it as the `old_string`. (This session corrupted a 2.8k-line file exactly this way and required `git checkout` + redoing the work.)
- **Re-read after every write.** A `git checkout` or `oxfmt --write` invalidates read tracking; the edit tool then refuses with `file changed since it was read`.
- **A ~25k-char single `edit` may be rejected.** Compute the whole new file from the verified slice and use `write` instead.
- **Static imports need the exact extension.** `import { renderX } from './x.tsx'` — TypeScript resolves `'./x.ts'`, but the Node/remix runtime throws `Cannot find module '…/x.ts' imported from …` at load. Match the source extension (`.ts`, `.tsx`).

## Verification

Stage it; run `tsc --noEmit` + lint + the existing unit suites + the browser e2e after each module. The e2e is what catches a construction-time throw in the new factory/view, since it hydrates the real entry.

## When to Use

- A `clientEntry` / `.browser.tsx` file is >~1,000 lines and mixes state, DOM, network, styles, and JSX.
- You need unit-testable logic out of a closure that only browser tests could reach.
- A "mechanical" block move must not change behavior.

## Related Skills

- `remix3-client-entries` — the clientEntry runtime/DOM behaviors this code hosts
- `remix-controllers` (`references/controller-consolidation.md`) — the server-controller analogue (extract UI to `pages.tsx`)
- `typescript-gotchas` (`references/repeated-block-collapse-refactor.md`) — the many-call-site collapse refactor
- `remix3-css-and-layout` — `css()` mixin constraints (never emits parent→child reveal selectors)
