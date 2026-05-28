<!-- Context: development/remix3/guides/admin-action-buttons | Priority: high | Version: 1.0 | Updated: 2026-05-07 -->

# Guide: Admin Action Button Pattern (clientEntry + fetch + frame reload)

**Core Idea**: Reusable clientEntry component that performs admin actions via `fetch()` and refreshes the admin frame with `handle.frame.reload()` — avoiding full page navigation.

## Architecture

```
Admin page (Frame)
  └── <Frame src="/admin/lists"> with admin-content target
        └── AdminActionButton (clientEntry)
              └── click → fetch(url, { method, body, redirect: 'manual' })
                    └── on success → handle.frame.reload()
```

## Pattern Template

```typescript
// assets/admin-action-button.tsx
import { clientEntry, on } from 'remix/ui'
import type { Handle, SerializableProps } from 'remix/ui'

type AdminActionProps = SerializableProps & {
  actionUrl: string
  method: string
  confirmMsg?: string
  pendingLabel?: string
  label: string
}

const moduleUrl = import.meta.url

export const AdminActionButton = clientEntry(
  moduleUrl,
  (handle: Handle<AdminActionProps>) => {
    let pending = false

    return () => {
      let { actionUrl, method, confirmMsg, pendingLabel, label } = handle.props

      return (
        <button
          mix={on('click', async () => {
            if (confirmMsg && !confirm(confirmMsg)) return

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

## Key Techniques

### 1. `redirect: 'manual'` (not `'none'`)
Use `redirect: 'manual'` instead of `'none'` in the fetch options. This tells the browser to handle the redirect response without following it, allowing you to read the response status. The server action can still return a redirect if needed, but the fetch won't follow it — instead, the frame reload gets fresh content.

### 2. `handle.frame.reload()` — Frame-Targeted Refresh
After a successful action, call `await handle.frame.reload()` to refresh only the admin content frame. This preserves other parts of the admin layout (sidebar, header) and avoids a full page navigation.

```typescript
// After fetch success
if (res.ok || res.status === 204) {
  await handle.frame.reload()
}
```

### 3. Pending State with Closure Variable
Track the pending state with a module-level closure variable. Call `handle.update()` to re-render the button with the updated label/disabled state:

```typescript
let pending = false

return () => {
  // In render: use pending to toggle UI
  return <button disabled={pending}>{pending ? 'Working...' : label}</button>
}

// In handler:
pending = true
handle.update()
```

### 4. Confirmation Before Destructive Actions
Use `confirm()` for destructive operations. The pattern supports an optional `confirmMsg` prop:

```typescript
if (confirmMsg && !confirm(confirmMsg)) return
```

### 5. Props Extend `SerializableProps`
Always extend `SerializableProps` from `remix/ui` for client entry props to ensure they can be serialized across the wire:

```typescript
type AdminActionProps = SerializableProps & {
  actionUrl: string
  method: string
  // ...
}
```

### 6. Asset Server Allow List
The asset server's `allow` configuration must include the client entry file path. Add a rule matching the admin action button path:

```typescript
// asset-server config
allow: [
  '/assets/admin-action-button-*.js',
  // ...
]
```

## Comparison: Cart Button vs Admin Action Button

| Aspect | Cart Button | Admin Action Button |
|--------|-------------|-------------------|
| Page refresh | `window.location.reload()` | `handle.frame.reload()` |
| Redirect mode | `redirect: 'none'` | `redirect: 'manual'` |
| Frame refresh | No (full page) | Yes (frame-targeted) |
| Pending state | No | Yes (closure + update) |
| Confirmation | No | Yes (optional `confirmMsg`) |

## Server-Side Usage

```tsx
// In an admin list controller
import { Frame } from 'remix/ui'
import { routes } from 'app/routes.ts'

function AdminListPage({ items, page, hasMore, filter }) {
  return (
    <div id="admin-content">
      <table>
        {items.map(item => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td>
              <Frame
                name={`action-${item.id}`}
                src={routes.fragments.adminActionButton.href({
                  actionUrl: routes.admin.items.delete.href({ id: item.id }),
                  method: 'DELETE',
                  confirmMsg: `Delete "${item.name}"?`,
                  label: 'Delete',
                })}
              />
            </td>
          </tr>
        ))}
      </table>
    </div>
  )
}
```

## Related

- `ui/guides/client-entry-routes.md` — clientEntry component fundamentals
- `ui/guides/frame-navigation-patterns.md` — Frame reload scoping
- `ui/concepts/mixins-styling-events.md` — Mixin rules (single vs array `mix`)
- `ui/examples/cart-button-pattern.md` — Cart button with similar fetch + reload pattern
- `errors/mix-array-event-only.md` — Correct mix usage (no array wrapper for single event)
- `errors/client-entry-loops.md` — Avoiding infinite loop pitfalls
- `errors/client-entry-props.md` — Props serialization for client entries

## Codebase References

- `bookstore/app/assets/cart-button.tsx` — Original inspiring pattern (uses `window.location.reload()`)
- `demos/frame-navigation/` — Frame resolution and reload mechanics
