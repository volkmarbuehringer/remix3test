<!-- Context: development/remix3/ui/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-09 -->

# Concept: Frame vs clientEntry Decision Matrix

**Purpose**: Choose between `<Frame>` and `clientEntry` based on architectural role — data-loading boundary vs interaction boundary.

## Core Idea

`<Frame>` is a **data-loading boundary** — loads server-driven content with independent lifecycle, fallback states, and sub-frame scheduling. `clientEntry` is an **interaction boundary** — adds client-side behavior to server-rendered HTML without sub-frame overhead. The two are not interchangeable; each solves a distinct problem.

## Decision Matrix

| Question | Frame | clientEntry |
|----------|-------|-------------|
| Does it load server content? | ✅ Yes — src URL, fallback | ❌ No — hydrates existing HTML |
| Needs independent loading state? | ✅ Yes — blocking/streaming | ❌ No — hydrates in-place |
| Is there only 1 instance? | ✅ Use Frame | ❌ Use clientEntry too |
| Are there 50+ instances on page? | ❌ Cascade limit (50) | ✅ Scales to any count |
| Per-item interactivity? | ❌ Overkill (scheduler per instance) | ✅ Lightweight function call |
| State on parent reload? | ✅ Own lifecycle preserved | ⚠️ Closure persists — track identity |

## The "One Frame" Pattern

```
Page Shell (document)
  └── Frame (data region)        ← ONE Frame per paginated/data area
       ├─ clientEntry (cart)     ← per-item interaction, no sub-frame
       ├─ clientEntry (cart)
       ├─ clientEntry (pagination controls)
       └─ ... × N                ← N function calls, zero sub-frames
```

**Rule of thumb**: If it loads data from a URL → `<Frame>`. If it reacts to clicks on server-rendered HTML → `clientEntry`. Never put a `<Frame>` inside a list item if there are more than ~20 items.

## Resource Comparison

| Resource | Frame | clientEntry |
|----------|-------|-------------|
| Scheduler | 1 per instance | None |
| Style manager | 1 per instance | None |
| Module cache | 1 per instance | Shared |
| Hydration lifecycle | Full (sub-frames → hydrate → flush) | Single function call |
| Cascade counter entry | 1 per instance | 0 |
| DOM footprint | Comment + container | Comment node only |

## When Frame Is Correct

- **Paginated grid**: ONE Frame loads page N server content with fallback
- **Search results panel**: Independent loading, can be replaced as unit
- **Sidebar / widget**: Self-contained server fragment with own lifecycle
- **Modal content loaded on demand**: Lazy load via Frame src

## When clientEntry Is Correct

- **Cart button per item**: Scales to hundreds, local state, no cascade risk
- **Like/favorite toggle**: Per-item, instant feedback, no server round-trip
- **Pagination controls**: Calls `handle.frame.reload()` on the parent Frame
- **Any interactive element in a list**: Table row actions, inline editors, toggles

## Related

- `guides/frame-scaling.md` — 50-frame cascade limit
- `guides/pagination-frames.md` — Frame pagination pattern
- `guides/cart-button-local-state.md` — clientEntry local state management
- `errors/component-instance-reuse.md` — Identity tracking fix

## 📂 Codebase References

**Implementation**:
- `pppookstore.sav/app/actions/fragments/controller.tsx` — Single Frame + clientEntry items
- `pppookstore.sav/app/assets/cart-button.tsx` — clientEntry per-item interaction
- `pppookstore.sav/app/ui/book-card.tsx` — Server component uses CartButton directly
- `pppookstore.sav/app/assets/pagination.tsx` — clientEntry calling handle.frame.reload()
