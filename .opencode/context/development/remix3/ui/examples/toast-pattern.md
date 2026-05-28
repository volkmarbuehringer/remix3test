<!-- Context: development/remix3/examples/toast-pattern | Priority: high | Version: 1.0 | Updated: 2026-03-22 -->

# Toast Notifications

Client-side toast notifications using CustomEvent pattern. Single source of truth in `lib/toast-utils.ts`.

## Architecture

1. `lib/toast-utils.ts` - `showToast()` function (single source)
2. `assets/toast-handler.tsx` - Listens for events, renders UI
3. Client components - Call `showToast()`

## Toast Utils

```typescript
// app/lib/toast-utils.ts
export function showToast(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'success',
) {
  document.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }))
}
```

## Toast Handler

```typescript
// app/assets/toast-handler.tsx
import { clientEntry } from 'remix/ui'
import { showToast } from '../lib/toast-utils.ts'

let globalHandler: (() => void) | null = null

function renderToast(message: string, type: 'success' | 'error' | 'warning' | 'info') {
  // Create toast DOM element with styles
  // Add to document.body
}

export let ToastHandler = clientEntry(
  '/assets/toast-handler.js#ToastHandler',
  function ToastHandler() {
    if (typeof window !== 'undefined' && !globalHandler) {
      globalHandler = () => {
        document.addEventListener('show-toast', ((event: CustomEvent) => {
          renderToast(event.detail.message, event.detail.type)
        }) as EventListener)
      }
      globalHandler()
    }
    return () => null
  },
)
```

## Usage in Components

```typescript
// In a client component
import { showToast } from '../lib/toast-utils.ts'

// Success
showToast('Item saved')

// Error
showToast('Failed to save', 'error')

// With delay for reload
setTimeout(() => handle.frame.reload(), 500)
```

## RenderOptions Pattern

For server-rendered toasts, pass via URL params:

```typescript
// Controller
return toastRedirect(routes.items.index.href(), 'Created')

// Layout parses
let toast = url.searchParams.get('toast')
