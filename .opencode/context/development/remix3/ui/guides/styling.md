<!-- Context: development/remix3/ui/guides | Priority: high | Version: 1.0 | Updated: 2026-05-13 -->

# Styling

The `css()` mixin for inline styles with pseudo-selectors, descendant selectors, and media queries.

## Core Idea

`css()` produces static CSS rules inserted into the document. Use the `style` prop for dynamic styles (frequently changing values). `css()` supports modern CSS nesting (via `&` for self-reference).

## Key Points

- **`css()` for static** styles needing pseudo-selectors, media queries, nesting
- **`style` prop for dynamic** styles (avoids creating new CSS rules on every update)
- **`&` prefix** for pseudo-selectors (`&:hover`), pseudo-elements (`&::before`), attribute selectors (`&[required]`)
- **Direct selectors** for descendants (`& h2`, `& .icon`)
- **`@media`** for responsive design inside `css()`
- **Parent hover → child**: Use CSS nesting (`&:hover & .title`), not JavaScript state
- **Element's own hover**: Style directly on the element's `css()`, no nesting needed

## Quick Examples

```tsx
import { css } from 'remix/ui'
import type { Handle } from 'remix/ui'

// Static + pseudo-selectors
<button mix={[css({
  backgroundColor: 'blue', color: 'white', padding: '12px 24px',
  '&:hover': { backgroundColor: 'darkblue', transform: 'translateY(-1px)' },
  '&:active': { backgroundColor: 'navy' },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
})]}>Click</button>

// css() for static, style prop for dynamic
function ProgressBar(handle: Handle<void>) {
  let progress = 0
  return () => (
    <div mix={[css({ backgroundColor: 'blue' })]} style={{ width: `${progress}%` }}>
      {progress}%
    </div>
  )
}

// Parent hover affects children — use CSS nesting, not JS
function Card(handle: Handle<{ children: RemixNode }>) {
  return () => {
    let { children } = handle.props
    return (
      <div mix={[css({
        border: '1px solid #ddd',
        '&:hover': { borderColor: 'blue', '& .title': { color: 'blue' } },
        '& .title': { fontSize: '20px', fontWeight: 'bold' },
      })]}>
        <div className="title">{children}</div>
      </div>
    )
  }
}

// Media queries
<div mix={[css({
  display: 'grid', gridTemplateColumns: '1fr',
  '@media (min-width: 768px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
  '@media (min-width: 1024px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
})]} />
```

## Nested Selectors Decision

**Use when**: Parent state affects children (hover, focus → child color). Prefer over JS state management.

**Don't use when**: Element controls its own pseudo-states (style directly).

## Reference

`/home/lucky/remix/packages/ui/docs/styling.md`

**Related**: `concepts/mixins-styling-events.md`, `examples/css-mixin-examples.md`
