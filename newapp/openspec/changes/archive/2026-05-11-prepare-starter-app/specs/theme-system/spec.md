## ADDED Requirements

### Requirement: App defines light theme with createTheme

The app SHALL define a light theme using `createTheme()` from `remix/ui/theme` with tokens for space, radius, fontFamily, fontSize, lineHeight, letterSpacing, fontWeight, control heights, surface levels, shadows, and color tokens (text, border, focus, overlay, action primary/secondary/danger).

The theme SHALL be exported from `app/theme.tsx` as `Theme`.

#### Scenario: Light theme is the default

- **WHEN** the app renders without a `data-theme` attribute on `<html>`
- **THEN** `Theme` (light theme) CSS variables SHALL be active on the page

#### Scenario: Theme tokens are typed

- **WHEN** importing `theme` from `remix/ui/theme`
- **THEN** accessing `theme.space.md`, `theme.surface.lvl0`, `theme.colors.text.primary`, `theme.fontSize.sm`, `theme.control.height.md`, `theme.radius.lg`, `theme.shadow.sm` SHALL return typed string values

### Requirement: App defines dark theme

The app SHALL define a dark theme using `createTheme()` with the same token structure but altered surface and color values for dark mode. The dark theme SHALL be guarded by `[data-theme="dark"]` and use `reset: false`.

The dark theme SHALL be exported from `app/theme.tsx` as `DarkTheme`.

#### Scenario: Dark theme activates via data attribute

- **WHEN** `<html>` has `data-theme="dark"` attribute
- **THEN** `DarkTheme` CSS variables SHALL override the light theme variables

### Requirement: Document shell renders theme stylesheets

The `Document` component in `app/ui/document.tsx` SHALL render `<Theme />` and `<DarkTheme.Style />` in the document `<head>` to inject the theme CSS variables.

The Document SHALL read the `theme` cookie server-side to determine the initial theme and set `data-theme` accordingly on `<html>`.

The Document SHALL include a flash-proof inline script that reads `localStorage.getItem('theme')` before the page renders and applies `data-theme="dark"` if dark was previously selected.

#### Scenario: Server renders correct initial theme

- **WHEN** a request has `Cookie: theme=dark`
- **THEN** the rendered `<html>` SHALL have `data-theme="dark"` attribute

#### Scenario: Flash-proof script prevents theme flicker

- **WHEN** the page HTML arrives in the browser
- **THEN** the inline script in `<head>` SHALL execute before the first paint and set `data-theme` from localStorage

### Requirement: Theme toggle switches dark/light mode

The app SHALL provide a `ThemeToggle` client entry component that toggles `data-theme="dark"` on `<html>` when clicked. On toggle it SHALL update `localStorage` and set a `theme` cookie with a 1-year max-age.

#### Scenario: Clicking toggle switches theme

- **WHEN** user clicks the theme toggle button
- **THEN** `data-theme="dark"` SHALL be added if it was light, or removed if it was dark
- **AND** `localStorage.theme` SHALL be updated to `"dark"` or `"light"`
- **AND** `document.cookie` SHALL contain `theme=dark` or `theme=light` with `max-age=31536000`
