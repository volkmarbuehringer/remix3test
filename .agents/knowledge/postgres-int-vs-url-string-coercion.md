---
title: 'PostgreSQL integer vs URL param string type coercion in select comparisons'
tags: [postgres, remix3, forms, type-safety, selects, url-params, admin]
created: 2026-06-02
status: active
---

## Problem

In Remix 3 server-rendered forms, `<option selected={resolvedId === res.id}>` silently fails when `res.id` is a `number` from PostgreSQL but `resolvedId` is a `string` from URL params or form submission. JavaScript `===` is strict — `"5" === 5` → `false`. No option gets `selected`, so the browser defaults to the first `<option>`, showing the wrong value.

The TypeScript interface may say `id: string`, but at runtime PostgreSQL `integer` columns return as JavaScript `number` through the `pg` library. URL params and form submissions are always `string`. This mismatch only surfaces when form values survive a redirect (via `fv_` params) — on initial page load, both the DB row value and the option value are `number`, so `===` works by coincidence.

## Solution

Use `String()` coercion on both sides of the comparison in `<option selected={...}>` expressions:

```tsx
// BEFORE (broken — fails when resolvedResourceId is string from URL params)
let resolvedResourceId = formValues?.resource_id ?? (isEdit && row ? row.resource_id : undefined)

<option selected={resolvedResourceId === res.id}>

// AFTER (fixed — handles number/string mismatch)
<option selected={resolvedResourceId != null && String(resolvedResourceId) === String(res.id)}>
```

Full select pattern:

```tsx
<select name="resource_id" required>
  {resourcePlaceholder ? (
    <option value="" disabled selected={resolvedResourceId == null}>
      {resourcePlaceholder}
    </option>
  ) : null}
  {resources.map((res) => (
    <option
      key={res.id}
      value={res.id}
      selected={resolvedResourceId != null && String(resolvedResourceId) === String(res.id)}
    >
      {res.description}
    </option>
  ))}
</select>
```

Replace `=== undefined` with `== null` on the placeholder to cover both `null` and `undefined`.

## Why

- **PostgreSQL `integer` → JS `number`**: The `pg` library returns integer columns as native JavaScript numbers. PostgreSQL `SERIAL` / `INTEGER` columns are `number` at runtime regardless of TypeScript type declarations.
- **URL params / form data → JS `string`**: `URLSearchParams.get()` and `FormData.get()` always return strings. Form `<option value="5">` submits `"5"` as a string.
- **`===` is strict**: `"5" === 5` is `false` in JavaScript. No type coercion.
- **`String()` handles both**: `String(5)` → `"5"`, `String("5")` → `"5"`. Always produces a string.
- **`!= null` covers both null and undefined**: `resolvedResourceId != null` is `false` for both `null` and `undefined`, preventing `String(undefined)` → `"undefined"` edge case.

## Detection

If selects appear to show the first option or wrong option after a validation error redirect, check:

1. Console-log the runtime type: `console.log(typeof res.id, typeof resolvedResourceId)`
2. If they differ → apply `String()` coercion
3. Also check if the TypeScript interface for DB row types uses `string` when PostgreSQL returns `number` — fix the interface or add coercion in the query layer

## Prevention

- When writing select/option comparisons involving DB IDs and form/URL values, always use `String()` on both sides.
- Consider a helper: `const matches = (a: unknown, b: unknown) => a != null && String(a) === String(b)`
- If the codebase uses a query builder or ORM, check whether it maps PostgreSQL integer columns to strings or numbers.
