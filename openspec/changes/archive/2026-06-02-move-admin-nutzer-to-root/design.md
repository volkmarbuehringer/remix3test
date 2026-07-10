## Context

The Nutzer admin page currently lives at `/admin/nutzer` inside the admin sidebar frame layout. It renders via `renderAdminPage()` which wraps content in a two-panel layout (sidebar + `<Frame target="admin-content">`). Navigation within the nutzer page — sort, filter, paginate, edit, create — all target the `admin-content` frame via `rmx-target={frames.adminContent}`.

Form validation uses `buildNutzerErrorRedirect()` which performs a 302 redirect with `?error=...` in the URL. Submitted form values are lost; only a single error message survives. The `/client` routes demonstrate the preferred pattern: `parseSafe` validation, `context.render()` at status 400 with `formValues` and `fieldErrors` props, preserving all user input.

The data model spans two joined tables (`nutzer` + `login`) in PostgreSQL, accessed via `pool.query()`.

## Goals / Non-Goals

**Goals:**

- Relocate nutzer from `/admin/nutzer` to `/nutzer` as a top-level route
- Add "Nutzer" link to main navigation bar (admin-only)
- Remove "Nutzer" from admin sidebar navigation
- Upgrade form validation from error redirect to `parseSafe` + `context.render()` with per-field errors and value preservation
- Render nutzer page via `Layout` (main page layout with MainNav, breadcrumbs, footer) instead of admin frame layout
- Remove all frame-based navigation (`rmx-target` attributes) from nutzer page components

**Non-Goals:**

- No changes to the data model, `nutzer` or `login` table schema
- No changes to auth or admin middleware (both remain)
- No changes to the context menu structure (right-click actions remain the same)
- No changes to `resetPassword`, `toggleLock`, `toggleActive` endpoints (they remain at the new `/nutzer/:id/*` paths)
- No relocation of any other admin sub-routes

## Decisions

### 1. Top-level route entry (not a sub-route of `/admin`)

**Decision**: Define `nutzer` as a top-level route in the main `routes` tree, not as a child of `adminRoutes.admin`.

**Rationale**: The route becomes accessible at `/nutzer` directly. This is the user-facing path; the fact that it requires admin middleware is an implementation detail. The main `routes` tree is the correct home for any route that gets a navbar link.

**Route shape**: Same structure as `adminRoutes.admin.nutzer` today — `index`, `create`, `update`, `destroy`, `resetPassword`, `toggleLock`, `toggleActive` — just at `/nutzer` instead of `/admin/nutzer`.

### 2. Full-page rendering via `Layout` (not admin frame layout)

**Decision**: The nutzer controller renders via `<Layout title="Nutzer"><NutzerPage ... /></Layout>` using `context.render()`, instead of `renderAdminPage(context.render, 'nutzer', ...)`.

**Rationale**: The nutzer page is no longer inside the admin sidebar — it's a standalone top-level page. `Layout` provides the standard page shell (MainNav, breadcrumbs, footer). `renderAdminPage` wraps content in a frame-and-sidebar layout that would be incorrect outside `/admin/*`.

**Alternative considered**: Keep using `renderAdminPage` but mount it outside `/admin`. Rejected — `renderAdminPage` renders an `<AdminLayout>` with a sidebar that links to admin sub-routes. Showing the admin sidebar on `/nutzer` would be confusing.

### 3. No frames — direct anchor navigation

**Decision**: Remove all `rmx-target={frames.adminContent}` attributes from sort, filter, pagination, and action links. All navigation becomes standard `<a href="...">` with full-page loads.

**Rationale**: The `adminContent` frame target has no meaning outside the admin layout. Without the sidebar/frame shell, frame-based navigation would fail. Full-page navigation is slightly less responsive but simpler and correct. Grid state (sort, filter, offset) is still preserved via URL query parameters.

**Alternative considered**: Introduce a new frame for nutzer content. Rejected — adds unnecessary complexity. The nutzer table is a full management page, not a fragment.

### 4. `parseSafe` validation with `context.render()` on failure

**Decision**: Replace `buildNutzerErrorRedirect(formData, { error, ... })` 302 redirects with:

1. `readFormFieldValues(NUTZER_FORM_KEYS, formData)` to extract raw string values
2. `s.parseSafe(nutzerSaveSchema, formData)` to validate
3. On failure: `issuesToFieldErrors(parsed.issues)`, then `context.render(<Layout><NutzerPage formValues={rawValues} fieldErrors={fieldErrors} ... /></Layout>, { status: 400 })`
4. On success: proceed with DB mutations, then redirect with `gridStateToParams`

**Rationale**: Identical pattern to `/client` controller. Preserves all form input on validation failure. Gives per-field error messages. No redirect → no lost state. The schema already exists (`nutzerSaveSchema`) but needs `minLength` and `email` pipe checks added to match the current manual validation logic.

**Alternative considered**: URL-encoded form values via query params (`encodeFormValues`/`decodeFormValues` from `form-params.ts`). Rejected — more complex, requires encoding/decoding at both ends, and fails for long values. Direct `context.render()` is the canonical Remix 3 pattern.

### 5. Form components accept `formValues` and `fieldErrors` props

**Decision**: `AdminNutzerEditPage` and `AdminNutzerCreatePage` gain optional `formValues?: Record<string, string>` and `fieldErrors?: Record<string, string>` props. Input `value` attributes use `formValues?.fieldName ?? defaultValue`. Per-field error messages render below inputs with red styling.

Checkboxes need special handling: `checked` depends on `formValues?.name === 'on'` (checkbox sends `'on'` when checked) falling back to the DB row value.

**Rationale**: Exactly matches `ClientEditPage`/`ClientCreatePage` pattern. The props flow: controller (validation failure) → `NutzerPage` → `NutzerEditPage`/`NutzerCreatePage`.

### 6. URL base change from `/admin/nutzer` to `/nutzer`

**Decision**: Every string literal and generated URL referencing `/admin/nutzer` changes to `/nutzer`:

- `ADMIN_BASE` constant in `admin-nutzer-page.tsx`: `'/admin/nutzer'` → `'/nutzer'`
- All form `action` attributes: `action="/admin/nutzer"` → `action="/nutzer"`, `action="/admin/nutzer/${id}"` → `action="/nutzer/${id}"`
- Cancel links: `buildCancelUrl('/admin/nutzer', ...)` → `buildCancelUrl('/nutzer', ...)`
- Filter/pagination/sort URLs: same pattern
- Context menu asset (`nutzer-table-interactive.tsx`): all fetch URLs updated

### 7. Schema validation with Zod pipes

**Decision**: Extend `nutzerSaveSchema` to include `minLength(8)` on `name` and `email()` on `email`, matching the current manual validation logic. Use `s.defaulted(s.string(), '')` as before.

```ts
const nutzerSaveSchema = f.object({
  vorname: f.field(s.defaulted(s.string(), '')),
  name: f.field(s.defaulted(s.string(), '').pipe(minLength(8))),
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  // ... remaining fields unchanged
})
```

**Rationale**: Zod pipes run during `parseSafe` and produce typed issues that `issuesToFieldErrors` can map to field names. This replaces the manual `if (parsed.name.length < 8)` checks.

### 8. Keep transactions for create/update (no change)

**Decision**: The existing `BEGIN/COMMIT/ROLLBACK` transaction pattern for multi-table writes stays unchanged.

**Rationale**: Already implemented, works correctly, not related to this change.

## Risks / Trade-offs

- **[Medium] Full-page navigations replace frame navigations**: Sort, filter, and pagination links will now trigger full page loads instead of frame-only updates. The page will flash/reload. Mitigation: This is acceptable and expected for a top-level management page. The `/client` and `/lists` pages already work this way.
- **[Low] Missed URL references**: Some `/admin/nutzer` string may be missed in the update. Mitigation: Use the codebase search to audit all occurrences before and after the change.
- **[Low] Context menu breaking**: The `NutzerTableInteractive` asset sends fetch requests to `/admin/nutzer/*` paths. If these aren't updated, context menu actions (edit, delete, reset password, toggle lock) will fail. Mitigation: Update all URLs in that file as part of the tasks.
- **[Low] Breadcrumbs**: The breadcrumb system auto-generates from the URL path. `/nutzer` will produce a breadcrumb labelled "Nutzer" which is correct. No code change needed.

## Open Questions

<!-- None — all decisions have been made based on the existing Client Lab reference implementation. -->
