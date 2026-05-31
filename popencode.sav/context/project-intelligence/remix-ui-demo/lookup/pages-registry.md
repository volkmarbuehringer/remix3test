---
title: Pages Registry
description: All 16 ShowcasePageDefinition entries in the explorer registry
category: project-intelligence
type: lookup
source: app/explorer/registry.tsx
---

# Pages Registry

## Core Concept

The `PAGES` object in `app/explorer/registry.tsx` defines all explorer pages. `PAGE_LIST` is the array form; `NAV_SECTIONS` groups them in the sidebar.

## NAV_SECTIONS

### Start (3 pages)

| actionKey | path | title | eyebrow | navLabel |
|-----------|------|-------|---------|----------|
| `index` | `/` | Conceptual overview | Start | Conceptual Overview |
| `installTheme` | `/installing-theme` | Installing a theme | Start | Installing a Theme |
| `createTheme` | `/create-theme` | Creating a theme | Start | Creating a Theme |

### Theme Tokens (4 pages)

| actionKey | path | title | eyebrow | navLabel |
|-----------|------|-------|---------|----------|
| `themeColors` | `/theme-tokens/colors` | Colors | Theme Token | Colors |
| `themeSpacing` | `/theme-tokens/spacing` | Spacing | Theme Token | Spacing |
| `themeTypography` | `/theme-tokens/typography` | Typography | Theme Token | Typography |
| `themeControls` | `/theme-tokens/control-sizes` | Control sizes | Theme Token | Control Sizes |

### Components (9 pages)

| actionKey | path | title | eyebrow | navLabel |
|-----------|------|-------|---------|----------|
| `componentsOverview` | `/components` | Components overview | Components | Overview |
| `componentAccordion` | `/components/accordion` | Accordion | Component | Accordion |
| `componentBreadcrumbs` | `/components/breadcrumbs` | Breadcrumbs | Component | Breadcrumbs |
| `uiButtons` | `/components/button` | Button | Component | Button |
| `componentCombobox` | `/components/combobox` | Combobox | Component | Combobox |
| `componentListbox` | `/components/listbox` | Listbox | Component | Listbox |
| `componentMenu` | `/components/menu` | Menu | Component | Menu |
| `uiPopups` | `/components/popover` | Popover | Primitive | Popover |
| `componentSelect` | `/components/select` | Select | Component | Select |

## Navigation IDs

```tsx
export const NAV_SECTIONS = [
  { id: 'start', label: 'Start', pageIds: ['startOverview', 'installTheme', 'createTheme'] },
  { id: 'themeTokens', label: 'Theme Tokens', pageIds: ['themeColors', 'themeSpacing', 'themeTypography', 'themeControls'] },
  { id: 'components', label: 'Components', pageIds: ['componentAccordion', 'componentBreadcrumbs', 'uiButtons', 'componentCombobox', 'componentListbox', 'componentMenu', 'uiPopups', 'componentSelect'] },
]
```

## References

- `app/explorer/registry.tsx` — `PAGES`, `PAGE_LIST`, `NAV_SECTIONS`, `ShowcasePageDefinition` type
