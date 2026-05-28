<!-- Context: development/remix3/examples/cart-button-pattern | Priority: medium | Version: 1.1 | Updated: 2026-05-09 -->

> **Note**: This example shows the older pattern using `window.location.reload()` after each toggle. For the **updated pattern** with local state management (no full page reload), see `guides/cart-button-local-state.md`.

# Cart Button Pattern

Complete example of a Frame-based cart button with API integration.

## Architecture
```
Server Page (Frame placeholder) → Client loads cart-button.tsx (clientEntry) → Click → API call with redirect: 'none' → Page reload
```

## Client Component
```typescript
const moduleUrl = routes.assets.href({ path: 'cart-button.js#CartButton' })
export const CartButton = clientEntry(moduleUrl, (_handle) => ({ inCart, bookId }: { inCart: boolean; bookId: number }) => (
  <button type="button" class="btn" mix={on('click', async (_event, signal) => {
    let formData = new FormData(); formData.set('bookId', String(bookId)); formData.set('redirect', 'none')
    let isAdd = !inCart; let method = isAdd ? 'POST' : 'DELETE'
    let url = isAdd ? routes.cart.api.add.href() : routes.cart.api.remove.href()
    let res = await fetch(url, { method, body: formData, signal })
    if (res.ok || res.status === 204) window.location.reload()
  })}>{inCart ? 'Remove from Cart' : 'Add to Cart'}</button>
))
```

## API Controller
```typescript
export default { actions: {
  async add({ get }) { let { bookId, redirect } = parseFormData(get(FormData))
    if (!bookId) return new Response('Invalid book ID', { status: 400 })
    if (redirect === 'none') return new Response(null, { status: 204 })
    return redirect(routes.cart.index.href())
  },
  async remove({ get }) { /* Similar pattern with DELETE */ },
}}
```

## Server Page Usage
```typescript
import { Frame } from 'remix/ui'
<Frame src={routes.fragments.cartButton.href({ bookId: book.id })} />
```

## Trade-offs
| Pros | Cons |
|------|------|
| Simple, reliable | Full page reload |
| No state sync complexity | Brief flash on update |
| Works with session storage | Not instant feedback |

## Key Techniques
1. **`redirect: 'none'`** - Prevents API 302 from changing page
2. **`window.location.reload()`** - Gets fresh server state
3. **Conditional method** - POST to add, DELETE to remove
4. **204 status** - Clean success without body

## Related
- `guides/client-side-components.md` - Hydration patterns
- `guides/form-patterns.md` - API redirect handling
- `guides/input-validation.md` - Validation patterns

## 📂 Codebase References
**Full Implementation**: `bookstore/app/assets/cart-button.tsx`, `bookstore/app/controllers/cart/api/controller.tsx`, `bookstore/app/controllers/fragments/cart-button/controller.tsx`
