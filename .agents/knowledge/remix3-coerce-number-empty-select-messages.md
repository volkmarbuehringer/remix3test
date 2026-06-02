---
title: "Remix 3 coerce.number() emits English messages for empty select values"
tags: [remix3, validation, coerce, number, select, german, i18n]
created: 2026-06-02
status: active
---

## Problem

`coerce.number()` on an empty string `""` fails immediately with `'Expected number'` (English) BEFORE `.refine()` can run. This means HTML `<select>` elements with a disabled placeholder option (`<option value="" disabled selected>`) produce English errors, while `.refine('ist erforderlich.')` messages are German. The user sees mixed-language errors.

```typescript
// This produces "Expected number" (EN) for empty selects, not "ist erforderlich." (DE)
coerce.number().refine((n) => n > 0, 'ist erforderlich.')
```

From source (`coerce.js`):
```
// Empty string → immediate failure, .refine() never runs
if (trimmed.length === 0) return fail('Expected number', ...)
```

## Solution

Pre-check empty select values in the controller before calling `parseSafe`:

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

## Failed Approaches

**Attempted: `s.string().refine(...).pipe(coerce.number()).refine(...)`**
```typescript
// Does NOT work — TypeScript fails:
// "Argument of type 'Schema<unknown, number>' is not assignable to parameter of type 'Check<string>'"
f.field(
  s.string()
    .refine(v => v.trim() !== '', 'ist erforderlich.')
    .pipe(coerce.number())    // ← changes type to number
    .refine(n => n > 0, ...)  // ← .refine() still expects string type
)
```

The `.pipe()` type propagation doesn't work with `.refine()` chaining because `.refine()` on a string schema expects a `string` predicate, but `.pipe(coerce.number())` changes the output type to `number`.

## When This Applies

Only for `<select>` elements with placeholder options that send `""`. For selects that always have a selected option (e.g., time pickers with all 24 hours), `coerce.number().refine(...)` is sufficient because the browser always sends a numeric string.
