<!-- Context: ui/web/design-systems | Priority: high | Version: 1.1 | Updated: 2026-04-02 -->

# Design Systems

**Purpose**: Reusable design system patterns, theme templates, and color systems for frontend design work.

## Key Points

- **Color Format**: OKLCH (perceptually uniform color space)
- **Theme Variables**: CSS custom properties (`--variable-name`)
- **Font Sources**: Google Fonts
- **Responsive**: All designs must be mobile-first
- Avoid generic Bootstrap blue (#007bff)
- Use semantic color names (--primary, --destructive, not --blue)

## Minimal Example

```css
/* Neo-Brutalism (retro, bold) */
:root {
  --primary: oklch(0.6489 0.2370 26.9728);
  --radius: 0px;
  --shadow: 4px 4px 0px 0px hsl(0 0% 0% / 1.00);
}

/* Modern Dark Mode (clean, professional) */
:root {
  --primary: oklch(0.2050 0 0);
  --radius: 0.625rem;
  --shadow: 0 1px 3px 0px hsl(0 0% 0% / 0.10);
}

/* Spacing scale */
--spacing: 0.25rem; /* 1x = 4px */
```

## Theme Selection

| Style | Use Cases |
|-------|-----------|
| Neo-Brutalism | Creative, retro, bold statements |
| Modern Dark | SaaS, dashboards, enterprise |

**Reference**: Full guide at `.opencode/context/ui/web/concepts/design-systems.md`

**Related**: `ui/web/ui-styling-standards.md`, `ui/web/animation-patterns.md`