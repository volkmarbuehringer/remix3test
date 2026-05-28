<!-- Context: development/remix3/ui/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# First-Party Components

`@remix-run/ui` provides 12 built-in components with consistent two-phase structure, typed theme tokens, and mixin-based styling.

## Component Overview

| Component | Import | Purpose |
|-----------|--------|---------|
| **Button** | `remix/ui/button` | Action buttons with tone variants (primary/secondary/ghost/danger) |
| **Menu** | `remix/ui/menu` | Button-triggered menu with keyboard nav, checked items, submenus |
| **Popover** | `remix/ui/popover` | Anchored, dismissible floating panel (low-level primitive) |
| **Select** | `remix/ui/select` | Button-triggered popup value picker backed by listbox + popover |
| **Combobox** | `remix/ui/combobox` | Input-first popup value picker with text filtering |
| **Listbox** | `remix/ui/listbox` | Headless option-list primitive for selection + highlighting |
| **Accordion** | `remix/ui/accordion` | Disclosure set with expandable items |
| **Tabs** | `remix/ui/tabs` | Tablist with automatic activation |
| **Breadcrumbs** | `remix/ui/breadcrumbs` | Semantic breadcrumb navigation |
| **Anchor** | `remix/ui/anchor` | Positions floating element against anchor, viewport-constrained |
| **Glyph** | `remix/ui/glyph` | Renders SVG sprite sheet references by name |
| **Separator** | `remix/ui/separator` | Visual separator (`<hr>` with `separatorStyle`) |

## Pattern: Composing Styles vs Using Wrappers

Components export both a wrapper (`Button`) and flat style exports (`button.*Style`). Use the wrapper for common cases; compose styles directly when a higher-level control needs button structure without nesting:

```tsx
import { Button } from 'remix/ui/button'
import * as button from 'remix/ui/button'

// Wrapper approach
<Button startIcon={<Glyph name="add" />} tone="primary">Create</Button>

// Style composition (for custom elements)
<a href="/projects" mix={[button.baseStyle, button.secondaryStyle]}>
  <span mix={button.labelStyle}>View projects</span>
</a>
```

## Reference

Source: `~/remix/packages/ui/src/components/*/README.md`
