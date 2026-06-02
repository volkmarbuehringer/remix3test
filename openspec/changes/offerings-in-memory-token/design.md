## Context

The `admin-offerings-controller.tsx` handles CRUD at `/admin/offerings`. Form actions currently use inconsistent error handling:
- Schema parse errors → `context.json({ error }, 400)`
- Validation errors (`validateOfferingForm`) → `context.json({ error }, 400)`
- Business rule failures (holiday, past-date, exclusion constraint) → 302 redirect with `?error=...`

This split prevents form value preservation. The JSON responses require client-side JS to handle, and redirect-based errors don't preserve submitted values.

### Remix 3 Reference Patterns

The `timeboxer` auth demo (`~/remix/demos/timeboxer/app/controllers/auth/controller.tsx`) demonstrates the recommended validation pattern:

```ts
// timeboxer auth demo — login action (lines 78-86)
let parsed = s.parseSafe(credentialsSchema, context.get(FormData))

if (!parsed.success) {
  return render(
    <LoginPage errors={issuesToErrors(parsed.issues)} />,
    context.request,
    { status: 400 },
  )
}
```

```tsx
// timeboxer auth demo — per-field error rendering (pages.tsx:148-185)
{errors?.username ? (
  <small aria-describedby="username-error" mix={fieldErrorStyle}>
    {errors.username}
  </small>
) : null}
```

The page component receives `errors: AuthFormErrors` (a typed `Record<string, string>`), renders per-field `<small>` elements with `aria-invalid`/`aria-describedby`, and preserves form values using `defaultValue={values?.name}`.

**Key takeaway: Remix 3's recommended approach is re-render from POST, not redirect.** The browser's form state is naturally preserved because the URL stays the same.

### Existing Codebase Patterns

The `admin-appointments-controller.tsx` already has `validateAppointmentForm` returning `{ ok: true } | { ok: false, fieldErrors: Record<string, string> }`. The form component (`admin-appointments-form.tsx`) renders per-field inline errors with `input.error` CSS mixin. This change standardizes that pattern into a shared utility and applies it to offerings.

## Goals / Non-Goals

**Goals:**
- Establish a shared `form-errors.ts` utility with `ValidationResult` type and `fieldErrorsFromResult()` helper
- Apply the pattern to `admin-offerings`: change `validateOfferingForm` return type, re-render from POST on validation failure
- Preserve submitted form values via `formValues` prop (read from `context.formData`)
- Render per-field inline errors with `input.error` mixin on errored fields
- Render `formError` banner for business-rule failures
- Remove manual grid state reconstruction from error paths

**Non-Goals:**
- No changes to `destroy`, `configSave`, or `weekGenerate` actions
- No switching to `remix/data-schema` `parseSafe` — the existing `validateOfferingForm` has custom business logic (day range checks, minute divisibility) that doesn't map cleanly to schema-based validation
- No client-side validation
- No changes to `admin-offering-configs-controller.tsx`
- No application of the pattern to other controllers yet (future changes)

## Decisions

### 1. Re-render from POST instead of redirect on validation failure

This is Remix 3's recommended pattern (confirmed in `timeboxer` and `social-auth` demos). The controller calls `renderOfferingsPage(context, data)` directly — the browser shows the form with errors and preserved values without any URL change, redirect, or state encoding.

Alternatives considered:
- **302 redirect + URL params** (`fv_`/`fe_`): Current appointments approach. Rejected here because: URL bloat, visible field values, type-coercion bugs with PostgreSQL integers vs URL strings. Remix 3 demos don't use this.
- **In-memory token store**: Custom pattern not found in any Remix 3 demo or README. Adds stateful server-side dependency.
- **Session flash**: Remix 3's recommended approach for cross-request messages (used in `bookstore` demo). But for form value preservation, file-based session storage has race conditions.

### 2. Shared `ValidationResult` type in `app/utils/form-errors.ts`

Following Remix 3 conventions: utility modules in `app/utils/` should be pure, testable without a router or `Response`, and not import from `app/actions` or `remix/ui/server`.

```typescript
// app/utils/form-errors.ts
export interface ValidationOk { ok: true }
export interface ValidationFail { ok: false; fieldErrors: Record<string, string> }
export type ValidationResult = ValidationOk | ValidationFail

export function fieldErrorsFromResult(result: ValidationResult): Record<string, string> | undefined {
  return result.ok ? undefined : result.fieldErrors
}
```

### 3. Form value extraction from `FormData` (not URL params)

On the re-render path, submitted values are read from `context.formData`. No encoding/decoding, no type coercion between URLs and DB types.

### 4. Business-rule errors still use 302 redirects

Errors from business rules (holiday, past-date, exclusion constraint) are not field-specific. These continue to use 302 redirects with `?error=` via a shared `buildErrorRedirect(input)` helper.

### 5. Value priority chain for form inputs

`formValues` (from re-render on POST) → `row` (from DB for edit mode) → `defaults` (for create mode). Uses `String()` coercion for select comparisons.

### 6. Page data loader extraction

Extract the index action's query logic into `loadOfferingPageData(context)` so create/update can re-render the full page with grid data on validation failure.

## Example: Create Action Before/After

### Before (current code)

```typescript
async create(context) {
  let formData = context.formData
  let parsed: Record<string, string>
  try {
    parsed = s.parse(offeringSaveSchema, formData) as Record<string, string>
  } catch {
    return context.json({ ok: false, error: 'Ungültige Formulardaten.' }, { status: 400 })  // JSON
  }

  let validationError = validateOfferingForm(parsed)  // returns string | null
  if (validationError) {
    return context.json({ ok: false, error: validationError }, { status: 400 })  // JSON
  }

  if (hd.isHoliday(new Date(parsed.day + 'T00:00:00Z'))) {
    let backState = { offset: parsed._offset, sort: parsed._sort, ... }  // boilerplate
    let backParams = gridStateToParams(backState)
    backParams.set('creating', 'true')
    backParams.set('error', 'Dieses Datum ist ein Feiertag.')
    return new Response(null, { status: 302, headers: { Location: '...' } })  // redirect
  }
  // ... same boilerplate for past-date and exclusion ...
}
```

### After (proposed)

```typescript
async create(context) {
  let formData = context.formData
  let parsed: Record<string, string>
  try {
    parsed = s.parse(offeringSaveSchema, formData) as Record<string, string>
  } catch {
    let data = await loadOfferingPageData(context, { creating: true, formError: 'Ungültige Formulardaten.' })
    return renderOfferingsPage(context, data)
  }

  let validationResult = validateOfferingForm(parsed)  // returns ValidationResult
  if (!validationResult.ok) {
    let formValues = readOfferingFormValues(formData)
    let data = await loadOfferingPageData(context, {
      creating: true,
      formValues,
      fieldErrors: validationResult.fieldErrors,
      offset: Number(parsed._offset) || 0,
      sortColumn: parsed._sort || 'ao.day',
      sortDirection: (parsed._order || 'asc') as 'asc' | 'desc',
      filter: parsed._filter || undefined,
    })
    return renderOfferingsPage(context, data)
  }

  // ... parse resourceId, day, startMin, endMin ...

  if (hd.isHoliday(new Date(parsed.day + 'T00:00:00Z'))) {
    return buildErrorRedirect(parsed, { creating: true, error: 'Dieses Datum ist ein Feiertag.' })
  }
  if (isDateInPast(dayMs)) {
    return buildErrorRedirect(parsed, { error: 'Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden.' })
  }
  // ... insert, handle exclusion with buildErrorRedirect, redirect on success
}
```

## Risks / Trade-offs

- **[Risk] Form state lost on browser refresh after error**: Browser warns "Confirm form resubmission" and form reverts to initial state on re-submit. Mitigation: same behavior as today and same as Remix 3 auth demos. Acceptable for admin tools.
- **[Risk] Double-fetching grid data on validation failure**: Re-render calls `loadOfferingPageData()` which runs the full grid query. Mitigation: one extra DB query — negligible for admin usage.
- **[Trade-off] Select comparisons still need `String()`**: Apply `String(a) === String(b)` pattern proven in `admin-appointments-form.tsx`.
