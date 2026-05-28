# Concept: CSS Class Mapping Approach

**Purpose**: Gradual UI standardization using CSS class mappings instead of React components.

## Core Concept

Instead of importing React components across monorepo package boundaries, map existing CSS classes to design tokens. This allows incremental migration without breaking existing code or dealing with complex import paths.

## Key Points

- Map legacy classes (.btn, .card) to design token CSS variables
- Pages continue using CSS classes - no component imports needed
- @import chain connects CSS files: theme.css → tokens-variables.css
- Backwards compatible: existing code works while adopting new design

## Quick Example

```css
/* tokens-variables.css */
@import url('/styles/theme.css');

.btn {
  background-color: var(--color-primary);
  color: var(--color-primary-foreground);
}
```

## Reference

demos/bookstore/public/styles/tokens-variables.css

## Related

- remix3/concepts/css-file-path-resolution.md
- remix3/guides/design-system-implementation.md
