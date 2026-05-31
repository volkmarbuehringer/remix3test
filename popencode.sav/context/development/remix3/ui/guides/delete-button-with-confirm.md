<!-- Context: development/remix3/ui/guides | Priority: medium | Version: 1.0 | Updated: 2026-05-13 -->

# Guide: Delete Button with Confirmation Inside a Frame

**Purpose**: Render a delete button inside a Frame-based grid that shows a browser confirmation dialog and preserves grid state after deletion.

## Problem

Standard HTML forms inside Frames cannot use `confirm()`:
- The server-rendered grid component is isomorphic/server-only — no access to `window.confirm`
- A plain `<form>` with `method="POST"` would submit directly without asking
- Using `<form onsubmit="return confirm(...)">` doesn't work because hydration only attaches client behavior to `clientEntry` components

## Pattern: clientEntry + fetch + frame.reload()

Use `clientEntry` to attach client-side behavior: intercept the form submit, show `confirm()`, POST via `fetch()` with `redirect: 'manual'`, then reload the frame.

```tsx
import { clientEntry, on } from 'remix/ui'
import type { Handle } from 'remix/ui'

type DelButtonProps = {
  action: string
  rowId: string | number
  offset: number
  sort: string
  order: string
  filterValue: string
}

export const DelButton = clientEntry(
  import.meta.url,
  function DelButton(handle: Handle<DelButtonProps>) {
    return () => {
      let { action, rowId, offset, sort, order, filterValue } = handle.props
      return (
        <form method="POST" action={action}
          mix={on('submit', async (event, signal) => {
            event.preventDefault()
            if (!confirm('Delete this row?')) return             // ← confirmation
            let formData = new FormData(event.currentTarget)
            await fetch(action, {
              method: 'POST', body: formData,
              redirect: 'manual', signal,                        // ← don't follow redirect
            })
            await handle.frame?.reload()                         // ← reload grid
          })}
        >
          <input type="hidden" name="rowId" value={rowId} />
          <input type="hidden" name="_offset" value={offset} />
          <input type="hidden" name="_sort" value={sort} />
          <input type="hidden" name="_order" value={order} />
          <input type="hidden" name="_filter" value={filterValue} />
          <Button type="submit" tone="danger">Del</Button>
        </form>
      )
    }
  },
)
```

## How It Works

| Step | What Happens |
|------|-------------|
| User clicks Del | `on('submit', ...)` fires, `event.preventDefault()` stops native form submission |
| Confirmation | `confirm('Delete this row?')` — if cancelled, return early |
| HTTP request | `fetch(action, { method: 'POST', body: formData, redirect: 'manual' })` |
| Server response | Server deletes row and returns `302` to `/client?offset=...` — `redirect: 'manual'` makes fetch return the redirect as a response, NOT follow it |
| Frame reload | `handle.frame?.reload()` re-fetches the grid fragment with current state params |

## Grid State Preservation

Hidden fields carry the user's current view state to the server so the redirect URL preserves their page:

- `_offset` — current page offset
- `_sort`, `_order` — current sort column/direction
- `_filter` — current search filter

The server uses these to build the `302 Location` header.

## Key Constraints

- Must use `redirect: 'manual'` — without it, fetch follows the 302 and the response is the HTML of the full page, not a Frame fragment
- Must use `handle.frame?.reload()` — this reloads the Frame's fragment URL, keeping the grid inside the parent page context
- Serialized props (`action`, `rowId`, offset/sort/order/filter) must be `SerializableProps` compatible

## Reference

- `assets/client-del-button.tsx` — DelButton implementation
- `controllers/client/controller.tsx` — destroy() handler returning 302 redirect
- `concepts/frame-vs-client-entry.md` — Frame vs clientEntry decision matrix
- `guides/cart-button-local-state.md` — Related clientEntry pattern with fetch + frame.reload()
