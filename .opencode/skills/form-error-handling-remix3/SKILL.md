# Form Error Handling in Remix 3

## Overview

Handle form validation errors in Remix 3 controllers and components. This skill covers two patterns: **direct re-render** (latest, preferred for non-Frame pages) and **URL param roundtrip** (for Frame-safe validation redirects). Both use `parseSafe` from `remix/data-schema` to make validation failures a return value instead of an exception.

## When To Use This Skill

- Adding validation to a POST/PUT/DELETE form action
- Rendering per-field error messages next to form inputs
- Preserving submitted form values after a validation failure
- Wiring validation failures through `<Frame>` navigation
- Testing form validation controller behavior

---

## Pattern 1: Direct Re-Render (Preferred for Non-Frame Pages)

Use this pattern when the form is rendered as part of a full page (not inside a `<Frame>`). On validation failure, re-render the page with `status: 400`, passing `formValues` and `fieldErrors` as props.

### Controller Setup

```typescript
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength, email } from 'remix/data-schema/checks'

// 1. Define schema with validation constraints
const saveSchema = f.object({
  name: f.field(s.defaulted(s.string(), '').pipe(minLength(8))),
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  role: f.field(s.defaulted(s.string(), '')),
})

// 2. Extract raw form values BEFORE validation (to preserve on failure)
function extractFormValues(formData: FormData): Record<string, string> {
  let values: Record<string, string> = {}
  for (let key of ['name', 'email', 'role'] as const) {
    let v = formData.get(key)
    values[key] = typeof v === 'string' ? v : ''
  }
  return values
}

// 3. Convert parseSafe issues to field-keyed errors
function issuesToFieldErrors(
  issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<unknown> }>
): Record<string, string> {
  let errors: Record<string, string> = {}
  for (let issue of issues) {
    let field = issue.path?.[0]
    if (typeof field === 'string' && !errors[field]) {
      errors[field] = issue.message
    }
  }
  return errors
}

// 4. In the action: validate, then branch
async create(context) {
  let formData = context.formData
  let rawValues = extractFormValues(formData)
  let parsed = s.parseSafe(saveSchema, formData)

  if (!parsed.success) {
    let fieldErrors = issuesToFieldErrors(parsed.issues)
    return context.render(
      <MyPage
        formValues={rawValues}
        fieldErrors={fieldErrors}
      />,
      { status: 400 },
    )
  }

  // Use parsed.value for the happy path
  let row = await db.create(table, parsed.value)
  return redirect('/list')
}
```

### Component: Render Errors and Preserved Values

```tsx
// Styles
const inputErrorStyle = css({
  borderColor: theme.colors.action.danger.background,
})

const fieldErrorStyle = css({
  marginTop: theme.space.xs,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.action.danger.background,
})

// Value priority: formValues (from validation failure) > row data (from DB)
function EditForm(handle: Handle<EditFormProps>) {
  return () => {
    let { row, formValues, fieldErrors } = handle.props

    return (
      <div>
        <input
          name="name"
          value={formValues?.name ?? row.name}
          mix={fieldErrors?.name ? inputErrorStyle : null}
        />
        {fieldErrors?.name ? <div mix={fieldErrorStyle}>{fieldErrors.name}</div> : null}
      </div>
    )
  }
}
```

### Select Fields: Preserve Selection

When `formValues` are present (validation failure), use them for `selected`; otherwise fall back to the row value:

```tsx
<select name="role">
  <option value="Admin" selected={
    formValues?.role !== undefined ? formValues.role === 'Admin' : row.role === 'Admin'
  }>Admin</option>
  <option value="Editor" selected={
    formValues?.role !== undefined ? formValues.role === 'Editor' : row.role === 'Editor'
  }>Editor</option>
</select>
```

---

## Pattern 2: URL Param Roundtrip (For Frame-Safe Redirects)

Use this pattern when the form lives inside a `<Frame>` and a validation failure must survive a redirect. Field values and errors are encoded as URL search parameters (`fv_` prefix for form values, `fe_` prefix for field errors).

### Utility Module: `app/utils/form-params.ts`

```typescript
export function encodeFormValues(
  keys: readonly string[],
  parsed: Record<string, string>
): Record<string, string> {
  let params: Record<string, string> = {}
  for (let key of keys) {
    if (parsed[key]) params[`fv_${key}`] = parsed[key]
  }
  return params
}

export function decodeFormValues(
  keys: readonly string[],
  url: URL
): Record<string, string> | undefined {
  let values: Record<string, string> = {}
  let hasAny = false
  for (let key of keys) {
    let val = url.searchParams.get(`fv_${key}`)
    if (val !== null) {
      values[key] = val
      hasAny = true
    }
  }
  return hasAny ? values : undefined
}

export function encodeFieldErrors(
  errors: Record<string, string>
): Record<string, string> {
  let params: Record<string, string> = {}
  for (let [k, v] of Object.entries(errors)) {
    params[`fe_${k}`] = v
  }
  return params
}

export function decodeFieldErrors(
  keys: readonly string[],
  url: URL
): Record<string, string> | undefined {
  let errors: Record<string, string> = {}
  let hasAny = false
  for (let key of keys) {
    let val = url.searchParams.get(`fe_${key}`)
    if (val !== null) {
      errors[key] = val
      hasAny = true
    }
  }
  return hasAny ? errors : undefined
}
```

### Controller: Encode on Failure, Decode on Render

```typescript
const FORM_KEYS = ['title', 'date', 'resource_id'] as const

// On validation failure in an action
if (!parsed.success) {
  let fv = encodeFormValues(FORM_KEYS, rawValues)
  let fe = encodeFieldErrors(fieldErrors)
  let url = buildRedirectUrl(baseHref, { ...fv, ...fe, editing: rowId })
  return redirect(url.toString())
}

// On page render (GET), decode from URL
let formValues = decodeFormValues(FORM_KEYS, context.url)
let fieldErrors = decodeFieldErrors(FORM_KEYS, context.url)

return context.render(
  <MyForm formValues={formValues} fieldErrors={fieldErrors} />
)
```

### Component: Decode on GET Render

The component receives the same `formValues` and `fieldErrors` props. The `decodeFormValues` helper extracts them from the URL on the next GET request:

```tsx
function EditPage(handle: Handle<EditPageProps>) {
  return () => {
    let { formValues } = handle.props

    // Value priority: URL-decoded formValues > row data > defaults
    let resolvedTitle = formValues?.title ?? (row ? row.title : undefined)

    return (
      <input name="title" value={resolvedTitle ?? ''} />
    )
  }
}
```

---

## Schema Validation: Choose the Right Approach

### `s.parse` — Throw on Failure (Avoid)

```typescript
// ❌ Don't use for form validation — throws, losing error details
try {
  parsed = s.parse(schema, formData)
} catch {
  return json({ ok: false, error: 'Invalid form data' }, { status: 400 })
}
```

### `s.parseSafe` + Declarative Schemas (Recommended)

Replace both `s.parse()` and custom validation functions with `s.parseSafe(schema, formData)` where the schema carries all rules via `.refine()` + `coerce.number()`:

```typescript
// ✅ Returns { success: true, value } or { success: false, issues }
// Schemas defined once in app/utils/*-schema.ts — reusable across controllers

let result = s.parseSafe(offeringSaveSchema, formData)

if (!result.success) {
  let fieldErrors = issuesToFieldErrors(result.issues)
  // Pattern 1: render(<Page fieldErrors={...} />, { status: 400 })
  // Pattern 2: redirect with fv_*/fe_* URL params
}

// result.value has coerced types — NO parseInt() needed!
let { resource_id, day, start_min, end_min } = result.value
```

### Schema with coerce.number() + .refine()

```typescript
// app/utils/offering-schema.ts — declarative, no hand-written validation
import * as s from 'remix/data-schema'
import * as coerce from 'remix/data-schema/coerce'

export const offeringSaveSchema = f.object({
  resource_id: f.field(
    coerce.number().refine((n) => n > 0, 'ist erforderlich.'),
  ),
  start_min: f.field(
    coerce.number().refine((n) => n >= 0 && n <= 1380 && n % 60 === 0, 'ist ungültig.'),
  ),
  day: f.field(
    s.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), 'Gültiges Datum erforderlich.'),
  ),
})
```

### `coerce.number()` Empty-Select Pitfall

When a `<select>` has a disabled placeholder option (`<option value="">`), the browser sends `""`. `coerce.number()` fails immediately with **English** `"Expected number"` before `.refine()` can produce a **German** message. See `.agents/knowledge/remix3-coerce-number-empty-select-messages.md`.

**Fix:** Pre-check empty selects in the controller before `parseSafe`:

```typescript
let resourceIdRaw = (formData.get('resource_id') as string) ?? ''
if (!resourceIdRaw.trim()) {
  return buildErrorRedirect(formValues, gridValues, {
    creating: true, fieldErrors: { resource_id: 'ist erforderlich.' }
  })
}
```

### Shared Utilities: `app/utils/schema-utils.ts`

Instead of local `issuesToFieldErrors` and `extractFormValues` functions, import from the shared module:

```typescript
import { issuesToFieldErrors, readFormFieldValues } from '../utils/schema-utils.ts'

let formValues = readFormFieldValues(KEYS, formData)
let result = s.parseSafe(schema, formData)
if (!result.success) {
  let fieldErrors = issuesToFieldErrors(result.issues)
  // ...
}
```

The shared `readFormFieldValues` is equivalent to the old `extractFormValues` — reads raw string values from FormData before coercion, preserving exactly what the user typed.

### Cross-Field Validation

Cross-field rules (e.g., `endMin > startMin`) remain as manual post-parse checks in the controller, matching the timeboxer demo pattern for domain validations that involve multiple fields:

```typescript
if (result.value.end_min <= result.value.start_min) {
  return buildErrorRedirect(formValues, gridValues, {
    editing: id, fieldErrors: { end_min: 'muss nach der Startzeit liegen.' }
  })
}
```

---

## Testing Form Validation

### Test Validation Failure Returns 400 HTML

```typescript
it('POST /client with short name returns 400 with field error', async () => {
  let body = new URLSearchParams({
    name: 'Bob',         // too short (minLength 8)
    email: 'bob@test.com',
    _csrf: csrfToken!,
  })

  let response = await router.fetch('https://remix.run/client', {
    method: 'POST',
    body,
    redirect: 'manual',
    headers: authHeaders(),
  })

  assert.equal(response.status, 400)

  let html = await response.text()
  // Assert error messaging
  assert.ok(html.includes('New Record'), 'should show create form')
  // Assert value preservation
  assert.ok(html.includes('value="Bob"'), 'should preserve submitted name')
  assert.ok(html.includes('value="bob@test.com"'), 'should preserve submitted email')
  // Assert error message appears
  assert.ok(html.includes('should be at least 8'), 'should show validation error')
})
```

### Test Successful Validation Redirects

```typescript
it('POST /client creates a row and redirects', async () => {
  let body = new URLSearchParams({
    name: 'ValidNameHere',  // 8+ chars
    email: 'valid@test.com',
    _csrf: csrfToken!,
  })

  let response = await router.fetch('https://remix.run/client', {
    method: 'POST',
    body,
    redirect: 'manual',
    headers: authHeaders(),
  })

  assert.equal(response.status, 302)
  let location = response.headers.get('Location') || ''
  assert.ok(location.startsWith('/client'), 'should redirect after create')
})
```

**Key testing patterns:**
- Use `redirect: 'manual'` to inspect response before following redirects
- Assert `response.status` is 400 for validation failures
- Search the response HTML for preserved form values and error messages
- For redirect patterns, search the `Location` header for `fv_`/`fe_` params

---

## Choosing Between Patterns

| Criteria | Pattern 1: Direct Re-Render | Pattern 2: URL Params |
|----------|---------------------------|----------------------|
| Form inside `<Frame>` | No | **Yes** |
| Form on full page | **Yes** (simpler) | Works but unnecessary |
| Grid/table inline edit | **Yes** | Works |
| Form values survive refresh | Yes (in server render) | **Yes** (in URL) |
| Browser back-button safe | No | **Yes** |
| Implementation complexity | Lower | Higher (need encode/decode) |

---

## Common Mistakes

1. **Using `s.parse` instead of `s.parseSafe`** — `parse` throws on validation failure, losing error details. Use `parseSafe` and check `.success`.
2. **Not preserving form values on failure** — Users must re-type all fields after a validation error. Always pass `formValues` back to the component.
3. **Forgetting `redirect: 'manual'` in tests** — Without it, the test follows the 302 redirect and cannot assert the 400 response.
4. **Select fields not showing preserved values** — In select dropdowns, `formValues` (from failed submit) must take priority over row data (from DB) for `selected` attributes.
5. **Mixing patterns incorrectly** — Don't return a 400 HTML re-render inside a Frame context; Frame navigation expects a redirect. Use Pattern 2 (URL params) for Frame-based forms.
6. **Using `type="email"` with custom validation** — HTML5 email validation may conflict with schema validation. Use `type="text"` and rely on schema-based `email()` check.
7. **Returning `context.json()` for admin form errors** — In Frame-based admin layouts, `context.json({ error }, 400)` renders raw JSON in the browser, not the form page. Always redirect with `?error=` param. See `admin-nutzer-controller.tsx` fix.
8. **`coerce.number()` on empty select values** — `<option value="">` sends `""` which `coerce.number()` rejects with English `"Expected number"` before `.refine()` can run. Pre-check empty selects in the controller. See `.agents/knowledge/remix3-coerce-number-empty-select-messages.md`.
9. **Dropping the `if (!result.success)` guard** — When restructuring controller actions, ensure the parseSafe success check remains before accessing `result.value`.

---

## Reference Files in This Codebase

- `newapp/app/actions/client/controller.tsx` — Pattern 1: Direct re-render with `parseSafe`
- `newapp/app/actions/client/controller.test.ts` — Tests for validation failure and value preservation
- `newapp/app/actions/client/create-page.tsx` — Component: error styling, field errors display, value preservation
- `newapp/app/actions/client/edit-page.tsx` — Component: error styling with row fallback
- `newapp/app/utils/schema-utils.ts` — Shared `issuesToFieldErrors()` and `readFormFieldValues()` utilities
- `newapp/app/utils/offering-schema.ts` — Declarative schema: `f.object()` + `coerce.number()` + `.refine()`
- `newapp/app/utils/appointment-schema.ts` — Declarative schema for appointments form validation
- `newapp/app/actions/admin-offerings-controller.tsx` — Pattern 2: parseSafe + redirect with fv_*/fe_* params
- `newapp/app/actions/admin-appointments-controller.tsx` — Pattern 2: parseSafe + redirect
- `newapp/app/utils/form-params.ts` — Pattern 2: encode/decode form values (`fv_` prefix) and field errors (`fe_` prefix)
- `newapp/app/ui/admin-offerings-create-page.tsx` — Component using `formValues`/`fieldErrors`/`formError` props
- `newapp/app/ui/admin-offerings-edit-page.tsx` — Component with error banner via `table.errorBanner`

## Related Knowledge Files

- `.agents/knowledge/remix3-parseSafe-declarative-schemas.md` — Full pattern: replacing hand-written validation with parseSafe + .refine()
- `.agents/knowledge/remix3-coerce-number-empty-select-messages.md` — Fix for English error messages from empty selects
- `.agents/knowledge/remix3-render-from-post-validation.md` — Why re-render-from-POST is the recommended Remix 3 pattern
- `.agents/knowledge/remix3-frame-layout-blocks-render-from-post.md` — Why Frame-based admin layouts can't re-render-from-POST
- `.agents/knowledge/form-values-preserve-frame-redirect-remix3.md` — Full guide on fv_/fe_ encoding for Frame-safe redirects
- `.agents/knowledge/per-field-errors-url-roundtrip-remix3.md` — fe_ prefix encoding pattern details
