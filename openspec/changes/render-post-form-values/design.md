## Context

newapp uses two rendering patterns:
- **Direct `Layout`**: Auth pages (`auth-register-controller.tsx`, `auth-login-controller.tsx`) render via `context.render(<Layout><Page /></Layout>)`. This supports re-render-from-POST — `context.render(<Page error={...} />, { status: 400 })` works because the full HTML is rendered and returned directly.
- **Frame-based `ShellOrFragment`**: Admin pages use `createSidebarLayout` → `renderAdminPage` → `ShellOrFragment`. On non-frame POST requests, `ShellOrFragment` renders `<Layout><Frame src={...}/></Layout>` and discards the children prop, making re-render-from-POST impossible.

Existing auth pages demonstrate re-render-from-POST but only with a single error string. Form inputs have no `value` attributes, so submitted values are lost. The admin-offerings controller preserves values via URL params (`fv_*`/`fe_*` query parameters), a workaround for the frame layout limitation.

A test route is needed that demonstrates the full pattern: re-render-from-POST with field-level validation AND form value preservation — outside the frame layout, where it naturally works.

## Goals / Non-Goals

**Goals:**
- Add a standalone `/test-form` route using the direct `Layout` rendering pattern
- Demonstrate `parseSafe` with field-level validation errors
- Preserve submitted form values on validation failure (DOM re-render with `value` props)
- Serve as a reference implementation for the canonical Remix 3 form pattern

**Non-Goals:**
- Does NOT modify `ShellOrFragment` or `createSidebarLayout`
- Does NOT change any existing route or controller
- Does NOT add client-side JavaScript or `clientEntry`
- Does NOT use URL params, session flash, or redirects for error state
- Is NOT a production feature — it's a reference/test route

## Decisions

### Route structure: standalone `form('/test-form')`

Use a flat route at `/test-form`, outside any nested route map. This avoids any frame middleware or sidebar layout. Placed in `routes.ts` as a top-level export alongside other standalone routes.

**Alternative considered**: Nesting under admin routes — rejected because admin routes use `createSidebarLayout`/`ShellOrFragment` which is exactly the pattern this route demonstrates avoiding.

### Render with `Layout` directly

Same pattern as auth pages: `context.render(<Layout><TestFormPage /></Layout>)`. The `Layout` component wraps content in `Document` (full HTML shell with MainNav and footer). No `renderAdminPage`, no `ShellOrFragment`.

**Alternative considered**: Using `Document` directly (like the home page) — works but `Layout` provides navigation context, making the page feel integrated.

### Parse with `parseSafe`, not `parse` with try/catch

Use `s.parseSafe(schema, formData)` which returns `{ success: true, value }` or `{ success: false, issues }`. This is cleaner than `try { s.parse(...) } catch` for validation control flow. Follows the pattern from timeboxer auth and the Remix skill reference.

**Alternative considered**: `s.parse` with try/catch (used by existing auth pages) — works but `parseSafe` is more idiomatic for validation.

### Form value preservation strategy

Extract raw values from `FormData` before validation, then pass them as `formValues` props alongside `fieldErrors`. The page component renders `<input value={formValues.field} />` on each field. This is the key difference from existing auth pages which lose values.

### Schema design

Three fields: `name` (required, 1-100 chars), `email` (required, valid email format), `message` (optional, max 500 chars). Simple enough to be a clear example, rich enough to demonstrate both required-field and format errors.

## Risks / Trade-offs

[Double-submit on refresh] → Browser will show "confirm form resubmission" dialog if user refreshes after a 400 response, since the POST is the last request. This is inherent to re-render-from-POST. Auth pages have the same behavior. For a test/reference route, this is acceptable.

[CSRF] → The route must include CsrfTokenInput to work with newapp's CSRF middleware. Without it, CSRF validation will reject the POST.

[Route pollution] → A test route at `/test-form` adds a permanent URL. Acceptable since it serves as a live reference. Could be hidden behind a flag or removed later.

## Open Questions

- Should the route require authentication? For a test/reference route, keeping it public is simplest. If auth is desired later, add `requireAuth()` middleware.
