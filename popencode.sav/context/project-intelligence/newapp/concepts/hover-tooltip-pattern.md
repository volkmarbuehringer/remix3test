<!-- Context: project-intelligence/newapp/concepts/hover-tooltip-pattern | Priority: low | Version: 2.0 | Updated: 2026-05-23 -->

# Concept: Hover Tooltip for Long Titles

**⚠️ REMOVED — preserved for historical reference only**

The tooltip system was removed in the multiline-text improvements (2026-05-23). Previously, a `position: fixed` tooltip was rendered at the grid wrapper level to show full appointment titles on hover. This became redundant when:

1. **`white-space: pre-wrap`** was added to `blockTitleStyle`, so stored `\n` characters render as line breaks in the grid blocks
2. **`expandedTitleStyle`** changed to `display: block` + `white-space: pre-wrap` (was `-webkit-line-clamp: unset`), showing the full title on hover without needing a separate tooltip
3. A 2-line clamp via `-webkit-line-clamp: 2` on `blockTitleStyle` keeps the default compact

The tooltip system (mouseenter/mouseleave handlers, tooltipTitle/tooltipPos state variables, tooltipStyle CSS) was fully deleted from `app/ui/appointment-grid.tsx`.

**In short**: The tooltip is no longer needed because hover-expanded titles now render multiline content correctly.

---

*Historical documentation below this line documents the removed implementation.*

---

**Core Idea**: A `position: fixed` tooltip rendered at the grid wrapper level (outside `overflow: hidden` parents) to show full appointment titles on hover, replacing the native `title` attribute.

---

## Why Not Native `title`?

1. **Browser-dependent truncation** — Many browsers cut off long tooltip text at a fixed width
2. **No styling control** — Cannot customize position, font, or theme colors
3. **Overflow clipping** — `title` attributes on elements inside `overflow: hidden` containers may be clipped or positioned incorrectly

---

## How It Works

### State Variables

```tsx
let tooltipTitle: string | null = null
let tooltipPos = { top: 0, left: 0, width: 0 }
```

### Show on `mouseenter` / Hide on `mouseleave`

```tsx
// On the title span:
on('mouseenter', (e) => {
  let blockEl = (e.target as HTMLElement).closest('[data-block-id]')
  if (blockEl) {
    let rect = blockEl.getBoundingClientRect()
    tooltipPos = { top: Math.max(rect.top, 24), left: rect.left, width: rect.width }
    tooltipTitle = appt.title
    handle.update()
  }
})
on('mouseleave', () => { tooltipTitle = null; handle.update() })
```

### Render at Grid Wrapper Level

```tsx
{tooltipTitle ? (
  <div mix={tooltipStyle}
    style={{ top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px` }}>
    {tooltipTitle}
  </div>
) : null}
```

---

## Key Details

| Aspect | Detail |
|--------|--------|
| **`position: fixed`** | Anchors to viewport, escapes scroll parents |
| **`pointerEvents: 'none'`** | Tooltip doesn't intercept hover on blocks beneath it |
| **Viewport clamp** | `Math.max(rect.top, 24)` — prevents off-screen for blocks near top |
| **`closest('[data-block-id]')`** | Finds block from title span event target |
| **Outside `overflow: hidden`** | Renders at grid wrapper level, not inside the block |
| **`transform: translateY(-100%)`** | Appears above the block |
| **`maxWidth: 320px`** | Caps width; `wordBreak: break-word` for long strings |
| **`zIndex: 100`** | Above all grid elements |

## 📂 Codebase References

**Implementation**:
- `app/ui/appointment-grid.tsx` lines 95–96 — `tooltipTitle`/`tooltipPos` state
- `app/ui/appointment-grid.tsx` lines 214–231 — `mouseenter`/`mouseleave` handlers
- `app/ui/appointment-grid.tsx` lines 340–350 — Tooltip rendering
- `app/ui/appointment-grid.tsx` lines 1128–1145 — `tooltipStyle` CSS

**Related**:
- [Appointment Calendar Architecture](../concepts/appointment-calendar.md) — Full feature context
- [Inline Rename Pattern](../guides/inline-rename-pattern.md) — Title editing (other title interaction)
