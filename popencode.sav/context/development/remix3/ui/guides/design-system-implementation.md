# Guide: Design System Implementation

**Purpose**: Implement a design system in Remix demos using CSS class mappings.

## Overview

1. Create design tokens (CSS custom properties)
2. Create theme CSS (light/dark mode variables)
3. Create legacy class mappings (maps old classes to tokens)
4. Copy CSS files to `public/styles/`
5. Import in document.tsx

## Steps

### 1. Create Design Tokens

```css
/* public/styles/theme.css */
:root {
  --color-primary: #3b82f6;
  --spacing-md: 1rem;
  --radius-default: 0.375rem;
}
```

### 2. Create Class Mappings

```css
/* public/styles/tokens-variables.css */
@import url('/styles/theme.css');

.btn {
  background-color: var(--color-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-default);
}
```

### 3. Add to Document

```tsx
<!-- app/ui/document.tsx -->
<link rel="stylesheet" href="/styles/tokens-variables.css" />
```

## Files Created

| File                                 | Purpose                       |
| ------------------------------------ | ----------------------------- |
| `public/styles/theme.css`            | Design token CSS variables    |
| `public/styles/tokens-variables.css` | Legacy class → token mappings |

## Related

- remix3/concepts/css-class-mapping.md
- remix3/concepts/css-file-path-resolution.md
- remix3/examples/zebra-striping.md
