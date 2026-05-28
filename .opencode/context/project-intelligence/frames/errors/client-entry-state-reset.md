---
title: Client Entry Local State Reset
description: Local state in client entries resets immediately because props overwrite it on every render.
---

# Error: Client Entry Local State Reset

**Symptom**: After clicking a button (e.g., Add to Cart), there is no visible effect. The UI reverts immediately.

## Root Cause

The render function assigns the prop to local state on every render:

```tsx
// ❌ BROKEN
return ({ inCart: propInCart, id, slug }) => {
  inCart = propInCart  // Resets local change every render!
  // ...
}
```

After the user clicks:
1. `inCart = !inCart` toggles locally
2. `handle.update()` triggers re-render
3. `inCart = propInCart` resets it back because the parent never re-rendered with new props

## Solution

Track the last-seen prop value and only sync when it actually changes:

```tsx
// ✅ FIXED
let lastPropInCart = false

return ({ inCart: propInCart, id, slug }) => {
  if (propInCart !== lastPropInCart) {
    inCart = propInCart
    lastPropInCart = propInCart
  }
  // ...
}
```

Also remove `handle.frame.reload()` and any reload timeouts. On successful API call, toggle `inCart = !inCart` locally and call `handle.update()`.

## Prevention

- Always track `lastPropX` for props that mirror local state
- Only sync when `propX !== lastPropX`
- Never assign props unconditionally inside the render function
