---
title: "Re-render-from-POST form validation with value preservation in Remix 3"
tags: [remix3, form-validation, parseSafe, re-render, controller, design]
created: 2026-06-02
status: active
---

## Problem

In Remix 3, forms inside frame-based admin pages (using `createSidebarLayout`/`ShellOrFragment`) cannot use `context.render()` for re-rendering with errors on POST — `ShellOrFragment` discards children and renders `<Layout><Frame src={...}/></Layout>` instead, losing the form content. But for routes using `Layout` directly (no frame wrapper), re-render-from-POST works perfectly and is the canonical pattern. No demo or existing code in newapp demonstrated the full pattern: field-level validation errors AND form value preservation on re-render.

## Solution

Refactored the `/client` route (Client Lab) to use `parseSafe` + raw FormData extraction + `context.render()`:

```ts
// Schema with validation
const clientSaveSchema = f.object({
  name: f.field(s.defaulted(s.string(), '').pipe(minLength(8))),
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  // ...
})

// Helper to extract raw values before validation
function extractFormValues(formData: FormData): Record<string, string> {
  let values: Record<string, string> = {}
  for (let key of ['name', 'email', 'role', 'status', 'registered', '_offset', '_sort', '_order', '_filter'] as const) {
    let v = formData.get(key)
    values[key] = typeof v === 'string' ? v : ''
  }
  return values
}

// Helper to map issues to per-field errors
function issuesToFieldErrors(issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<unknown> }>): Record<string, string> {
  let errors: Record<string, string> = {}
  for (let issue of issues) {
    let field = issue.path?.[0]
    if (typeof field === 'string' && !errors[field]) {
      errors[field] = issue.message
    }
  }
  return errors
}

// Controller action
async create(context) {
  let rawValues = extractFormValues(formData)
  let parsed = s.parseSafe(clientSaveSchema, formData)

  if (!parsed.success) {
    let fieldErrors = issuesToFieldErrors(parsed.issues)
    return context.render(
      <Layout title="Client Lab">
        <ClientPage
          creating={true}
          formValues={rawValues}
          fieldErrors={fieldErrors}
          // preserve grid state
          editingOffset={rawValues._offset}
          editingSort={rawValues._sort}
          editingOrder={rawValues._order}
          editingFilter={rawValues._filter}
        />
      </Layout>,
      { status: 400 },
    )
  }
  // ... success path
}
```

Page component renders `value={formValues?.name ?? row.name}` on inputs and error text + red border on failure:

```tsx
<input
  name="name"
  mix={[input.base, input.focus, fieldErrors?.name ? inputErrorStyle : null].filter(Boolean)}
  value={formValues?.name ?? row.name}
/>
{fieldErrors?.name ? <div mix={fieldErrorStyle}>{fieldErrors.name}</div> : null}
```

## Why

- **`parseSafe` over `s.parse`+try/catch**: Returns a Result type — cleaner control flow, no exception-based validation.
- **Extract raw FormData BEFORE validation**: `parseSafe` may transform/coerce values. Raw extraction ensures exactly what the user typed is preserved.
- **Select fields need explicit `formValues` checks**: Unlike `<input value={}>`, `<select>` uses `selected` attributes. Must check `formValues?.role` before falling back to DB/default.
- **Email `type="email"` blocks server validation**: Browser's built-in validation prevents submission entirely — change to `type="text"` so server can catch invalid formats.
- **Error color**: Use `theme.colors.action.danger.background` (not `.foreground`) for error text — matches all other forms in newapp.
- **Grid state preservation**: Hidden fields (`_offset`, `_sort`, `_order`, `_filter`) must be re-passed to frameSrc and page props so the Frame grid reloads at the correct position.

## Design Rationale

### Why re-render-from-POST over alternatives

- **Remix 3 demos consistently use this**: timeboxer, social-auth both re-render from POST. No demo uses redirects for validation errors.
- **No redirect means no data loss**: `FormData` is still available in the controller, no URL encoding needed.
- **Simplicity**: One function call (`render(...)`) replaces: build redirect URL → encode state → follow redirect → decode state → render.
- **`parseSafe` returns per-field issues**: Each issue has `{ message, path }` where `path[0]` is the field name. Map to `Record<string, string>` for the page.

### Trade-offs

- Browser URL stays as POST URL (e.g., `/admin/offerings` instead of `/admin/offerings?sort=...`)
- Refresh → "Confirm form resubmission" dialog (browser warns about re-POSTing)
- Remix 3 auth demos accept this trade-off — it's standard for all server-rendered form apps
- For frame-based admin layouts (ShellOrFragment), use redirect + URL-encoded state instead — see `remix3-frame-layout-blocks-render-from-post`

### Source

`~/remix/demos/timeboxer/app/controllers/auth/controller.tsx:78-86`

### Cross-reference

- Phase 2 (parseSafe + .refine()): `openspec/changes/offerings-in-memory-token/phase-2-parseSafe.md`
- `f.object` + `parseSafe` compatibility confirmed in `node_modules/remix/src/data-schema/README.md:74-94`
