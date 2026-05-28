<!-- Context: development/remix3/ui/guides | Priority: high | Version: 1.0 | Updated: 2026-05-09 -->

# Guide: Cart Button with Local State

**Purpose**: Implement cart toggle with local state inside a clientEntry, avoiding full page reload or per-item frames.

## Why Not Frame or Page Reload?

| Approach | Problem |
|----------|---------|
| Per-item `<Frame src="/fragments/cart/N">` | 100 buttons = 101 frames → cascade error (>50) |
| `window.location.reload()` on toggle | Full page flash, loses scroll position, slow |

Instead: **One Frame for the grid, clientEntry for each cart button** with local toggle state.

## The Pattern (clientEntry + Identity Tracking)

```tsx
// app/assets/cart-button.tsx
import { clientEntry, on } from 'remix/ui'
import type { Handle } from 'remix/ui'

type CartButtonProps = {
  inCart: boolean
  id: string | number
  slug: string
}

export const CartButton = clientEntry(
  import.meta.url,
  function CartButton(handle: Handle<CartButtonProps>) {
    let pending = false
    let inCart = false
    let lastId: string | number | null = null  // ← identity tracker

    return () => {
      let { inCart: propInCart, id, slug } = handle.props
      // Reset state when item changes (frame reload reuses component)
      if (id !== lastId) {
        inCart = propInCart
        lastId = id
      }

      return (
        <button
          type="button"
          mix={on('click', async (_event, signal) => {
            pending = true
            handle.update()

            let formData = new FormData()
            formData.set('bookId', String(id))
            formData.set('slug', slug)

            await fetch('/api/cart/toggle', {
              method: 'POST', body: formData, signal,
            })

            if (signal.aborted) return
            pending = false
            inCart = !inCart
            handle.update()
          })}
        >
          {pending ? 'Saving...' : inCart ? 'Remove from Cart' : 'Add to Cart'}
        </button>
      )
    }
  },
)
```

## The Identity Tracking Fix

**Problem**: When `handle.frame.reload()` runs for pagination, the DOM diff reuses hydration comment nodes. The same clientEntry component instance survives, retaining stale closure state.

**Wrong fix — `lastPropInCart` only**: Coincidentally works when prop values differ between items, but fails when two different books share the same `inCart` value (e.g., both `false`).

**Correct fix — `lastId`**: When the server passes a different `id`, force a full reset from server props:

```tsx
if (id !== lastId) {
  inCart = propInCart  // Reset from server-provided truth
  lastId = id
}
```

## PaginationControls (clientEntry + Frame Reload)

```tsx
// app/assets/pagination.tsx
import { clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'

type PaginationProps = {
  currentPage: number
  totalPages: number
}

export const Pagination = clientEntry(
  import.meta.url,
  function Pagination(handle: Handle<PaginationProps>) {
    return () => {
      let { currentPage, totalPages } = handle.props
      let goToPage = (page: number) => {
        let url = new URL(handle.frame.src, window.location.href)
        url.searchParams.set('page', String(page))
        handle.frame.src = url.toString()
        handle.frame.reload()
      }
      // ... Previous / Page X of Y / Next
    }
  },
)
```

Pagination calls `handle.frame.reload()` on its **parent Frame** (the single grid Frame). This re-fetches the fragment with the new page param.

## Verification Checklist

- [ ] CartButton is `clientEntry`, not `<Frame>`
- [ ] CartButton tracks `lastId` (not just `lastPropInCart`)
- [ ] Pagination controls are `clientEntry` using `handle.frame.reload()`
- [ ] No per-item `<Frame>` inside list/grid
- [ ] Total frames on page = 1 (the grid container) + any page-level frames
- [ ] Cart toggle gives instant feedback (no page flash)

## Related

- `concepts/frame-vs-client-entry.md` — Decision matrix
- `guides/frame-scaling.md` — 50-frame cascade limit
- `errors/component-instance-reuse.md` — Identity tracking bug in detail
- `examples/cart-button-pattern.md` — Older pattern (full page reload, deprecated)
- `examples/frame-paginated-grid.md` — Complete working example

## 📂 Codebase References

**Implementation**:
- `pppookstore.sav/app/assets/cart-button.tsx` — CartButton with local state + lastId
- `pppookstore.sav/app/assets/pagination.tsx` — Pagination clientEntry with frame reload
- `pppookstore.sav/app/ui/book-card.tsx` — Uses CartButton directly (no Frame wrapper)
- `pppookstore.sav/app/actions/fragments/controller.tsx` — Fragment server rendering
