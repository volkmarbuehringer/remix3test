<!-- Context: project-intelligence/my_app/guides/admin-action-button-pattern | Priority: high | Version: 1.0 | Updated: 2026-05-07 -->

# Guide: AdminActionButton Pattern (my_app)

**Purpose**: Document the `AdminActionButton` clientEntry component used across admin routes in my_app for one-click actions (delete, ban, promote, etc.) with frame-targeted refresh.

## Overview

The `AdminActionButton` is a reusable `clientEntry()` component that:
- Renders a `<button>` with single-event `mix={on('click', handler)}` (no array wrapper)
- Performs `fetch(url, { method, body: formData, redirect: 'manual' })` on click
- Calls `await handle.frame.reload()` to refresh the admin content frame
- Manages pending state via closure variable + `handle.update()`
- Shows `confirm()` dialog for destructive operations
- Uses `import.meta.url` as the module URL for the client entry

## Source Location

**Component**: `my_app/app/assets/admin-action-button.tsx`
**Controllers using it**: Various admin list controllers

## Implementation

```typescript
// my_app/app/assets/admin-action-button.tsx
import { clientEntry, on } from 'remix/ui'
import type { SerializableProps } from 'remix/ui'

type AdminActionProps = SerializableProps & {
  actionUrl: string
  method: string
  confirmMsg?: string
  pendingLabel?: string
  label: string
}

export const AdminActionButton = clientEntry(
  import.meta.url,
  (handle) => {
    let pending = false

    return (props: AdminActionProps) => {
      let { actionUrl, method, confirmMsg, pendingLabel, label } = props

      return (
        <button
          type="button"
          mix={on('click', async () => {
            // Confirmation for destructive actions
            if (confirmMsg && !confirm(confirmMsg)) return

            // Show pending state
            pending = true
            handle.update()

            let formData = new FormData()
            let res = await fetch(actionUrl, {
              method,
              body: formData,
              redirect: 'manual',
            })

            pending = false
            handle.update()

            // Refresh the admin frame
            if (res.ok || res.status === 204) {
              await handle.frame.reload()
            }
          })}
          disabled={pending}
        >
          {pending ? (pendingLabel ?? label) : label}
        </button>
      )
    }
  }
)
```

## Usage in Admin Controllers

### Fragment controller serving the button:

```typescript
// my_app/app/controllers/admin/fragments/admin-action-button/controller.tsx
import { AdminActionButton } from '../../assets/admin-action-button.tsx'

async content({ params, url }) {
  let { itemId } = params
  let item = await db.items.findUnique({ where: { id: itemId } })
  if (!item) return new Response('Not found', { status: 404 })

  return (
    <AdminActionButton
      actionUrl={routes.admin.items.delete.href({ id: itemId })}
      method="DELETE"
      confirmMsg={`Delete "${item.name}"?`}
      label="Delete"
      pendingLabel="Deleting..."
    />
  )
}
```

### Integration in admin list pages via Frame:

```tsx
// In an admin list page rendering
<Frame
  name={`action-${item.id}`}
  src={routes.fragments.adminActionButton.href({
    itemId: item.id,
    actionUrl: routes.admin.items.delete.href({ id: item.id }),
    method: 'DELETE',
    confirmMsg: `Delete "${item.name}"?`,
    label: 'Delete',
  })}
/>
```

## Server Action Endpoint

The server action receives the request and returns a success/redirect:

```typescript
// Action handler
async delete({ params, db }) {
  await db.items.delete({ where: { id: params.id } })
  // Return 204 — the clientEntry handles frame reload
  return new Response(null, { status: 204 })
}
```

Return `204 No Content` (or any `2xx`) to signal success. The clientEntry checks `res.ok || res.status === 204` before calling `handle.frame.reload()`.

## Asset Server Configuration

The asset server's `allow` list must include the client entry file path:

```typescript
// my_app/app/server.ts or asset config
allow: [
  '/assets/admin-action-button-*.js',
  // ...
]
```

## mix Pattern: Single Event, No Array Wrapper

The `mix={on('click', handler)}` pattern (single mixin without array) is critical. Wrapping in an array `mix={[on('click', handler)]}` would create a new array reference on every render, triggering an infinite `handle.update()` loop.

## State Flow

```
User clicks button
  → pending = true, handle.update() → button shows "Deleting..."
  → fetch(deleteUrl, { method: 'DELETE', redirect: 'manual' })
  → response 204 (success) or error
  → pending = false, handle.update() → button restores label
  → handle.frame.reload() → admin content refreshed with updated data
```

## Differences from Cart Button (bookstore)

| Aspect | Cart Button | AdminActionButton |
|--------|-------------|-------------------|
| Refresh | `window.location.reload()` | `handle.frame.reload()` |
| Redirect mode | `redirect: 'none'` | `redirect: 'manual'` |
| Pending state | No | Yes |
| Confirmation | No | Yes (optional) |
| Frame targeting | Full page reload | Frame-scoped reload |
| Props | Inline props | Extends `SerializableProps` |

## Related

- `development/remix3/guides/admin-action-buttons.md` — General pattern (this is the my_app specialization)
- `development/remix3/guides/frame-navigation-patterns.md` — Frame reload mechanics
- `development/remix3/errors/mix-array-event-only.md` — Why `mix={on(...)}` not `mix={[on(...)]}`
- `development/remix3/errors/client-entry-loops.md` — Avoiding infinite loop pitfalls
- `development/remix3/ui/examples/cart-button-pattern.md` — Inspiring example from bookstore demo
- `development/remix3/guides/admin-params-pattern.md` — Admin URL param handling
- `ui-component-patterns.md` — Other my_app UI components

## Codebase References

- `my_app/app/assets/admin-action-button.tsx` — Component source
- `my_app/app/controllers/admin/fragments/admin-action-button/controller.tsx` — Fragment controller
- `my_app/app/controllers/admin/lists/controller.tsx` — Usage in admin lists
- `my_app/app/controllers/admin/chatlog/controller.tsx` — Usage in admin chatlog
- `my_app/app/routes.ts` — Route definitions including fragment routes
