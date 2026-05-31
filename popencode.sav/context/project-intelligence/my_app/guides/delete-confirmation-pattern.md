<!-- Context: project-intelligence/my_app/guides | Priority: high | Version: 1.1 | Updated: 2026-05-05 -->

# Guide: Delete Confirmation Pattern for Paginated Grids

**Purpose**: Document the working delete-with-confirmation pattern used in the `/client` route. This pattern solves the problem of providing confirmation dialogs in paginated grids where DOM is replaced via `innerHTML`, breaking Frame-based and Navigation API approaches.

## Anti-Patterns (What Failed)

Three approaches were attempted before landing on event delegation. None survived pagination's `innerHTML` replacement:

| Approach | Failure Mode |
|----------|-------------|
| **`<a rmx-target>` links** | After `innerHTML` swap, re-injected `<a>` elements lose Frame intercept wiring — `startNavigationListener` never fires |
| **`window.navigation.navigate()`** | `event.destination.getState()` doesn't return `$rmx` state on programmatic navigation; URL changes but Frame doesn't reload |
| **`navigate(href, { target })` with `history: 'replace'`** | First call works, subsequent calls ignored — Navigation API `replace` behavior clashes with repeated `event.intercept()` |

**Root cause**: Pagination replaces grid content by setting `container.innerHTML = newContent.innerHTML`. This destroys any element-level event listeners and Frame intercept bindings. Only `document`-level delegation survives.

See [Frame Rendering Gotchas](../errors/frame-rendering-gotchas.md) for the full investigation.

## Working Pattern: Three Pieces

### 1. Delete Button in Server-Rendered Template

The button uses `type="button"` (not `type="submit"`) and carries row/state metadata as `data-*` attributes:

```tsx
// my_app/app/actions/client/grid-page.tsx
<Button
  tone="danger"
  data-delete="true"
  data-confirm={`Delete row #${row.id}?`}
  data-row-id={row.id}
  data-offset={offset}
  data-sort={sortField || ''}
  data-order={sortOrder || 'asc'}
>
  Del
</Button>
```

The `data-offset`, `data-sort`, and `data-order` attributes carry the current page/sort state so the grid can be refreshed at the same position after deletion.

### 2. Delete Handler with Event Delegation

Registered once in the `clientEntry`, uses `document.addEventListener` + `closest()` to detect clicks on delete buttons regardless of DOM state:

```ts
// my_app/app/assets/grid-client.ts (lines 352–373)
document.addEventListener('click', (e) => {
  let btn = (e.target as HTMLElement).closest(
    '[data-delete]',
  ) as HTMLElement | null
  if (!btn) return

  let rowId = btn.getAttribute('data-row-id')
  let offset = btn.getAttribute('data-offset') || '0'
  let sort = btn.getAttribute('data-sort') || ''
  let order = btn.getAttribute('data-order') || 'asc'
  if (!rowId) return

  // Browser-native confirmation dialog
  if (!confirm(`Delete row #${rowId}?`)) return

  fetch(`/client/destroy/${rowId}`, {
    method: 'POST',
    credentials: 'same-origin',
  })
    .then((r) => r.json())
    .then((data: { ok: boolean }) => {
      if (data.ok) fetchPage(Number(offset), sort || undefined, order || undefined)
    })
    .catch((err) => console.error('[ClientLab] Delete failed:', err))
})
```

This handler also guards against accidental triggering when clicking rows for edit-panel navigation (see `[data-row-click]` handler at line 323, which skips `[data-delete]` clicks).

### 3. Server-Side Destroy Action

Validates input, deletes from database, returns JSON:

```ts
// my_app/app/actions/client/controller.tsx (lines 185–193)
async destroy({ params }) {
  let db = getContext().get(Database)
  let rowId = Number(params.rowId)
  if (!Number.isFinite(rowId) || rowId < 1) {
    return Response.json({ ok: false, error: 'Invalid rowId' }, { status: 400 })
  }
  await db.delete(clients, rowId)
  return Response.json({ ok: true })
}
```

**Route definition**: `my_app/app/routes.ts` line 56 — `destroy: post('/destroy/:rowId')`

## Why This Works

- **Event delegation on `document`**: The listener is attached once to `document`, never destroyed by `innerHTML` swaps. Clicks on re-injected buttons still bubble to the same handler.
- **`type="button"`**: Prevents accidental form submission. The button is purely a click target, not a form control.
- **Browser-native `confirm()`**: No framework dependency. Works in any DOM state because it's a native browser API, not a Remix navigation primitive.
- **`fetch()` for the action POST**: Uses the same fetch pattern already established for pagination (`fetchPage`) and inline edits (`saveCell`). Consistent with the rest of the clientEntry.
- **Server validates independently**: The destroy action validates `rowId` server-side regardless of what the client sends — defense in depth.
- **Grid refresh preserves state**: On success, `fetchPage(offset, sort, order)` re-fetches the current page from the server, so the grid reflects the true state immediately.

## Codebase References

- **Delete button template**: `my_app/app/actions/client/grid-page.tsx` (lines 474–484)
- **Delete handler (clientEntry)**: `my_app/app/assets/grid-client.ts` (lines 352–373)
- **Row-click guard**: `my_app/app/assets/grid-client.ts` (line 323) — skips `[data-delete]` clicks
- **Destroy action**: `my_app/app/actions/client/controller.tsx` (lines 185–193)
- **Route definition**: `my_app/app/routes.ts` (line 56)
- **Delete button style**: `my_app/app/actions/client/grid-page.tsx` (lines 177–193, `deleteBtnStyle`)

## Related

- [Client Pagination & Sort](./client-pagination-sort.md) — `fetchPage()` mechanism
- [Inline Editing Patterns](./inline-editing-patterns.md) — Event delegation architecture
- [Client Route Layout](./client-route-layout.md) — Why Frame/navigation approaches fail
- [Frame Rendering Gotchas](../errors/frame-rendering-gotchas.md) — Detailed anti-pattern explanations
