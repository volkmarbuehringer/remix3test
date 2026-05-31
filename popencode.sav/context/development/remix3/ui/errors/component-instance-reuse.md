<!-- Context: development/remix3/ui/errors | Priority: high | Version: 1.0 | Updated: 2026-05-09 -->

# Error: Component Instance Reuse on Frame Reload

**Symptom**: clientEntry components inside a Frame retain stale closure state after `handle.frame.reload()`. A CartButton shows "Remove from Cart" for a book that was never added, or "Add to Cart" for a book already in cart. The bug is intermittent — sometimes correct, sometimes wrong.

## Cause

When `frame.reload()` fetches new HTML and runs `render()` → `diffNodes()`, the DOM diff algorithm **reuses hydration comment nodes** that mark component boundaries. Since the comment node identity is preserved, the same clientEntry instance survives the update — its closure variables are NOT reinitialized.

```
Frame reload (page N → page N+1 with different items):

  Comment #1 ──reused──→ Comment #1 (same instance)
    └─ CartButton[A]          └─ CartButton[B]  ← inCart still from book A!
```

## The Incorrect Fix: Value-Based Tracking

```tsx
// ❌ Fragile: only resets when propInCart happens to differ
let lastPropInCart = false
return () => {
  let { inCart: propInCart, id } = handle.props
  if (propInCart !== lastPropInCart) {
    inCart = propInCart
    lastPropInCart = propInCart
  }
}
```

This fails when two different books happen to share the same `inCart` value (e.g., both `false`). The condition doesn't trigger, and `inCart` retains the old book's state — a subtle, intermittent bug.

## The Correct Fix: Identity-Based Tracking

```tsx
// ✅ Always correct: reset whenever the item identity changes
let lastId: string | number | null = null
return () => {
  let { inCart: propInCart, id } = handle.props
  if (id !== lastId) {
    inCart = propInCart   // Reset from server-provided truth
    lastId = id
  }
}
```

## When This Applies

**Affected** — clientEntry inside a Frame reloaded with different data:
- Paginated lists (grid page 1 → page 2)
- Tabbed content (tab A → tab B)
- Search results (query 1 → query 2)
- Detail panels (record 1 → record 2)

**Not affected**:
- clientEntry in non-reloaded Frames
- Standalone clientEntry outside any Frame
- Frame reload with identical data (same list, fresh content)

## Why It Matters

This bug is **silent and intermittent** — it depends on whether prop values coincidentally differ between items. It can pass initial testing and only appear with specific data combinations.

## Prevention Checklist

- [ ] Every clientEntry with persistent state tracks an identity prop
- [ ] Identity prop is unique per item (`id`, `slug`), not position-based
- [ ] Identity check uses strict inequality (`!==`)
- [ ] All closure state resets when identity changes, not just one field
- [ ] Test with: page 1 item A (inCart=false), page 2 slot 1 item B (inCart=false)

## Related

- `guides/cart-button-local-state.md` — CartButton pattern with identity tracking
- `concepts/frame-vs-client-entry.md` — Frame vs clientEntry decision matrix
- `guides/frame-scaling.md` — Frame cascade limit
- `guides/pagination-frames.md` — Frame pagination pattern

## 📂 Codebase References

**Implementation (fixed)**:
- `pppookstore.sav/app/assets/cart-button.tsx` — CartButton with `lastId` tracking

**Runtime (root cause)**:
- `@remix-run/ui/dist/runtime/diff-dom.js` — DOM diff preserves comment nodes
- `@remix-run/ui/dist/runtime/frame.js` — `reload()` → `render()` → `diffNodes()` pipeline
