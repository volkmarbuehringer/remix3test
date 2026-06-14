---
name: remix3-coerce-number-empty-select-messages
description: "Remix 3 coerce.number() emits English 'Expected number' for empty select values before .refine() can run"
user-invocable: false
origin: auto-extracted
---

# Remix 3: coerce.number() Emits English Messages for Empty Select Values

**Extracted:** 2026-06-14
**Context:** HTML `<select>` elements with a disabled placeholder option in Remix 3 forms using `remix/data-schema`.

## Problem

`coerce.number()` on an empty string `""` fails immediately with `'Expected number'` (English) BEFORE `.refine()` can run. This means HTML `<select>` elements with a disabled placeholder option (`<option value="" disabled selected>`) produce English errors, while `.refine('ist erforderlich.')` messages are localized. The user sees mixed-language errors.

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

### Failed Approaches

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

## When to Use

- HTML `<select>` elements with a placeholder `<option value="" disabled selected>`
- Forms using `coerce.number()` on select values
- Mixed-language error messages where English appears unexpectedly
- For selects that always have a selected option (e.g., time pickers with all 24 hours), `coerce.number().refine(...)` is sufficient
