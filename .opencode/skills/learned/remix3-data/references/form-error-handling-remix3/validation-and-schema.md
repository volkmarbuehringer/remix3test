# Validation and Schema

## What This Covers

The `parseSafe`-based direct re-render pattern and the schema traps that come with it. Read this when the task involves:

- Re-rendering a form with `status: 400`, `formValues`, and `fieldErrors`
- Preserving values in inputs and `<select>` elements
- Using `parseSafe` with declarative schemas
- The `coerce.number()` empty-select pitfall and Postgres `number` vs URL `string` mismatch
- Cross-field validation and multi-step wizard state on POST
- Testing validation failure (400) and success (302)

For admin grid state and the 200-vs-400 grid path, see `admin-grid-state.md`.

## Pattern: direct re-render

Use the guide's `parseSafe` re-render pattern (`node_modules/remix/guides/09-forms-and-mutations.md` §"Return validation failures with the form"): parse first, and on failure re-render with the raw submitted values plus per-field issues and `{ status: 400 }`. The deltas below are what the guide cannot know.

**Value priority:** on failure, `formValues` (raw submitted strings) > row data (DB) > defaults. Read them in the render function, not the factory closure — a clientEntry keeps setup state across frame reloads (see `remix3-ui § Frames`).

### Select Fields: Preserve Selection

When `formValues` are present (validation failure), use them for `selected`; otherwise fall back to the row value:

```tsx
<option value="Admin" selected={formValues?.role !== undefined ? formValues.role === 'Admin' : row.role === 'Admin'}>
```

**Note:** React's `defaultValue` attribute on `<select>` does NOT work in Remix 3's template system. `remix/component` compiles to HTML string output and passes `defaultValue` through as a non-standard HTML attribute on `<select>`, where browsers ignore it. Always use `selected` on individual `<option>` elements — `selected={true}` adds it, `selected={false}` omits it.

## Schema Validation

Use `s.parseSafe` (never `s.parse`) with declarative `app/utils/*-schema.ts` schemas — the guide's §"Parse and save the submitted form" is canonical. The app deltas follow.

### Localize Built-In Check Messages by `code`, Not `message`

`s.parseSafe(schema, value, { errorMap })` is the only place a vendor check's `code`
(`string.min_length`, `string.max_length`, `string.email`, `enum.invalid_value`, ...)
reaches application code: Standard Schema issues expose only `message` and `path`, and
`createIssue()` drops the code before returning them. Comparing the English default
message to translate it breaks whenever the vendor rewords a check, and silently falls
back to English when it does.

```ts
let parsed = s.parseSafe(clientSaveSchema, formData, { errorMap: clientErrorMap })
```

- `refine()` **with an explicit message** bypasses `errorMap` (the message is already
  final); `refine()` without one emits `refine.failed` and goes through the map.
- `path[0]` distinguishes fields that share a code — `name` and `email` both use
  `string.max_length`, so the same code needs different German copy per field.
- Keep `issuesToFieldErrors(parsed.issues)` for the field→message map; the messages are
  already localized at parse time.
- Reference implementation + regression test: `app/actions/client/controller.tsx:105`
  (`clientErrorMap`), `app/actions/client/controller.test.ts`.

### Schema with coerce.number() + .refine()

Declarative schema in `app/utils/offering-schema.ts:8` (`offeringSaveSchema`) — `f.object` + `f.field`, `coerce.number().refine(...)` for ids/minutes, and `s.string().refine(...)` for the date. No hand-written validation.

### `coerce.number()` Empty-Select Pitfall

When a `<select>` has a disabled placeholder option (`<option value="">`), the browser sends `""`. `coerce.number()` fails immediately with **English** `"Expected number"` before `.refine()` can produce a **German** message.

From the `coerce.js` source:

```
// Empty string → immediate failure, .refine() never runs
if (trimmed.length === 0) return fail('Expected number', ...)
```

**Fix:** pre-check empty select values in the controller before `parseSafe` (e.g. `app/actions/verwaltung/appointments/controller.tsx:339`), returning the 400 re-render with `fieldErrors: { resource_id: 'ist erforderlich.' }`.

**Failed approach:** `s.string().refine(...).pipe(coerce.number()).refine(...)` — TypeScript fails because `.refine()` after `.pipe()` still expects the string type predicate:

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

`<option selected={resolvedId === res.id}>` silently fails when `res.id` is a `number` from PostgreSQL but `resolvedId` is a `string` from URL params. PostgreSQL `integer` columns return as JS `number` through `pg`, while `URLSearchParams.get()` and `FormData.get()` always return strings. `===` is strict — `"5" === 5` → `false`.

Use `String()` on both sides:

```tsx
// ✅ Works for both number and string types
<option selected={resolvedId != null && String(resolvedId) === String(res.id)}>
```

Detection: if a `<select>` shows the wrong option after a validation redirect but works on initial load, the runtime types likely differ. Log `typeof res.id` vs `typeof resolvedResourceId` to confirm.

### `selected` and empty strings: `""` is not `null`

`<option selected={resolvedId != null && String(resolvedId) === String(res.id)}>` is
still wrong when the preserved value is an empty string. A cleared `<select>`
submits `""`; `"" != null` is `true`, so no resource option matches and the browser
falls back to the **first** option — the field visually shows a choice while the
inline error says `ist erforderlich.`.

Normalize "no value" once and give the select a real disabled placeholder option
selected exactly when empty:

```tsx
let resourceValue =
  resolvedResourceId != null && String(resolvedResourceId) !== "" ? String(resolvedResourceId) : ""

<select name="resource_id" required>
  <option value="" disabled selected={resourceValue === ""}>Ressource auswählen...</option>
  {resources.map((res) => (
    <option key={res.id} value={res.id} selected={resourceValue !== "" && resourceValue === String(res.id)}>
      {res.name}
    </option>
  ))}
</select>
```

Render the placeholder in **both** create and edit modes: edit mode also re-renders
from `formValues` on a failed submit, and the same empty-string fallback would
otherwise show the first row.

### Multi-Source Fields: Pick the Source, Then Validate

When two controls feed one setting — the page-size preset `<select name="pageSize">`
plus the optional free-form `<input name="pageSizeCustom">` in
`app/utils/get-page-size.ts` — parse both as defaulted strings, pick the source in a
`.transform()`, then validate the **selected** value. Validating each field
independently cannot express "custom wins when filled": a required `pageSize` rejects a
custom-only submit, and two always-valid strings let an invalid custom value reach the
controller.

```ts
const pageSizeSubmission = f
  .object({
    pageKey: f.field(s.defaulted(s.string(), '')),
    pageSize: f.field(s.defaulted(s.string(), '')),
    pageSizeCustom: f.field(s.defaulted(s.string(), '')),
  })
  .transform((value) => ({
    pageKey: value.pageKey,
    rawPageSize: value.pageSizeCustom.trim() !== '' ? value.pageSizeCustom : value.pageSize,
  }))

export const pageSizeFormSchema = pageSizeSubmission
  .refine(
    (value) => isValidPageSize(Number(value.rawPageSize)),
    `Ganze Zahl zwischen ${PAGE_SIZE_MIN} und ${PAGE_SIZE_MAX} erforderlich.`,
  )
  .transform((value) => ({ pageKey: value.pageKey, pageSize: Number(value.rawPageSize) }))
```

- The first `.transform()` selects the source; it must not validate.
- `.refine()` runs on the selected value, so an invalid custom field fails even when the
  select is valid. `Number('')` and `Number('  ')` are `0`, so "both blank" fails too.
- The final `.transform()` restores the original parsed shape
  (`{ pageKey, pageSize: number }`), so controllers and `s.parseSafe` tests need no change.
- Both fields live in the same `<form>`. The custom input uses
  `type="number" min={PAGE_SIZE_MIN} max={PAGE_SIZE_MAX} step={1} inputMode="numeric"` so
  the browser blocks out-of-range/fractional values before the POST.
- A saved value outside the presets must still render as the selected option
  (`pageSizeOptions(current)` in `app/utils/get-page-size.ts`); otherwise a legacy custom
  size silently jumps to a preset.
- `s.defaulted` is safe here because it wraps only `s.string()`; the range check lives on
  the object-level `.refine()` **after** the source-selection transform, so the default
  path is still validated.

**Test anchors:** `app/utils/page-size.test.ts` ("prefers the free-form custom size over
the preset select", "falls back to the preset when the custom field is blank", "rejects
an invalid custom size even when the select is valid"); `app/actions/notifications/controller.test.ts`
and `app/actions/admin/admin-page-size.test.ts` cover the POST round-trip.

### Announce and focus server-rendered errors

Server-rendered field errors are not announced by default, and focus stays where it
was before the frame re-render. Add all three:

- `role="alert"` on each error element and on the form-level banner.
- `aria-invalid="true"` plus `aria-describedby` pointing at the error element id on
  the rejected control. Use the **string** `aria-invalid="true"`; Remix 3 renders
  `aria-invalid={true}` as a bare `aria-invalid` attribute, which is not a valid ARIA value.
- Render `FormErrorFocus` from `app/ui/form-error-focus.browser.tsx:10` inside the form; it focuses the first `[aria-invalid="true"]` within `el.closest("form")` and is a no-op on a clean page.

### Shared Utilities: `app/utils/schema-utils.ts`

Instead of local `issuesToFieldErrors` and `extractFormValues` functions, import from `app/utils/schema-utils.ts`. The shared `readFormFieldValues` is equivalent to the old `extractFormValues` — it reads raw string values from FormData before coercion, preserving exactly what the user typed.

### Cross-Field Validation

Cross-field rules (e.g. `endMin > startMin`) remain manual post-parse checks in the controller, matching the timeboxer demo pattern for domain validations that involve multiple fields. Return the 400 re-render with both `formError` and the field error (reference: `app/actions/verwaltung/appointments/controller.tsx:375`).

### Multi-Step Wizard State Preservation

In a multi-step wizard, POST has no query params, so `context.url.searchParams` is empty on a validation re-render and URL-derived wizard data (offerings, slots) breaks. Extract `resource_id`, `day`, and `step` from `formData` at the top of the action, pass them as loader overrides on every error path, and let the loader fall back to URL params for GET. Reference: `app/actions/appointments-new/controller.tsx:224` (`wizardResourceId`/`wizardDay`).

## Testing Form Validation

- Pass `redirect: 'manual'` to `router.fetch`; otherwise the test follows the 302 and cannot assert the 400 response.
- Include `_csrf` in the `URLSearchParams` body for CSRF-protected routes.
- Assert the 400 status, preserved `value="..."` in the returned HTML, and the localized error text. For success, assert the 302 `Location` header.
- Reference tests: `app/actions/client/controller.test.ts`.
