<!-- Context: development/remix3/security/concepts/error-response-standards | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Error Response Standards

**Core**: Error responses (403, 401) must be rendered through the app's `Renderer` using `css()` mixins and theme tokens — never inline HTML strings or `className`.

## ForbiddenPage Component

`app/ui/forbidden-page.tsx` — a reusable 403 page with customizable message:

```typescript
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import type { Handle } from 'remix/ui'

export function ForbiddenPage(handle: Handle<ForbiddenPageProps>) {
  return () => {
    let { message = "You don't have admin access to this section." } = handle.props
    return (
      <div mix={pageCss}>
        <div mix={cardCss}>
          <h1 mix={titleCss}>403</h1>
          <p mix={messageCss}>{message}</p>
          <a href="/" mix={linkCss}>Back to Home</a>
        </div>
      </div>
    )
  }
}
```

All styles use `css()` mixins with theme tokens:
```typescript
const titleCss = css({
  fontSize: theme.fontSize.xxl,
  fontWeight: theme.fontWeight.bold,
  color: theme.colors.action.danger.background,
})
```

## Renderer-Based Rendering

Never use `new Response('...inline HTML...')`. Instead, use the `Renderer` from middleware context:

```typescript
import { Renderer } from 'remix/middleware/render'
import type { RemixNode } from 'remix/ui'

let render = context.get(Renderer) as (node: RemixNode, init?: ResponseInit) => Response
return render(<ForbiddenPage />, { status: 403 })
```

The `forbidden-page.tsx` approach replaced the old inline HTML in `app/middleware/admin.ts`'s `requireAdmin()` fallback.

## Custom Error Messages

```typescript
// Generic admin access
return render(<ForbiddenPage />, { status: 403 })

// Specific context
return render(<ForbiddenPage message="Only workspace owners can delete this project." />, { status: 403 })
```

## Guidelines for New Error Pages

1. **Use `css()` mixins** — never inline styles or `className`
2. **Use theme tokens** — never hardcoded colors/sizes
3. **Use `Renderer`** — never `new Response()`
4. **Make messages customizable** — accept optional props
5. **Include navigation** — link back to `/` or `/login`

## Related

- `../../auth/guides/auth-middleware.md` — Auth middleware patterns
- `../../guides/render-utilities.md` — Renderer usage patterns
