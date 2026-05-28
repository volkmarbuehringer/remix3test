<!-- Context: development/remix3/guides/client-side-components | Priority: high | Version: 1.0 | Updated: 2026-04-06 -->

# Client-Side Components (Hydration Patterns)

Proper patterns for using `clientEntry` components in Remix 3 to avoid hydration errors.

## Key Points

- **NEVER** use `clientEntry` components directly in server-rendered JSX
- **ALWAYS** use `<Frame>` to create proper server/client boundaries
- Frames resolve to fragment routes that render the client component
- Direct usage causes `DOMException: Node.insertBefore` errors

## Anti-Pattern: Direct clientEntry Usage

```typescript
// ❌ WRONG - Causes hydration errors
import { InlineCartButton } from '../assets/cart-button.tsx'

// In server-rendered component:
<InlineCartButton inCart={inCart} bookId={book.id} />
```

**Error**: `DOMException: Node.insertBefore: Child to insert before is not a child of this node`

## Correct Pattern: Frame Wrapper

```typescript
// ✅ CORRECT - Proper server/client boundary
import { Frame } from 'remix/ui'
import { routes } from '../routes.ts'

// In server-rendered component:
<Frame src={routes.fragments.cartButton.href({ bookId: book.id })} />
```

## Fragment Route Setup

```typescript
// app/routes.ts - Define fragment route
export const routes = {
  fragments: {
    cartButton: route('/fragments/cart-button/:bookId', () => import('./controllers/fragments/cart-button/controller.tsx'))
  }
}
```

```typescript
// app/controllers/fragments/cart-button/controller.tsx
import { CartButton } from '../../../assets/cart-button.tsx'

export default {
  actions: {
    async index({ params }) {
      let bookId = parseInt(params.bookId, 10)
      let inCart = /* check cart state */
      return renderFragment(<CartButton inCart={inCart} bookId={bookId} />)
    }
  }
}
```

## Client Component Definition

```typescript
// app/assets/cart-button.tsx
import { clientEntry, on } from 'remix/ui'

export const CartButton = clientEntry(moduleUrl, (handle) => ({
  inCart,
  bookId,
}) => (
  <button mix={on('click', async () => {
    // Client-side logic
  })}>
    {inCart ? 'Remove' : 'Add'}
  </button>
))
```

## When to Use Each Pattern

| Pattern | Use Case |
|---------|----------|
| `<Frame>` | Client interactivity needed in server page |
| Direct JSX | Pure server-rendered content (no hydration) |
| Full page `clientEntry` | SPA-like behavior (rare) |

## Related

- `guides/frame-resolution.md` - Frame SSR details
- `errors/client-entry-issues.md` - Common mistakes
- `examples/editable-fields.md` - Grid component patterns

## 📂 Codebase References

**Implementation**:
- `bookstore/app/assets/cart-button.tsx` - Cart button client component
- `bookstore/app/controllers/fragments/cart-button/controller.tsx` - Fragment route
- `bookstore/app/ui/book-card.tsx` - Frame usage in server component

**Related Examples**:
- `examples/editable-fields.md` - Inline editing pattern
