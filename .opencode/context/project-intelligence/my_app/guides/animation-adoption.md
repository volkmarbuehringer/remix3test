<!-- Context: project-intelligence/my_app/guides/animation-adoption | Priority: medium | Version: 1.1 | Updated: 2026-05-05 -->

# Animation Adoption Guide

**Core Idea**: Use `animateEntrance` from `remix/ui/animation` for Fragment route content transitions and `animateExit` for dismiss animations. All my_app animations follow the same standard parameter pattern.

---

## Usage Patterns

### Animate Entrance (3 files)

Applied to the outer content wrapper of Fragment-routed content. Same params everywhere:

```tsx
import { animateEntrance } from 'remix/ui/animation'

// Fragment content wrapper (messages/fragment-page.tsx)
<div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
  {/* fragment content */}
</div>

// Grid content (client/grid-page.tsx)
<div id="client-grid-content" mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
  {/* table + pagination */}
</div>

// Edit form (client/edit-form.tsx)
<form method="POST" id="edit-form" mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
  {/* form fields */}
</form>
```

### Animate Exit (1 file)

Applied in an array with other mixins for dismiss animation:

```tsx
import { animateExit } from 'remix/ui/animation'

// Toast dismiss (toast.tsx) — inside a clientEntry
<div mix={[
  css({ /* toast container styles */ }),
  animateExit({ opacity: 0, duration: 200 }),
]}>
  {/* toast content */}
</div>
```

---

## Standard Parameters

| Parameter | Entrance Value | Exit Value | Notes |
|-----------|---------------|------------|-------|
| `opacity` | `0` (fade in) | `0` (fade out) | Starts/ends at fully transparent |
| `transform` | `translateY(4px)` | — | Slides up slightly as it fades in. Exit uses opacity-only |
| `duration` | `180` | `200` | Milliseconds. Short enough to feel snappy |

---

## When to Use Each

| Animation | Use Case | Example |
|-----------|----------|---------|
| `animateEntrance` | Content that appears via Frame/fragment navigation | Messages list after SSE update, grid after pagination, edit form after clicking Edit |
| `animateExit` | Elements that will be removed from DOM | Toast notification dismiss |

---

## Best Practices

1. **One animation per element** — apply entrance OR exit, not both (animateLayout handles reordering cases, not used in my_app yet)
2. **Wrapper element** — put animation on the outermost container, not on children
3. **Keep durations short** — 180–200ms feels instant while being noticeable
4. **Consistent params** — always use the same opacity/transform/duration values for entrance animations in Fragment contexts
5. **Mix composition** — `animateExit` is a mixin like any other; compose with `mix={[style, animateExit()]}`

---

## What NOT to Do

- ❌ Don't animate every element — only entrance of fragment-loaded content and exit of dismissible elements
- ❌ Don't combine animateEntrance + animateExit on the same element — they fight each other
- ❌ Don't use long durations (>300ms) for entrance — feels sluggish on fragment navigation
- ❌ Don't animate in SSR-only content — no DOM transitions to trigger on initial load

---

## Provenance

Adopted during archived change `adopt-remix3-ui-primitives`:
- Archive: `openspec/changes/archive/2026-05-05-adopt-remix3-ui-primitives/`
- Design: `design.md` Decision 3 — targeted animation placements
- Tasks: 4 animation placements across 3 files (tasks 8.1–8.4). All verified in test run: 88/88 pass, 0 typecheck errors, 0 lint warnings.

---

## 🧭 Codebase References

- `my_app/app/actions/messages/fragment-page.tsx` — animateEntrance on messages content wrapper
- `my_app/app/actions/client/grid-page.tsx` — animateEntrance on grid content container
- `my_app/app/actions/client/edit-form.tsx` — animateEntrance on edit form element
- `my_app/app/ui/toast.tsx` — animateExit on toast dismiss container

## Related

- `development/remix3/ui/guides/animation.md` — General animation API reference (animateEntrance, animateExit, animateLayout)
- `../concepts/button-tone-convention.md` — Related UI primitive migration
