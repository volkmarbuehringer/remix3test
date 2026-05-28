## 1. Theme System Foundation

- [x] 1.1 Create `app/theme.tsx` with light and dark theme definitions using `createTheme()`, preserving the starter's current color palette and font (JetBrains Mono)
- [x] 1.2 Refactor `app/ui/document.tsx` to render `<Theme />` and `<DarkTheme.Style />` in `<head>`, read `theme` cookie for initial dark mode, and include flash-proof inline `localStorage` script
- [x] 1.3 Create `app/ui/theme-toggle.tsx` as a `clientEntry` that toggles `data-theme="dark"` on `<html>`, persists to `localStorage`, and sets the `theme` cookie

## 2. Mixin Namespaces

- [x] 2.1 Create `app/ui/mixins/button.ts` exporting `button` namespace with `base`, `primary`, `ghost`, `danger` mixins using `theme.*` tokens
- [x] 2.2 Create `app/ui/mixins/card.ts` exporting `card` namespace with `base` mixin using `theme.*` tokens
- [x] 2.3 Create `app/ui/mixins/input.ts` exporting `input` namespace with `base`, `focus`, `error` mixins using `theme.*` tokens
- [x] 2.4 Create `app/ui/mixins/text.ts` exporting `text` namespace with `heading`, `body`, `muted`, `label` mixins using `theme.*` tokens

## 3. Page Primitives

- [x] 3.1 Create `app/ui/page-primitives.tsx` with `PageSection` component (title + description + children), `ShowcaseLinkCard` component (eyebrow + title + description + href), and all shared CSS exports (`panelCss`, `panelInsetCss`, `panelElevatedCss`, `pageStackCss`, `featureGridCss`, `exampleGridCss`, `bodyTextCss`, `eyebrowTextCss`, `panelTitleTextCss`, `panelDescriptionTextCss`, `captionTextCss`)

## 4. Existing Page Refactors

- [x] 4.1 Refactor `app/ui/layout.tsx` to use `theme.*` tokens for all CSS values and add the `ThemeToggle` client entry button to the nav bar
- [x] 4.2 Refactor `app/ui/scaffold-home-page.tsx` to use page primitives and `theme.*` tokens, collapsing from 530 inline-CSS lines to content-focused composition
- [x] 4.3 Remove the inline CSS variable declarations from the scaffold page's `<body>` style (now handled by the theme)

## 5. Nav Registry

- [x] 5.1 Create `app/ui/nav.ts` with typed `NavItem` and `NavSection` data structures, and a `NAV_SECTIONS` const array defining the app's navigation (Home initially, expandable)
- [x] 5.2 Refactor `app/ui/layout.tsx` nav to render from the `NAV_SECTIONS` registry with active-state detection

## 6. Component Showcase Route

- [x] 6.1 Add `/ui` routes to `app/routes.ts` with index and `:component` parameter
- [x] 6.2 Create `app/ui/showcase-pages.tsx` with all showcase page components (index, button, form, theme)
- [x] 6.3 Wire showcase pages into main controller actions with Renderer middleware
- [x] 6.4 Typecheck passes — zero type errors

## 7. Verification

- [x] 7.1 Run `npm run typecheck` — zero type errors
- [x] 7.2 Run `npm run start` — app boots and home page renders with theme applied
- [x] 7.3 Navigate to `/ui` — showcase page renders with component cards
- [x] 7.4 Navigate to `/ui/button` — button variants render with code examples
- [x] 7.5 Toggle dark mode — all pages switch to dark theme
- [x] 7.6 Verify home page content matches original scaffold (same links, copy, SVG icons)
