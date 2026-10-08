# Deduplicating Similar clientEntries with a Shared Factory

**Source:** `remix3-client-entry-factory-extraction`

**Extracted:** 2026-10-08
**Context:** Seven admin/client grid row context menus were 116–163 near-identical
lines each. Extracting the shared machinery into one factory
(`app/ui/row-context-menu.tsx`) collapsed them to 45–66-line configs — 7×~150
lines to 7 configs + a 207-line factory — with entry IDs and all tests unchanged.

## Problem

N `clientEntry`s repeat the same entry body: hidden trigger, delegated listener,
menu shell, select dispatch — differing only in table selector, label, items, and
actions. The obvious move (one shared module exporting one `clientEntry`) fails,
because a `clientEntry`'s hydration target comes from its **entry id**, not the
component function.

## Solution

`clientEntry(entryId, component)` is a pure tagging function — it sets
`component.$entry = true` / `$entryId = entryId` and returns the same function
(installed `@remix-run/component` 1.0.0,
`src/runtime/client-entries.ts:101-118`). At render the server resolves the id:
`resolveDefaultClientEntry` splits on the last `#` into `{ exportName, href }`,
and the browser imports `href` and looks up `exportName`
(`src/server/stream.ts:1079-1105`). Function identity is never compared.

Build the shared **component factory**, but keep `clientEntry(...)` at each call site:

```tsx
// app/ui/row-context-menu.tsx — shared, under an allowFiles path
export function createRowContextMenu(options: RowContextMenuOptions) {
  return function RowContextMenu(handle: Handle) {
    let target: RowMenuTarget | null = null
    return () => (
      <menu.Context label={options.label}>
        <div mix={[menu.contextTrigger(), ref((el) => { /* delegate, position, dispatch */ })]} />
        <MenuList mix={onMenuSelect((event) => {
          let captured = target
          if (!captured || !captured.rowId) return
          options.onSelect(event.item.name, captured, handle)
        })}>
          {options.items(target)}
        </MenuList>
      </menu.Context>
    )
  }
}

// app/actions/admin/public/admin-offerings-context-menu.tsx — thin call site
export const AdminOfferingsContextMenu = clientEntry(
  import.meta.url + '#AdminOfferingsContextMenu',
  createRowContextMenu({ label: 'Angebotsaktionen', tableSelector: '[data-offerings-table]', items, onSelect }),
)
```

**Why `clientEntry` stays at the call site:** `import.meta.url` must be the
*caller* module's URL, and that module must export the named binding the client
imports. If the factory called `clientEntry(import.meta.url + '#X', …)` itself,
`href` would be the shared module and `#X` would not exist there. The returned
function may be anonymous — the explicit `#ExportName` is what resolves.

**Factory prerequisites**
- The shared module must be browser-importable: it must match `remix.json`
  `assets.allowFiles` (`app/ui/**`, `app/utils/**`, or a route `public/**` here).
- Pass options; never read caller state. Keep the per-row capture in the factory
  closure, exposed to `items`/`onSelect` as a typed target.

**Behavior-preservation details that bit during the collapse**
- Keep the exact select guard: `if (!captured || !captured.rowId) return`.
- Re-render after capture **only when rendered items depend on the captured row**
  (a `reactive` flag). An unconditional `handle.update()` makes the non-reactive
  menus' direct-render browser tests render outside `act()`.
- Preserve per-menu variant semantics: one menu looked up the delete form
  *before* reading its `data-confirm` and confirming (no form → no prompt); the
  others confirmed first. One generic helper silently changes that — keep two.

## The verification trap

`remix/component/test`'s `render(<Entry />)` imports the module and renders the
component directly. It proves the body works; it does **not** exercise
`clientEntry` hydration (import by `href`, named-export lookup, listener attach).
A factory that broke the entry id/hydration path still passes every direct-render
browser test. Add an e2e that waits for a hydration marker the factory sets in
its `ref` callback, then interacts:

```tsx
// factory ref callback, after addEventListener
el.dataset.rowContextMenuReady = 'true'

// e2e
await page.locator('[data-row-context-menu-ready]').waitFor({ state: 'attached' }) // trigger is invisible
await row.click({ button: 'right' })
```

`state: 'attached'`, not `'visible'` — the trigger is intentionally `opacity: 0`.
See `remix3-frame-cliententry` → `references/cliententry-lifecycle.md`
(wait for the hydration marker, not the markup).

## When to Use
- Two or more `clientEntry`s share the same entry body and differ only in config.
- You are about to move a `clientEntry(...)` call out of its file into a shared module.
- A refactor touches entry IDs, `import.meta.url + '#Name'`, or an entry's export module.

## Related Skills
- `remix3-client-entries` → `references/client-entry-decomposition.md` — the inverse: splitting one oversized entry.
- `remix3-frame-cliententry` → `references/cliententry-lifecycle.md` — hydration timing + the marker rule.
- `typescript-gotchas` → `references/repeated-block-collapse-refactor.md` — collapsing repeated fragments, not whole bodies.
