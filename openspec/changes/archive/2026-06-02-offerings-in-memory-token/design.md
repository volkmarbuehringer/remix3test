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
{
  errors?.username ? (
    <small aria-describedby="username-error" mix={fieldErrorStyle}>
      {errors.username}
    </small>
  ) : null
}
```

The page component receives `errors: AuthFormErrors` (a typed `Record<string, string>`), renders per-field `<small>` elements with `aria-invalid`/`aria-describedby`, and preserves form values using `defaultValue={values?.name}`. For business-logic errors (e.g., "username taken"), the controller constructs the errors object directly.

The `social-auth` demo uses the same pattern but flattens issues to a single error string (simpler, fewer field-level details). The `bookstore` demo uses `session.flash('error', '...')` + `redirect(...)` for cross-request auth errors.

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
- The pattern is designed for later application to other admin forms (users, resources, etc.)

**Non-Goals:**

- No changes to `destroy`, `configSave`, or `weekGenerate` actions
- No switching to `remix/data-schema` `parseSafe` — the existing `validateOfferingForm` has custom business logic (day range checks, minute divisibility) that doesn't map cleanly to schema-based validation
- No client-side validation
- No changes to `admin-offering-configs-controller.tsx`
- No application of the pattern to other controllers yet (future changes)

## Decisions

### 1. Re-render from POST instead of redirect on validation failure

**Rationale**: This is Remix 3's recommended pattern (confirmed in `timeboxer` and `social-auth` demos). The controller calls `renderOfferingsPage(context, data)` directly — the browser shows the form with errors and preserved values without any URL change, redirect, or state encoding.

**Alternatives considered**:

- **302 redirect + URL params** (`fv_`/`fe_`): Current appointments approach. Rejected here because: URL bloat, visible field values, type-coercion bugs with PostgreSQL integers vs URL strings. Remix 3 demos don't use this.
- **In-memory token store**: Custom pattern not found in any Remix 3 demo or README. Adds stateful server-side dependency that doesn't survive restarts.
- **Session flash**: Remix 3's recommended approach for cross-request messages (used in `bookstore` demo). But for form value preservation, session flash stores all form values in the session cookie/filesystem, which causes race conditions with concurrent POST+GET on file-based session storage. Also, session flash is designed for one-off messages, not structured per-field error data.

### 2. Shared `ValidationResult` type in `app/utils/form-errors.ts`

Following Remix 3 conventions: utility modules in `app/utils/` should be pure, testable without a router or `Response`, and not import from `app/actions` or `remix/ui/server`.

```typescript
// app/utils/form-errors.ts
export interface ValidationOk {
  ok: true
}

export interface ValidationFail {
  ok: false
  fieldErrors: Record<string, string>
}

export type ValidationResult = ValidationOk | ValidationFail

export function fieldErrorsFromResult(
  result: ValidationResult,
): Record<string, string> | undefined {
  return result.ok ? undefined : result.fieldErrors
}
```

This type is designed to be used by any controller's `validateXForm()` function. The `fieldErrorsFromResult()` helper unwraps errors for the page component, returning `undefined` when validation passes.

### 3. Form value extraction from `FormData` (not URL params)

On the re-render path, submitted values are read from `context.formData` — the same `FormData` the controller already parsed. No encoding/decoding, no type coercion between URLs and DB types.

```typescript
// In the controller action, on validation failure:
let formValues = {
  resource_id: (formData.get('resource_id') as string) ?? '',
  day: (formData.get('day') as string) ?? '',
  start_min: (formData.get('start_min') as string) ?? '',
  end_min: (formData.get('end_min') as string) ?? '',
}
```

The form component uses the same value priority chain: `formValues > row > defaults`.

### 4. Business-rule errors still use 302 redirects

Errors from business rules (holiday, past-date, exclusion constraint) are not field-specific — they're form-level conditions that apply regardless of field values. These continue to use 302 redirects with `?error=` for consistency with the existing pattern. The page renders them as a banner via the `formError` prop.

The `backState`/`backParams` boilerplate is replaced with a `buildErrorRedirect(input)` helper that extracts grid state from the form's hidden `_offset`/`_sort`/`_order`/`_filter` fields.

### 5. Value priority chain for form inputs

`formValues` (from re-render on POST) → `row` (from DB for edit mode) → `defaults` (for create mode). Same pattern as `admin-appointments-form.tsx`. Uses `String()` coercion for select comparisons to avoid PostgreSQL `number` vs `string` bugs.

### 6. Page data loader extraction

Extract the index action's query logic into `loadOfferingPageData(context)`. This enables the create/update actions to re-render the full page with grid data on validation failure without duplicating the index query logic.

## Example: Create Action Before/After

### Before (current code)

```typescript
// admin-offerings-controller.tsx (current — 4 different error patterns)
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

  // ... parse resourceId, day, startMin, endMin ...

  if (hd.isHoliday(new Date(parsed.day + 'T00:00:00Z'))) {
    let backState = { offset: parsed._offset, sort: parsed._sort, ... }  // boilerplate
    let backParams = gridStateToParams(backState)                          // boilerplate
    backParams.set('creating', 'true')
    backParams.set('error', 'Dieses Datum ist ein Feiertag.')
    return new Response(null, { status: 302, headers: { Location: '...' } })  // redirect
  }

  if (isDateInPast(dayMs)) {
    let backState = { offset: parsed._offset, sort: parsed._sort, ... }  // boilerplate again
    // ... same pattern ...
  }

  // insert, handle exclusion, redirect on success
}
```

### After (proposed)

```typescript
// New: ValidationResult type from app/utils/form-errors.ts
import { type ValidationResult } from '../utils/form-errors.ts'

function validateOfferingForm(parsed: Record<string, string>): ValidationResult {
  let resourceId = parseInt(parsed.resource_id, 10)
  if (!resourceId || isNaN(resourceId)) {
    return { ok: false, fieldErrors: { resource_id: 'ist erforderlich.' } }
  }
  if (!parsed.day || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.day)) {
    return { ok: false, fieldErrors: { day: 'Gültiges Datum erforderlich (YYYY-MM-DD).' } }
  }
  let startMin = parseInt(parsed.start_min, 10)
  if (isNaN(startMin) || startMin < 0 || startMin > 1380 || startMin % 60 !== 0) {
    return { ok: false, fieldErrors: { start_min: 'ist ungültig.' } }
  }
  let endMin = parseInt(parsed.end_min, 10)
  if (isNaN(endMin) || endMin < 60 || endMin > 1440 || endMin % 60 !== 0) {
    return { ok: false, fieldErrors: { end_min: 'ist ungültig.' } }
  }
  if (endMin <= startMin) {
    return { ok: false, fieldErrors: { end_min: 'muss nach der Startzeit liegen.' } }
  }
  return { ok: true }
}

// Simplified create action
async create(context) {
  let formData = context.formData

  let parsed: Record<string, string>
  try {
    parsed = s.parse(offeringSaveSchema, formData) as Record<string, string>
  } catch {
    // Parse failure: re-render with form-level error banner
    let data = await loadOfferingPageData(context, {
      creating: true,
      formError: 'Ungültige Formulardaten.',
    })
    return renderOfferingsPage(context, data)
  }

  let validationResult = validateOfferingForm(parsed)
  if (!validationResult.ok) {
    // Validation failure: re-render with per-field errors + preserved values
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

  // Business-rule errors: still use redirect (not field-specific)
  if (hd.isHoliday(new Date(parsed.day + 'T00:00:00Z'))) {
    return buildErrorRedirect(parsed, { creating: true, error: 'Dieses Datum ist ein Feiertag.' })
  }
  if (isDateInPast(dayMs)) {
    return buildErrorRedirect(parsed, { error: 'Angebote in der Vergangenheit können nicht erstellt oder bearbeitet werden.' })
  }
  // ... insert, handle exclusion with buildErrorRedirect, redirect on success
}
```

### What changed

```
BEFORE (4 error patterns, scattered)          AFTER (2 patterns, unified)
─────────────────────────────────────         ──────────────────────────────

schema parse error → context.json(400)    →   renderOfferingsPage(data)
validation error  → context.json(400)     →   renderOfferingsPage(data) + per-field errors
holiday error     → redirect(a + b + c)   →   buildErrorRedirect(input)  (shared helper)
past-date error   → redirect(a + b + c)   →   buildErrorRedirect(input)
exclusion error   → redirect(a + b + c)   →   buildErrorRedirect(input)

4 different patterns                        2 clear patterns
  (JSON, JSON, redirect, redirect)            (re-render = form issues,
                                               redirect = business rules)
```

## Risks / Trade-offs

- **[Risk] Form state lost on browser refresh after error**: If the user refreshes after a validation error re-render, the browser warns "Confirm form resubmission" and the form reverts to initial state on re-submit. Mitigation: same behavior as today and same as Remix 3 auth demos (timeboxer, social-auth). Acceptable for admin tools.
- **[Risk] Double-fetching grid data on validation failure**: The re-render path calls `loadOfferingPageData()` which runs the full grid query. Mitigation: one extra DB query per validation failure — negligible for admin usage patterns.
- **[Trade-off] Select comparisons still need `String()`**: PostgreSQL integer columns vs form value strings. Mitigation: apply `String(a) === String(b)` pattern proven in `admin-appointments-form.tsx`.
