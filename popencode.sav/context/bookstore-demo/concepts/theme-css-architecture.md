<!-- Context: bookstore-demo/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-29 -->

# Concept: Theme CSS Architecture

**Core Idea**: The bookstore uses a four-layer CSS theming pipeline: raw design tokens (`tokens.ts`) → `createTheme()` contract (`theme.tsx`) → `var(--rmx-*)` consumption (`app.css`) → served via asset server (`asset-entry.ts`). The `--rmx-*` variables resolve differently per `[data-theme]` selector, enabling light/dark switching without touching component code.

---

## Pipeline

```
tokens.ts           →  theme.tsx             →  app.css              →  Rendered HTML
(design constants)     (createTheme contract)   (var(--rmx-*) refs)      (runtime resolution)
                             ↓
                     <Theme /> emits <style>
                     :root { --rmx-color-text-primary: #0f172a }
                     [data-theme="dark"] { --rmx-color-text-primary: #f1f5f9 }
```

### Layer 1: Raw tokens (`tokens.ts`)
- Central constants file: colors, spacing, radii, fontSizes, shadows, transitions, zIndex, breakpoints
- Also exports CSS mixins via `css()` tag: `buttonBase`, `inputBase`, `cardBase`, etc.
- All values are `as const` for type safety

### Layer 2: Theme contract (`theme.tsx`)
- `createTheme({ space, radius, fontFamily, fontSize, colors, surface, shadow, ... })` returns a `<Theme />` component
- `Theme` emits `:root { --rmx-{path}: {value} }` for light mode
- `DarkTheme` uses `{ selector: '[data-theme="dark"]', reset: false }` to emit overrides
- Both themes share the same token shape but different color/surface values

### Layer 3: CSS variable consumption (`app.css`)
- `@layer app, rmx` — app layer overrides rmx layer
- All component styles reference `var(--rmx-*)` — never hardcoded colors
- `body { background: var(--rmx-surface-lvl1); color: var(--rmx-color-text-primary) }`
- Nav-specific: `nav a.nav-active` uses `var(--rmx-surface-lvl2)` + `var(--rmx-color-action-primary-background)` for underline
- Logout: `nav button.nav-logout` uses `var(--rmx-color-action-danger-background)` for danger red/hover

### Layer 4: Asset serving (`asset-entry.ts`)
- `loadAssetEntry()` middleware resolves `app.css` through `assetServer.getHref()` once per request
- Result stored in context via `createContextKey<AssetEntry>()` 
- `Document()` reads `getAssetEntry().stylesheetHref` and renders `<link rel="stylesheet" href={...}>`

---

## Nav-Specific Variable Mapping

| CSS Class | Variable Used | Light Resolves To | Dark Resolves To |
|-----------|--------------|-------------------|------------------|
| `nav a.nav-active` background | `--rmx-surface-lvl2` | `#f1f5f9` (gray100) | `#334155` (gray700) |
| `nav a.nav-active` underline | `--rmx-color-action-primary-background` | `#6366f1` (accent) | `#818cf8` |
| `nav button.nav-logout` text | `--rmx-color-action-danger-background` | `#dc2626` | `#ef4444` |
| `nav button.nav-logout:hover` bg | `--rmx-color-action-danger-background` | `#dc2626` | `#ef4444` |
| `nav button.nav-logout:hover` text | `--rmx-color-action-danger-foreground` | `#ffffff` | `#0f172a` |

---

## 📂 Codebase References

**Implementation**:
- `bookstore/app/ui/tokens.ts` — Raw design tokens and CSS mixins (370 lines)
- `bookstore/app/ui/theme.tsx` — `Theme` (light) and `DarkTheme` via `createTheme()` (226 lines)
- `bookstore/app/assets/app.css` — Component styles consuming `var(--rmx-*)` (273 lines)
- `bookstore/app/middleware/asset-entry.ts` — Asset entry middleware serving CSS (40 lines)
- `bookstore/app/ui/document.tsx` — `<Theme />` and `<DarkTheme.Style />` in `<head>` (75 lines)

**Related context**:
- `../../development/remix3/concepts/theme-contract.md` — `createTheme()` contract details
- `../../development/remix3/concepts/theme-switching.md` — SSR dark mode switching layers
- `dark-mode-styling.md` — Surface level mapping table
- `guides/navbar-active-route.md` — Navbar implementation using these CSS classes
