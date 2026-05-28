## ADDED Requirements

### Requirement: 403 Forbidden page uses proper component rendering

The `requireAdmin()` middleware fallback (when no `customForbidden` override is provided) SHALL render a 403 Forbidden page using the existing renderer (`context.get(Renderer)`) with a proper Remix component, NOT a hardcoded HTML string.

#### Scenario: Non-admin user sees rendered 403 page

- **WHEN** a non-admin user accesses an admin-only route and no `customForbidden` override is provided
- **THEN** the system returns a 403 response rendered through the renderer using a proper component

### Requirement: Forbidden page uses css() mixins and theme tokens

The 403 Forbidden component SHALL use `css()` mixins from `remix/ui` for all styling and SHALL reference theme tokens from `remix/ui/theme` for colors, spacing, and typography. No inline `<style>` blocks, `className` attributes, or hardcoded color values SHALL be used.

#### Scenario: 403 page follows styling standards

- **WHEN** the 403 Forbidden page is rendered
- **THEN** all styling is applied via `css()` mixins and theme tokens, with no inline `<style>` or `className`

### Requirement: Forbidden page is reusable

The 403 Forbidden component SHALL be defined in `app/ui/forbidden-page.tsx` so it can be reused by other middleware or controllers that need consistent 403 responses.

#### Scenario: Component importable from app/ui

- **WHEN** any module imports from `app/ui/forbidden-page.tsx`
- **THEN** the `ForbiddenPage` component is available and renders a styled 403 page
