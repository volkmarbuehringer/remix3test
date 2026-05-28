## Why

The default `remix new` scaffold is a single-page app with inline CSS variables, no theme system, no shared mixins, and a 530-line home page where every style is defined from scratch. Adding a second page today means duplicating patterns, re-deriving spacing and colors, and manually wiring navigation. The `@remix-run/ui` demo at `~/remix/packages/ui/demo` demonstrates proven patterns — theme tokens, namespace mixins, page primitives, a nav registry, and a component showcase — that solve these problems at their root. Applying these patterns to the starter app means every future page inherits consistency, dark mode, discoverable components, and data-driven navigation by construction, not by discipline.

## What Changes

- Add `createTheme()` with light + dark theme definitions, replacing inline CSS variables
- Create `app/ui/mixins/` with namespace-exported style mixins for button, card, input, and text
- Create `app/ui/page-primitives.tsx` with shared layout components (PageSection, ShowcaseLinkCard) and CSS primitives
- Add theme toggle client entry for dark/light mode switching + cookie persistence
- Refactor `app/ui/document.tsx` to render theme stylesheets and glyph sheet
- Refactor `app/ui/layout.tsx` to use theme tokens, theme toggle, and data-driven nav
- Collapse `app/ui/scaffold-home-page.tsx` from inline CSS to primitives-based composition
- Create `app/ui/nav.ts` registry of navigation items for data-driven nav rendering
- Add `/ui` showcase route with pages for components (button, form) and theme tokens
- No breaking changes — the existing home page and all routes remain functional

## Capabilities

### New Capabilities

- `theme-system`: `createTheme()` light + dark definitions; semantic tokens (`theme.space.md`, `theme.surface.lvl0`, `theme.colors.text.primary`, etc.); dark mode via `[data-theme="dark"]` CSS variable swap
- `mixin-namespaces`: namespace-exported style mixins (`button`, `card`, `input`, `text`) with autocomplete-discoverable variants (base, primary, ghost, danger, etc.)
- `page-primitives`: reusable page layout components (`PageSection`, `ShowcaseLinkCard`) and shared CSS constants (`panelCss`, `bodyTextCss`, `pageStackCss`, `eyebrowTextCss`)
- `nav-registry`: typed navigation item definitions with section grouping, role-based filtering, and automatic nav rendering
- `component-showcase`: `/ui` route with pages documenting each component variant with live examples and code

### Modified Capabilities

*(None — this is a greenfield starter with no existing capability specs.)*

## Impact

- **New files**: `app/theme.tsx`, `app/ui/mixins/button.ts`, `app/ui/mixins/card.ts`, `app/ui/mixins/input.ts`, `app/ui/mixins/text.ts`, `app/ui/page-primitives.tsx`, `app/ui/theme-toggle.tsx`, `app/ui/nav.ts`, `app/actions/ui/controller.tsx`, `app/actions/ui/pages/button.tsx`, `app/actions/ui/pages/form.tsx`, `app/actions/ui/pages/theme.tsx`
- **Modified files**: `app/ui/document.tsx`, `app/ui/layout.tsx`, `app/ui/scaffold-home-page.tsx`, `app/routes.ts`, `app/router.ts`
- **Dependencies**: no changes needed if using custom theme (built-in `remix/ui/theme`); `@remix-run/ui` optional for RMX_01 preset
- **Systems touched**: UI rendering pipeline, routing, client entry, styling
