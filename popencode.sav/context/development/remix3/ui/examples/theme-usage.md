# Example: Theme Setup and Consumption

**Goal**: Define a theme, render it in the document, and consume tokens in component styles.

## 1. Define Theme

```tsx
import { createTheme } from 'remix/ui'

let Theme = createTheme({
  space: { none: '0px', sm: '4px', md: '8px', lg: '12px', xl: '16px', xxl: '24px' },
  radius: { none: '0px', sm: '4px', md: '8px', lg: '12px', full: '9999px' },
  fontSize: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '20px' },
  colors: {
    text: { primary: '#111827', secondary: '#374151', muted: '#6b7280' },
    border: { subtle: '#e5e7eb', default: '#d1d5db' },
    action: {
      primary: { background: '#2563eb', foreground: '#ffffff' },
      danger: { background: '#dc2626', foreground: '#ffffff' },
    },
  },
})
```

## 2. Render in Layout

```tsx
function Layout(props: { children: RemixNode }) {
  return (
    <html>
      <head><Theme /></head>
      <body>{props.children}</body>
    </html>
  )
}
```

## 3. Consume in Components

```tsx
import { css } from 'remix/ui'
import { theme } from 'remix/ui'

let card = css({
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.md,
  paddingInline: theme.space.md,
  paddingBlock: theme.space.sm,
})

// <div mix={card} /> renders with theme-driven CSS custom properties
```

**Reference**: `packages/ui/README.md`
