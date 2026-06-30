# Form Error Handling in Remix 3

## Overview

Handle form validation errors in Remix 3 controllers and components. This skill covers the **direct re-render** pattern (preferred) using `parseSafe` from `remix/data-schema` to make validation failures a return value instead of an exception.

The URL param roundtrip pattern (`fv_`/`fe_` encoding) is deprecated — `form-params.ts` has been removed from the codebase and all verwaltung forms now use direct re-render. See the "Migration from URL Params" section if you encounter legacy code.

## When To Use This Skill

- Adding validation to a POST/PUT/DELETE form action
- Rendering per-field error messages next to form inputs
- Preserving submitted form values after a validation failure
- Migrating legacy code from URL-param roundtrip to direct re-render
- Testing form validation controller behavior

---

## Pattern 1: Direct Re-Render (Primary Pattern)

Use this pattern for all forms. On validation failure, re-render the page with `status: 400`, passing `formValues` and `fieldErrors` as props.

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

**Note:** React's `defaultValue` attribute on `<select>` does NOT work in Remix 3's template system. Remix 3's `remix/ui` runtime compiles to HTML string output and passes `defaultValue` through as a non-standard HTML attribute on `<select>`, where browsers ignore it. Always use `selected` on individual `<option>` elements — `selected={true}` adds it, `selected={false}` omits it. See Common Mistake #4.

> _Consolidated from: remix3-select-default-value_

---

## Pattern 2: URL Param Roundtrip (DEPRECATED)

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

## Migration from URL Params to Direct Re-Render

When migrating a controller from Pattern 2 to Pattern 1:

**1. Replace redirect with re-render in controller actions**

Replace every `buildErrorRedirectUrl()` call + 302 redirect with:

```typescript
let data = await loadPageData(context, {
  creating: true,
  formValues,
  fieldErrors,
  formError: 'Error message',
  offset: gridStateOffset(gridValues),
  sortColumn: gridStateSort(gridValues),
  sortDirection: gridStateDirection(gridValues),
  filter: gridStateFilter(gridValues),
})
return renderPage(context, data, { status: 400 })
```

**2. Add `ResponseInit` to the render helper**

```typescript
function renderPage(context: AppContext, data: PageData, init?: ResponseInit): Response {
  return renderLayout(context.render, <PageComponent ... />, init)
}
```

**3. Remove URL-param decoding from data loader**

```typescript
// BEFORE (Pattern 2)
let formValues = overrides?.formValues ?? decodeFormValues(KEYS, context.url)
let fieldErrors = overrides?.fieldErrors ?? decodeFieldErrors(KEYS, context.url)
let formError = overrides?.formError ?? error
// AFTER (Pattern 1)
let formValues = overrides?.formValues ?? undefined
let fieldErrors = overrides?.fieldErrors ?? undefined
let formError = overrides?.formError ?? undefined
```

**4. Delete `form-params.ts` after verifying no remaining consumers**

```bash
grep -r "form-params" newapp/  # Should return nothing
rm newapp/app/utils/form-params.ts
```

**5. Update tests: 302 → 400, remove Location header checks**

```typescript
// BEFORE: assert.equal(response.status, 302)
// AFTER: assert.equal(response.status, 400)
// Remove: response.headers.get('Location') checks for error content
```

**6. Use `gridStateFromFormData` with extractors**

```typescript
import { gridStateFromFormData, gridStateOffset, gridStateSort, gridStateDirection, gridStateFilter } from '../utils/grid-state.ts'
let gridValues = gridStateFromFormData(formData)
// Pass extractors to loadPageData overrides
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

When a `<select>` has a disabled placeholder option (`<option value="">`), the browser sends `""`. `coerce.number()` fails immediately with **English** `"Expected number"` before `.refine()` can produce a **German** message.

From the `coerce.js` source:
```
// Empty string → immediate failure, .refine() never runs
if (trimmed.length === 0) return fail('Expected number', ...)
```

**Fix:** Pre-check empty select values in the controller before calling `parseSafe`:

```typescript
let resourceIdRaw = (formData.get('resource_id') as string) ?? ''
if (!resourceIdRaw.trim()) {
  return buildErrorRedirect(formValues, gridValues, {
    creating: true,
    fieldErrors: { resource_id: 'ist erforderlich.' }
  })
}

// Only reaches parseSafe if resource_id is non-empty
let result = s.parseSafe(offeringSaveSchema, formData)
```

**Failed Approaches:**

`s.string().refine(...).pipe(coerce.number()).refine(...)` — TypeScript fails because `.refine()` after `.pipe()` still expects the string type predicate:

```typescript
// Does NOT work:
f.field(
  s.string()
    .refine(v => v.trim() !== '', 'ist erforderlich.')
    .pipe(coerce.number())    // ← changes type to number
    .refine(n => n > 0, ...)  // ← .refine() still expects string type
)
```

**Related: PostgreSQL integer vs URL string type coercion in `<option selected>`**

A separate but related select trap: `<option selected={resolvedId === res.id}>` silently fails when `res.id` is a `number` from PostgreSQL but `resolvedId` is a `string` from URL params. PostgreSQL `integer` columns return as JS `number` through `pg`, while `URLSearchParams.get()` and `FormData.get()` always return strings. `===` is strict — `"5" === 5` → `false`.

Use `String()` on both sides to handle the mismatch:

```tsx
// ✅ Works for both number and string types
<option selected={resolvedId != null && String(resolvedId) === String(res.id)}>
```

Detection: if a `<select>` shows the wrong option after a validation redirect but works on initial load, the runtime types likely differ. Log `typeof res.id` vs `typeof resolvedResourceId` to confirm.

> _Consolidated from: remix3-coerce-number-empty-select-messages_

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
  let data = await loadPageData(context, {
    creating: true,
    formValues,
    formError: 'muss nach der Startzeit liegen.',
    fieldErrors: { end_min: 'muss nach der Startzeit liegen.' },
    offset: gridStateOffset(gridValues),
    sortColumn: gridStateSort(gridValues),
    sortDirection: gridStateDirection(gridValues),
    filter: gridStateFilter(gridValues),
  })
  return renderPage(context, data, { status: 400 })
}
```

### Multi-Step Wizard State Preservation

In a Remix multi-step wizard, form submissions are POST requests. When validation fails and the action re-renders the page, `context.url.searchParams` is empty (POST has no query params). Wizard context values like `resource_id`, `day`, and `step` are only in `formData`, not the URL. If the shared data loader uses URL params to derive wizard data (offerings, time slots), the re-rendered page will have broken UI — empty dropdowns, missing computed data.

**Solution:** Extract wizard context from `formData` at the top of the action handler, and pass them explicitly as overrides to the data loading function on every error re-render path.

```typescript
// In the action handler:
let formData = context.formData

// Extract wizard context from hidden form fields
let wizardResourceId = (formData.get('resource_id') as string) || undefined
let dateRaw = (formData.get('date') as string) || undefined
let wizardDay = dateRaw ? new Date(dateRaw + 'T00:00:00Z').getTime() : undefined

// Pass to every error re-render:
let data = await loadPageData(context, userId, {
  step: 3,
  wizardResourceId,
  wizardDay,
  formValues,
  fieldErrors,
  formError: 'Validation failed.',
})
return renderPage(context, data, { status: 400 })
```

The data loader then uses `overrides.wizardResourceId` and `overrides.wizardDay` (falling back to URL params for GET requests):

```typescript
let wizardResourceId = overrides?.wizardResourceId
  ?? context.url.searchParams.get('resource_id')
  ?? undefined

let wizardDayStr = overrides?.wizardDay !== undefined
  ? String(overrides.wizardDay)
  : (context.url.searchParams.get('day') || undefined)
```

> _Consolidated from: remix-wizard-post-validate-state_

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

**Use Pattern 1 (Direct Re-Render) for all new code.** Pattern 2 is deprecated and should only be used as reference when reading legacy code.

| Criteria | Pattern 1: Direct Re-Render | Pattern 2: URL Params (DEPRECATED) |
|----------|---------------------------|------------------------------------|
| Form values preserved | Yes (in server render) | Yes (in URL) |
| Implementation complexity | Lower | Higher (need encode/decode) |
| Browser URL clean on error | Yes | No (bloated with fv_/fe_ params) |
| Grid state preserved | Yes (via overrides) | Yes (in URL) |
| HTTP semantics | Correct (400) | Incorrect (302) |

---

## Admin Forms: Grid State Preservation

Admin CRUD forms often have sort/filter/pagination state that must survive POST error re-renders. Use hidden form inputs + a shared `loadPageData` override pattern.

### Shared Page Data Loader

Extract a `loadXxxPageData(context, overrides?)` function serving both GET index and POST error re-render:

```typescript
interface PageData {
  rows: Row[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow: Row | null
  creating: boolean
  formValues?: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
}

async function loadPageData(
  context: AppContext,
  overrides?: Partial<Pick<PageData, 'creating' | 'editRow' | 'formValues' | 'fieldErrors' | 'formError' | 'offset' | 'sortColumn' | 'sortDirection' | 'filter'>>,
): Promise<PageData> {
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined
  // Sort, query, paginate...
  return {
    rows, offset, hasMore, prevOffset, nextOffset, sortColumn, sortDirection, filter,
    editRow, creating,
    formValues: overrides?.formValues,
    fieldErrors: overrides?.fieldErrors,
    formError: overrides?.formError,
  }
}
```

Key pattern: `overrides?.foo ?? urlParam` — override takes precedence, URL param is fallback.

### Grid State from FormData

Hidden inputs carry sort/filter/pagination state across POST. Use `app/utils/grid-state.ts`:

```typescript
import {
  gridStateFromFormData,  // from FormData
  gridStateToParams,      // to URLSearchParams
  gridStateOffset,        // to number | undefined
  gridStateSort,          // to string | undefined
  gridStateDirection,     // to 'asc' | 'desc' | undefined
  gridStateFilter,        // to string | undefined
  type GridState,
} from '../utils/grid-state.ts'

let gridValues = gridStateFromFormData(formData)
let data = await loadPageData(context, {
  creating: true,
  formValues,
  fieldErrors,
  offset: gridStateOffset(gridValues),
  sortColumn: gridStateSort(gridValues),
  sortDirection: gridStateDirection(gridValues),
  filter: gridStateFilter(gridValues),
})
return renderPage(context, data, { status: 400 })
```

### Form Error Banner Styles

Two distinct banners — page level (solid) and form level (subtle):

```css
/* Page-level (above table, no form active) */
table.errorBanner: {
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
}

/* Form-internal (inside form panel on validation failure) */
formErrorBanner: {
  background: `${theme.colors.action.danger.background}15`,  /* ~8% opacity */
  border: `1px solid ${theme.colors.action.danger.background}`,
  color: theme.colors.action.danger.background,
}
```

### Avoid Double Error Display

When a form panel is open, `formError` renders ONLY inside the form, NOT at page level. Use `!hasFormPanel` to gate:

```tsx
// Page-level grid section — hidden when form is open
{!hasFormPanel && formError ? <div mix={table.errorBanner}>{formError}</div> : null}
{!hasFormPanel && error ? <div mix={table.errorBanner}>{error}</div> : null}

// Inside the form component
{formError ? <div mix={formErrorBanner}>{formError}</div> : null}
```

Keep `formError` (form validation) and `error` (destroy flow) strictly separate — never chain them.

### JSX Text Content Warning

Unicode escapes like `\u00e4` are NOT interpreted in JSX text content (only in `{}` expressions). Use actual UTF-8 characters or a JSX expression:

```tsx
// WRONG — renders literal "\u00e4" in browser
<option>ausw\u00e4hlen</option>

// RIGHT
<option>auswählen</option>
<option>{'ausw\u00e4hlen'}</option>
```

---

## Common Mistakes

1. **Using `s.parse` instead of `s.parseSafe`** — `parse` throws on validation failure, losing error details. Use `parseSafe` and check `.success`.
2. **Not preserving form values on failure** — Users must re-type all fields after a validation error. Always pass `formValues` back to the component.
3. **Forgetting `redirect: 'manual'` in tests** — Without it, the test follows the 302 redirect and cannot assert the 400 response.
4. **Select fields not showing preserved values** — In select dropdowns, `formValues` (from failed submit) must take priority over row data (from DB) for `selected` attributes. Also, `defaultValue` on `<select>` does NOT work in Remix 3 — use `selected` on `<option>` instead. See "Select Fields: Preserve Selection" section above.
5. **Mixing patterns incorrectly** — Don't return a 400 HTML re-render inside a Frame context; Frame navigation expects a redirect. Use Pattern 2 (URL params) for Frame-based forms.
6. **Using `type="email"` with custom validation** — HTML5 email validation may conflict with schema validation. Use `type="text"` and rely on schema-based `email()` check.
7. **Returning `context.json()` for admin form errors** — In Frame-based admin layouts, `context.json({ error }, 400)` renders raw JSON in the browser, not the form page. Always redirect with `?error=` param. See `admin-nutzer-controller.tsx` fix.
8. **`coerce.number()` on empty select values** — `<option value="">` sends `""` which `coerce.number()` rejects with English `"Expected number"` before `.refine()` can run. Pre-check empty selects in the controller. Also watch for PostgreSQL `number` vs URL `string` type mismatch on `selected` — use `String()` coercion on both sides. See `coerce.number()` Empty-Select Pitfall section above.
9. **Dropping the `if (!result.success)` guard** — When restructuring controller actions, ensure the parseSafe success check remains before accessing `result.value`.

---

## URL-Param-Driven SQL Filter Checklist

Adding a new URL-query-param filter (e.g., `?status=pending`) that drives a SQL `WHERE` clause requires touching 8+ places across the controller, UI, forms, and wizard steps. Follow this touchpoint checklist in order:

### 1. GridState utility (`app/utils/grid-state.ts`)
- Add field to `GridState` interface
- Add reader in `gridStateFromURL`, `gridStateFromForm`, `gridStateFromFormData`
- Add writer in `gridStateToParams`
- Add accessor helper (`gridStateStatus()` pattern)

### 2. Controller — data layer (`app/actions/<route>/controller.tsx`)
- Import the gridState accessor
- Add field to data interface (`status?: string` in `AppointmentsNewPageData`)
- Add field to `load*PageData()` overrides `Pick<>` type
- Read from URL: `let val = overrides?.val ?? (context.url.searchParams.get('val') || undefined)`
- Add SQL `WHERE` clause (parameterized, after period/other filters)
- Return field in data object

### 3. Controller — render function
- Pass `val={data.val}` to the page component

### 4. Controller — thread through all action override calls
Every `load*PageData()` call with overrides needs `val: gridStateVal(gridValues)` — especially POST error paths where `context.url.searchParams` is empty. Check all:
- Rate limit errors
- Validation errors  
- Past date / business rule errors
- Exclusion constraint errors
- Not-found errors

Also add to explicit redirect URL params in wizard step transitions:
```
if (gridValues.val) params.set('val', gridValues.val)
```

### 5. UI — page component (`app/ui/<page>.tsx`)
- Add `val?: string` to props interface
- Destructure `val` from handle props
- Update local URL builder functions to accept and pass `val`
- Thread `val` through calls to imported URL builders (`buildSortUrl`, `buildPaginationUrl`, `buildCreateUrl`, `buildEditUrl`, `buildCancelUrl`)
- Add filter UI (button group, select, etc.)
- Add `val` to `GridStateHiddenInputs` state
- Pass `val` to sub-page components (edit, create panels)

### 6. Sub-page components
- **Edit page**: Add to props interface, add to `gridState` object
- **Create page**: Add to props interface, add to `gridState` object

### 7. Form component (`app/ui/<form>.tsx`)
- Destructure `val` from `gridState`
- Pass `val` to `buildCancelUrl()`

### 8. Wizard step components (if applicable)
- Add `_val` hidden input to each step's form
- Update local URL builder functions (`buildPeriodUrl`, `buildBackUrl`) to pass `gridState.val`
- Update "Abbrechen" links to use `buildCancelUrl` with `val` instead of bare base URL
- Import `buildCancelUrl` from `./mixins/admin-urls.ts`

### 9. Tests
- Test: default behavior (no param)
- Test: param set to each valid value
- Test: param filters correctly (verify content present/absent)
- For filters that exclude data (e.g., "expired"), insert test data directly via SQL if the controller blocks creation of matching records

> _Consolidated from: remix-url-param-sql-filter_

---

## Reference Files in This Codebase

- `newapp/app/actions/client/controller.tsx` — Pattern 1: Direct re-render with `parseSafe`
- `newapp/app/actions/client/controller.test.ts` — Tests for validation failure and value preservation
- `newapp/app/actions/client/create-page.tsx` — Component: error styling, field errors display, value preservation
- `newapp/app/actions/client/edit-page.tsx` — Component: error styling with row fallback
- `newapp/app/actions/admin-offerings-controller.tsx` — Pattern 1: re-render on error with grid state preservation
- `newapp/app/actions/admin-appointments-controller.tsx` — Pattern 1: migrated from URL params to direct re-render
- `newapp/app/actions/admin-resources-controller.tsx` — Pattern 1: re-render with inline errors
- `newapp/app/ui/admin-offerings-create-page.tsx` — Component with `formErrorBanner` (transparent bg + border)
- `newapp/app/ui/admin-appointments-form.tsx` — Component with `formErrorBanner` and inline field errors
- `newapp/app/utils/schema-utils.ts` — Shared `issuesToFieldErrors()` and `readFormFieldValues()` utilities
- `newapp/app/utils/offering-schema.ts` — Declarative schema: `f.object()` + `coerce.number()` + `.refine()`
- `newapp/app/utils/appointment-schema.ts` — Declarative schema for appointments form validation
- `newapp/app/utils/grid-state.ts` — Grid state helpers: `gridStateFromFormData`, extractors, `gridStateToParams`

## Related Knowledge Files

- `.agents/knowledge/remix3-parseSafe-declarative-schemas.md` — Full pattern: replacing hand-written validation with parseSafe + .refine()
- `.agents/knowledge/remix3-render-from-post-validation.md` — Why re-render-from-POST is the recommended Remix 3 pattern
- `.opencode/skills/learned/form-error-handling-remix3/SKILL.md` — Consolidated skill (this file): coerce.number() empty-select fix, select defaultValue vs selected, wizard POST state, URL-param SQL filter checklist
