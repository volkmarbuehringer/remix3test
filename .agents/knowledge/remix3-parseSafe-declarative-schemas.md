---
title: "Remix 3 parseSafe + declarative schemas replace hand-written validation"
tags: [remix3, validation, forms, parseSafe, refine, coerce, schema]
created: 2026-06-02
status: archived
---

## Problem

Controllers use `s.parse()` (throws on failure) wrapped in try/catch, plus hand-written validation functions like `validateOfferingForm()` with manual `parseInt()`, regex checks, and `if` chains. The try/catch loses parsed form values on failure, and the validation boilerplate is duplicated across every controller.

## Solution

Replace both `s.parse()` + custom validation with `s.parseSafe(schema, formData)` where the schema carries all validation rules via `.refine()`. ParseSafe returns `{ success, value } | { success, issues }` — never throws.

### Schema per domain entity

```typescript
// app/utils/offering-schema.ts — pure, no controller/UI imports
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import * as coerce from 'remix/data-schema/coerce'

export const OFFERING_FORM_KEYS = ['resource_id', 'day', 'start_min', 'end_min'] as const

export const offeringSaveSchema = f.object({
  resource_id: f.field(
    coerce.number().refine((n) => n > 0 && Number.isFinite(n), 'ist erforderlich.'),
  ),
  day: f.field(
    s.string().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), 'Gültiges Datum erforderlich (YYYY-MM-DD).'),
  ),
  start_min: f.field(
    coerce.number().refine((n) => n >= 0 && n <= 1380 && n % 60 === 0, 'ist ungültig.'),
  ),
  end_min: f.field(
    coerce.number().refine((n) => n >= 60 && n <= 1440 && n % 60 === 0, 'ist ungültig.'),
  ),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})
```

### Controller usage (redirect pattern for Frame-based admin)

```typescript
// In controller
let formValues = readFormFieldValues(OFFERING_FORM_KEYS, formData)
let gridValues: GridState = { offset: ..., sort: ..., order: ..., filter: ... }

// Pre-check empty selects (coerce.number() produces English messages)
let resourceIdRaw = (formData.get('resource_id') as string) ?? ''
if (!resourceIdRaw.trim()) {
  return buildErrorRedirect(formValues, gridValues, { creating: true, fieldErrors: { resource_id: 'ist erforderlich.' } })
}

let result = s.parseSafe(offeringSaveSchema, formData)

if (!result.success) {
  let fieldErrors = issuesToFieldErrors(result.issues)
  return buildErrorRedirect(formValues, gridValues, { creating: true, fieldErrors })
}

// result.value has coerced types — no parseInt() needed
let { resource_id, day, start_min, end_min } = result.value

// Cross-field validation stays manual (matches timeboxer demo)
if (end_min <= start_min) {
  return buildErrorRedirect(formValues, gridValues, { 
    creating: true, 
    fieldErrors: { end_min: 'muss nach der Startzeit liegen.' } 
  })
}
```

### Controller usage (re-render-from-POST for plain pages like /client)

```typescript
let rawValues = readFormFieldValues(CLIENT_FORM_KEYS, formData)
let result = s.parseSafe(clientSaveSchema, formData)

if (!result.success) {
  let fieldErrors = issuesToFieldErrors(result.issues)
  return context.render(
    <Layout><ClientPage formValues={rawValues} fieldErrors={fieldErrors} /></Layout>,
    { status: 400 },
  )
}
```

## Key Design Decisions

1. **Schemas in `app/utils/*-schema.ts`** — pure logic, testable without a router, no controller/UI imports
2. **`.refine()` on individual `f.field()` schemas** — ensures `issue.path[0]` is the field name. `.refine()` on outer `f.object()` produces root-level `[]` paths.
3. **Cross-field checks remain manual post-parse** — matches timeboxer demo's duplicate-username pattern
4. **`_offset/_sort/_order/_filter` use `s.defaulted(s.string(), '')`** — prevents parseSafe failure when these hidden fields aren't present
5. **`readFormFieldValues()` reads raw strings from FormData before coercion** — preserves exactly what user typed for form re-rendering

## What This Replaces

| Before | After |
|--------|-------|
| `s.parse(schema, formData)` in try/catch | `s.parseSafe(schema, formData)` — no throw |
| `validateOfferingForm(parsed)` — 47 lines | `.refine()` chains in schema — 0 lines |
| `parseInt(parsed.resource_id, 10)` | `result.value.resource_id` — already a number |
| `isNaN(id) \|\| !id` checks | `.refine(n => n > 0, ...)` in schema |
| Lost grid state on parse error | FormData always accessible for grid state |
