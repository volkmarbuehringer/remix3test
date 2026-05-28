<!-- Context: development/remix3/guides/ui-setup | Priority: medium | Version: 1.0 | Updated: 2026-04-29 -->

# Guide: Remix UI Package Setup

**Goal**: Install and configure the Remix UI runtime (theme, glyphs, first-party components).

## Installation

```sh
npm i remix
```

## Step 1: Define a Theme

```ts
import { createTheme } from 'remix/ui'

let Theme = createTheme({
  space: { none: '0px', sm: '4px', md: '8px', lg: '12px', xl: '16px' },
  radius: { none: '0px', sm: '4px', md: '8px', full: '9999px' },
  fontSize: { xs: '12px', sm: '14px', md: '16px', lg: '18px' },
  colors: {
    text: { primary: '#111827', secondary: '#374151' },
    border: { subtle: '#e5e7eb', default: '#d1d5db' },
    action: {
      primary: { background: '#2563eb', foreground: '#ffffff' },
    },
  },
})
```

## Step 2: Render Theme in Document `<head>`

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

## Step 3: Consume Tokens in Components

```ts
import { css, theme } from 'remix/ui'

let card = css({
  backgroundColor: theme.surface.lvl0,
  color: theme.colors.text.primary,
  padding: theme.space.md,
})
// <div mix={card} />
```

## Step 4: Add Glyph Sheet (Optional)

```tsx
import { Button } from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'
import { RMX_01, RMX_01_GLYPHS } from '@remix-run/ui/theme'

function Layout(props: { children: RemixNode }) {
  return (
    <html>
      <head><RMX_01 /></head>
      <body>
        <RMX_01_GLYPHS /> {/* Hidden SVG sprite sheet */}
        <Button startIcon={<Glyph name="add" />} tone="primary">
          New project
        </Button>
        {props.children}
      </body>
    </html>
  )
}
```

**Reference**: `packages/ui/README.md`

**Related**:
- concepts/remix-ui.md — UI package concept overview
- concepts/theme-contract.md — Theme contract deep dive
- concepts/glyph-system.md — Glyph system deep dive
- examples/theme-usage.md — Full theme setup example
