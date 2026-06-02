# Phase 2: parseSafe + .refine() — declarative form validation

**Status**: Future consideration. Not started. Depends on Phase 1 (offerings-in-memory-token) proving the re-render-from-POST pattern works with this app's grid+form layout.

## What It Does

Replaces all custom `validateXForm()` functions across admin controllers with declarative `f.object` schemas using `s.parseSafe()` + `.refine()`. Eliminates hand-written validation code in favor of schema declarations with inline German error messages.

## Why

Remix 3's `remix/data-schema` supports `.refine()` for custom checks and `errorMap` for locale-aware messages. The `timeboxer` demo demonstrates the full pattern: `s.parseSafe(schema, formData)` → `issuesToErrors(issues)` → per-field errors. The Phase 1 approach (custom `validateXForm` returning `ValidationResult`) works, but each controller still needs a hand-written validation function. Phase 2 eliminates that.

## Example: What it would look like

```typescript
// app/utils/offering-schema.ts — replaces validateOfferingForm entirely

import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import * as coerce from 'remix/data-schema/coerce'

export let offeringSaveSchema = f.object({
  resource_id: f.field(
    coerce.number().refine((n) => n > 0 && Number.isFinite(n), 'ist erforderlich.'),
  ),
  day: f.field(
    s.string().refine(
      (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
      'Gültiges Datum erforderlich (YYYY-MM-DD).',
    ),
  ),
  start_min: f.field(
    coerce.number().refine(
      (n) => n >= 0 && n <= 1380 && n % 60 === 0,
      'ist ungültig.',
    ),
  ),
  end_min: f.field(
    coerce.number().refine(
      (n) => n >= 60 && n <= 1440 && n % 60 === 0,
      'ist ungültig.',
    ),
  ),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
}).refine(
  (v) => v.end_min > v.start_min,
  { message: 'muss nach der Startzeit liegen.', path: ['end_min'] },
)

// Controller usage:
let result = s.parseSafe(offeringSaveSchema, formData)
if (!result.success) {
  let fieldErrors = fieldErrorsFromIssues(result.issues) // shared helper
  let formValues = readOfferingFormValues(formData)
  let data = await loadOfferingPageData(context, {
    creating: true, formValues, fieldErrors, ...
  })
  return renderOfferingsPage(context, data)
}
```

## Migration Checklist

- [ ] `app/utils/form-issues.ts` — shared `fieldErrorsFromIssues(issues)` helper (maps `issue.path[0]` → field name)
- [ ] `app/utils/offering-schema.ts` — `f.object` schema for offerings (replaces `validateOfferingForm`)
- [ ] `app/utils/appointment-schema.ts` — `f.object` schema for appointments (replaces `validateAppointmentForm`)
- [ ] `admin-offerings-controller.tsx` — switch from `validateOfferingForm()` to `s.parseSafe(offeringSaveSchema, ...)`
- [ ] `admin-appointments-controller.tsx` — switch from `validateAppointmentForm()` to `s.parseSafe(appointmentSaveSchema, ...)` plus remove URL-param encoding
- [ ] `admin-appointments-form.tsx` — switch to receiving props from re-render (no more `fv_`/`fe_` URL param decoding)
- [ ] `admin-users-controller.tsx`, `admin-resources-controller.tsx` — apply same pattern
- [ ] Verify all tests pass without changes to test assertions (error format stays `Record<string, string>`)
- [ ] Verify `s.parseSafe` with `f.object` returns `issue.path[0]` matching field names (e.g., `"resource_id"`, `"day"`)

## Open Questions

- Does `.refine()` on `f.object` work the same as on `s.object`? The README shows `.refine()` on `s.object` but not `f.object`. Needs spike.
- Does `s.parseSafe()` with `f.object` return issues with `path` arrays matching field names? The `timeboxer` demo uses `s.object`, not `f.object`. Needs verification.
- Can `coerce.number()` handle the empty-string-to-NaN case cleanly? `parseInt("", 10)` → `NaN`, but `coerce.number()` might reject empty strings.
- How to handle the cross-field `endMin <= startMin` check? `.refine()` on the whole object should work, but `path` targeting for the error message is unclear.
