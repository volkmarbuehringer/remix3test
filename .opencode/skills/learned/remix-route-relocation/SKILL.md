---
name: remix-route-relocation
description: Relocate Remix 3 routes between route trees — moving from admin frame-sidebar to top-level, frame to full-page, or upgrading form validation from error-redirect to parseSafe + context.render. Use when moving a route out of a frame layout or upgrading form error handling.
---

# Remix 3 Route Relocation & Form Validation Upgrade

Use this skill when relocating a Remix 3 route between route trees (e.g. from admin sidebar to top-level) or upgrading form validation from URL-redirect to `parseSafe` + `context.render()`.

## Route Relocation Checklist

When moving a route from one tree to another (e.g. `adminRoutes.admin.foo` → `routes.foo`):

### 1. Route Definition (routes.ts)

- [ ] Move the route entry to the target tree
- [ ] Remove from the source tree
- [ ] Verify path nesting — `route('foo')` under top-level produces `/foo`

### 2. Router Mapping (router.ts)

- [ ] Update `router.map(<newRouteRef>, <controller>)` to reference the new location

### 3. Navigation Updates

- [ ] Add to target nav: main navbar (`NAV_SECTIONS`), sidebar, or both
- [ ] Remove from old nav location
- [ ] Remove from old `AdminNavItem` type union if applicable
- [ ] Update `route-labels.ts` — it maps URL paths to breadcrumb labels

### 4. URL String Audit

Run: `grep -r "old/path" app/` — update every occurrence:

- [ ] Controller: redirect `Location` headers
- [ ] Page component: `ADMIN_BASE` constant, form `action` attributes, cancel links
- [ ] Form components: `action` attributes, cancel URLs
- [ ] ClientEntry/asset files: fetch URLs, `window.location.href` navigations
- [ ] Tests: route references, URL constants, assertions

### 5. Frame Removal (if leaving frame layout)

When moving from admin frame sidebar to full-page `Layout`:

- [ ] Replace `renderAdminPage(context.render, 'key', ...)` with `context.render(<Layout title="Page Title"><PageComponent ... /></Layout>)`
- [ ] Import `Layout` from `app/ui/layout.tsx` instead of `renderAdminPage`
- [ ] Remove all `rmx-target={frames.*}` attributes from links
- [ ] Remove `frames` import from page components
- [ ] Change `<a rmx-target={...}>` to plain `<a href={...}>` (full page navigation)

## Form Validation Upgrade

When upgrading from error-redirect to `parseSafe` + `context.render()`:

### Pattern

```ts
import { minLength, email } from 'remix/data-schema/checks'
import { issuesToFieldErrors, readFormFieldValues } from '../utils/schema-utils.ts'

const FORM_KEYS = ['field1', 'field2', '_offset', '_sort', '_order', '_filter'] as const

const saveSchema = f.object({
  field1: f.field(s.defaulted(s.string(), '').pipe(minLength(8))),
  field2: f.field(s.defaulted(s.string(), '').pipe(email())),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

async update(context) {
  let rawValues = readFormFieldValues(FORM_KEYS, context.formData)
  let parsed = s.parseSafe(saveSchema, context.formData)

  if (!parsed.success) {
    let fieldErrors = issuesToFieldErrors(parsed.issues)
    // Re-fetch grid data so the page stays functional
    let { rows, hasMore } = await fetchGrid({ offset, column, direction, filter })
    return context.render(
      <Layout title="Page">
        <PageComponent
          rows={rows} hasMore={hasMore} ...
          editRow={buildEditRow(id, rawValues)}
          formValues={rawValues}
          fieldErrors={fieldErrors}
        />
      </Layout>,
      { status: 400 },
    )
  }
  // DB mutation, redirect on success with Location: '/path'
}
```

### Common Pitfalls

1. **Missing `minLength(1)` on required fields** — If a DB column has `NOT NULL` or a `CHECK` constraint, the schema field must have `minLength(1)`. Otherwise empty strings pass `parseSafe` and crash at the DB.

```ts
// WRONG: empty string passes parseSafe, DB constraint fails with 23514
login: f.field(s.defaulted(s.string(), ''))

// RIGHT: parseSafe catches empty before DB
login: f.field(s.defaulted(s.string(), '').pipe(minLength(1)))
```

2. **Invisible error keys** — `fieldErrors` only renders for named fields. General errors need a separate `error` prop with a banner component.

```tsx
// In page component props:
error?: string

// In page render:
{error ? <div mix={table.errorBanner}>{error}</div> : null}
```

3. **DB constraint violations crash to JSON** — Wrap DB operations in try/catch, re-render the form instead of re-throwing.

```ts
function dbErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    let pg = error as { code: string }
    if (pg.code === '23505') return 'Login existiert bereits.'
    if (pg.code === '23514') return 'Ungültige Eingabe.'
  }
  return 'Ein Datenbankfehler ist aufgetreten.'
}

// In catch block:
} catch (error) {
  await client.query('ROLLBACK')
  client.release()
  if (process.env.NODE_ENV !== 'test') console.error('DB error:', error)
  // Re-fetch grid, re-render with error banner
  return context.render(
    <Layout title="Page"><PageComponent ... error={dbErrorMessage(error)} formValues={rawValues} /></Layout>,
    { status: 400 },
  )
}
```

4. **Defensive error styling on every input** — Even fields without current validation pipes should have error styling. If validation is added later, errors will silently disappear without it.

```tsx
// Every text input should follow this pattern:
;<input
  name="field"
  mix={[input.base, input.focus, fieldErrors?.field ? inputErrorStyle : null].filter(Boolean)}
  value={formValues?.field ?? defaultValue}
/>
{
  fieldErrors?.field ? <div mix={fieldErrorStyle}>{fieldErrors.field}</div> : null
}
```

5. **Checkbox state preservation** — Checkboxes need special handling since unchecked checkboxes don't appear in FormData:

```tsx
// Edit form (falls back to DB row value):
checked={formValues?.aktiv !== undefined ? formValues.aktiv === 'on' : row.l_aktiv}

// Create form (defaults to false or true):
checked={formValues?.aktiv !== undefined ? formValues.aktiv === 'on' : true}
```

6. **Unconditional `console.error` in tests** — Guard with `NODE_ENV`:

```ts
if (process.env.NODE_ENV !== 'test') console.error('DB error:', error)
```

## Code Review Checklist

After route relocation + validation upgrade, verify:

- [ ] `npm run typecheck` passes
- [ ] `npm test` — all tests pass
- [ ] `grep -r "old/path" app/` returns no stale references
- [ ] No `rmx-target` attributes remain in relocated page components
- [ ] Every text input has `inputErrorStyle` + `fieldErrorStyle`
- [ ] Required DB fields have corresponding `minLength(1)` in schema
- [ ] DB error catch blocks re-render with user-friendly message (no re-throw)
- [ ] `route-labels.ts` entry updated for the new path
