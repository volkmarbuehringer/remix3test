<!-- Context: development/remix3/guides | Priority: high | Version: 1.0 | Updated: 2026-05-06 -->

# Form Loading State Patterns

**Core Idea**: Use a single document-level submit handler with `closest()` delegation to scope loading states to specific forms. This avoids the pitfalls of truly global handlers that would break login/register/logout flows.

## Why Not a Global Handler

| Approach | Problem |
|----------|---------|
| Global handler on **all** forms | Intercepts login/register/logout — prevents normal browser navigation |
| Per-instance inline handlers | Duplicated code, harder to maintain, pollutes component logic |
| **clientEntry + `closest()`** | Scoped to specific form IDs, centralized logic, clean separation |

## Implementation

```typescript
import { clientEntry, type Handle } from 'remix/ui'

export const FormLoading = clientEntry(
  '/assets/app/ui/form-loading.tsx#FormLoading',
  function FormLoadingEntry(handle: Handle) {
    let initialized = false

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        document.addEventListener('submit', (e) => {
          // Scope to specific forms — all others pass through naturally
          let form = (e.target as HTMLElement).closest('#my-specific-form')
          if (!form) return

          let btn = form.querySelector<HTMLButtonElement>('[type="submit"]')
          if (btn) {
            btn.disabled = true
            btn.classList.add('is-loading')
            if (btn.dataset.loadingText) {
              btn.textContent = btn.dataset.loadingText
            }
          }
        })
      }
      return null
    }
  },
)
```

## Key Points

| Concern | Pattern |
|---------|---------|
| **Scoping** | `closest('#form-id')` — only matches targeted forms |
| **Button state** | `disabled = true` + `.is-loading` CSS class prevents double-submit |
| **Loading text** | `data-loading-text` attribute on `<button>` for contextual copy |
| **Non-targeted forms** | Handler returns early — navigation proceeds normally |
| **Server-rendered** | Form HTML exists in initial SSR; clientEntry adds behavior only |

## Server-Rendered Form HTML

The form markup lives in the SSR template. The clientEntry never renders UI — it hydrates and finds the form by ID:

```html
<form id="my-specific-form" method="POST" action="/submit">
  <button type="submit" data-loading-text="Saving...">Save</button>
</form>
```

## Related

- `ui/guides/client-entry-side-effects.md` — Side-effect-only clientEntry pattern
- `ui/guides/client-interactivity-patterns.md` — Event delegation with closest()
- `concepts/ssr-client-boundary.md` — Why server renders UI and client adds behavior
