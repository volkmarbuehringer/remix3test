<!-- Context: development/remix3/ui/concepts/toast-system | Priority: high | Version: 2.0 | Updated: 2026-05-05 -->

# Concept: Toast Notification System

**Core Idea**: Server-side flash messages with client-side display for success/error feedback after form submissions.

## Two Patterns

### Client-Side (CustomEvent)
```typescript
import { showToast } from '../lib/toast-utils.ts'
showToast('Item saved', 'success')
// In clientEntry components:
document.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Saved', type: 'success' } }))
setTimeout(() => handle.frame.reload(), 1500) // Delay so toast is visible
```

### Server-Side (URL params) — Preferred for redirects
```typescript
import { toastRedirect } from '../utils/toast.ts'
return toastRedirect(routes.items.index.href(), 'Book created')
return toastRedirect(url, 'Cannot delete', true) // true = error
```
Layout extracts via `url.searchParams.get('toast')` / `url.searchParams.get('toastError')`

## Key Points
- `toastRedirect(url, msg)` → success via `?toast=`
- `toastRedirect(url, msg, true)` → error via `?toastError=`
- ToastHandler renders with 4-second auto-dismiss
- Without `setTimeout` delay, frame reload hides toast immediately
- FK errors: catch `DATA_TABLE_ADAPTER_ERROR` with code `23503`

## Reference
- Examples: `../../ui/examples/toast-pattern.md`, `../../ui/examples/toast-redirect-example.md`
- Errors: `../../errors/admin-crud-errors.md`
