<!-- Context: development/remix3/ui/guides | Priority: high | Version: 1.0 | Updated: 2026-05-08 -->

# Frame Scaling Constraints

## Core Discovery

**Frames do not scale horizontally to 50+ instances on a single page.**

Each `<Frame>` creates a sub-frame with its own scheduler, style manager, module cache, and hydration lifecycle. The scheduler has a `MAX_CASCADING_UPDATES = 50` limit — when synchronous frame hydration cascades past this, it throws `handle.update() infinite loop detected`.

## The Limit

```
const MAX_CASCADING_UPDATES = 50;  // scheduler.js

Frame instances on page:
  1-20  ✅ Safe
  20-49 ⚠️  Risky — depends on nesting depth and other page work
  50+   ❌  Guaranteed infinite loop error
```

The cascade counter only resets at a macrotask boundary (`setTimeout(0)`). All frames created during the same synchronous hydration pass share the counter.

## The Pattern That Works

```
DO THIS                                    DON'T DO THIS
─────────                                  ────────────

<Frame src="/grid?page=N">                 <Frame src="/grid?page=N">
  └─ Grid fragment                           └─ BookCard
     ├─ BookCard                                  └─ <Frame src="/cart/N"> ✗
     │  └─ <CartButton> [clientEntry]         └─ BookCard
     ├─ BookCard                                    └─ <Frame src="/cart/N"> ✗
     │  └─ <CartButton> [clientEntry]              ... × 100
     └─ ... × pageSize                              
                                                → 101 frames → infinite loop
```

## When to Use Each

| Use case | Tool | Why |
|----------|------|-----|
| Paginated data grid | `<Frame>` | One instance. Server-driven content loading with fallback. |
| Search results | `<Frame>` | One instance. Loads independently, can be replaced as a unit. |
| Cart button (×100) | `clientEntry` | Lightweight. Hydrated in-place. No sub-frame overhead. |
| Like/favorite toggle | `clientEntry` | Per-item interactivity. Local state. Scales to any count. |
| Product listing items | `clientEntry` | Server-rendered inside parent Frame's fragment, hydrated client-side. |

## Why It Matters

- **Frame** carries: scheduler, style manager, module cache, WeakMap instance registry, full hydration lifecycle
- **clientEntry** carries: just a function call with a handle

Use `<Frame>` for **data boundaries** (what loads as a unit).
Use `clientEntry` for **interaction boundaries** (what needs client behavior).

## Reference

- The scheduler cascade limit: `scheduler.js` line 7: `const MAX_CASCADING_UPDATES = 50;`
- Frame creation creates sub-frames via `createSubFrames` → `createFrame` → `hydrateInitial` → `scheduleHydrationInContainer` → each triggers a synchronous scheduler flush
- See also: `concepts/frame-vs-client-entry.md` for the decision matrix
- See also: `guides/cart-button-local-state.md` for the clientEntry local state pattern
- See also: `pagination-frames.md` for the pagination pattern (applies this constraint)
