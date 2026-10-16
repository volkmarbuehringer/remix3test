# Browser-only behavior mixin: per-element `ref()` wiring → delegated `createMixin(type, { ssr: false })`

**Source:** session 2026-10-16 (lists drag-and-drop extraction, item #4 of the
interactivity track). Commit `868aa6c`. Verified against remix build
`7f900151` (`@remix-run/component` 1.0.0, where #12019 "browser-only mixins"
landed the `MixinOptions` argument — see `remix3-build-and-tooling` →
`references/upstream-dependency-analysis.md`).

**Context:** `app/actions/lists/public/lists-view.tsx` wired drag-and-drop with
two kinds of `ref()` mixins: per-row listeners (dragstart/dragover/drop/dragend
on every `[role="listitem"]`, each re-created on every render) and a container
`ref` mixing drag handlers with unrelated hover/focus wiring. The behavior
contributes no server HTML, which is exactly the browser-only-mixin shape.

## The pattern (`app/actions/lists/public/lists-drag-mixin.ts`)

- `createMixin(setup, { ssr: false })` skips server setup **and** render; the
  host keeps its own props, so SSR output is byte-identical. The per-row `ref()`
  wiring it replaces was already browser-only (`ref`/`on` are upstream
  `{ ssr: false }` mixins), so no server HTML changed. The app's own `css()`
  mixins (e.g. `app/ui/theme/upstream-button.ts`) do contribute server HTML and
  must **not** get `{ ssr: false }`.
- **Lifecycle wiring follows the vendor `on()` mixin** (`on-mixin.ts`): capture
  `let signal = handle.signal` during setup (valid there — setup runs inside the
  mixin slot's active scope), bind listeners on the `insert` event
  (`event.node`), and rebind when a *different* node is inserted (a replaced
  host takes its old listeners with it). Listener teardown is owned by the
  scope signal plus the `remove` event.
- **Stateful setup + per-render args:** the setup returns a runner that receives
  the factory args on every render. Create the controller/behavior once
  (`controller ??= createListsDrag(ctx)`) on the first runner call; later calls
  are no-ops for setup but must still return `handle.element` (preserve props).
  Document the contract: the client passes the **same stable context object**
  every render (built once in the component body, outside the render function).
- **Generics must be explicit:** TS fails to infer factory args from a variadic
  tuple inside the setup's returned runner — annotate
  `createMixin<HTMLElement, [ListsDragContext]>(...)` (omit trailing generics
  that equal their defaults, or oxlint `no-unnecessary-type-arguments` fires).
  Export `type ListsDragMixinDescriptor = ReturnType<typeof drag>` for the view
  model instead of restating the descriptor shape.

## Delegation changed the handler contract — `currentTarget` is the container

With per-element listeners, `e.currentTarget` was the row; handlers used it for
`draggedEl` and the drop-indicator midpoint rect. Under delegation,
`e.currentTarget` is the host container, so row-scoped handlers must **take the
row explicitly**: `handleDragStart(e, index, row)` /
`handleDragOver(e, index, row)`. Rows resolve via
`e.target.closest('[role="listitem"]')` and `row.dataset.index` (same
attributes the old per-row wiring read).

Phase semantics to preserve when converting container listeners:

- Edge auto-scroll stayed **capture-phase** on the container so it fires even
  while the pointer is over a row (rows' dragover handlers stop the bubble
  phase).
- The one delegated bubble-phase `dragover` branches: row under the pointer →
  row handler, else container handler. `handleDragOver`'s internal
  `stopPropagation()` no longer has anything to stop at the container, which is
  the same observable behavior as "row handler runs, container handler doesn't".
- Container `drop` fired after row `drop` before (second call was a no-op —
  drag state is nulled); one delegated listener keeps the once-effective path.
- Listeners registered on `document`/`window` inside the controller (sidebar
  drag wiring) are untouched — they already use the component `handle.signal`
  passed through the context.

## Test harness drives the production wiring

`wireListsDragHost(host, controller, signal)` is exported from the controller
module (`lists-drag.ts`) and used by both the mixin and
`lists-drag.test.browser.ts`. The browser test binds it to its fixture
container and dispatches native `DragEvent`s — rows need `role="listitem"` +
`data-index` in the fixture, and the intra-list reorder test dispatches
dragover/drop on the container itself (no `[role="listitem"]` under the
pointer → container branch). Tests that previously called handler methods
directly must not also attach their own row listeners — that would double-fire
through delegation.

Render-only tests (e.g. `lists-render-complexity.test.browser.tsx` builds JSX
without mounting) satisfy a descriptor field with the real factory:
`drag({} as ListsDragContext)` — the context is never invoked.
