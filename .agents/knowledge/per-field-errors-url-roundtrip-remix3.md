---
title: "Encoding per-field validation errors through redirect URL params in Remix 3"
tags: [remix3, validation, forms, redirect, field-errors, admin]
created: 2026-06-02
status: archived
---

## Problem

When form validation returns per-field errors (`{ resource_id: "ist erforderlich.", title: "ist erforderlich." }`), those structured errors must survive a 302 redirect to reach the UI. Without serialization, only a single banner-level `?error=` param makes it through — per-field inline error rendering never activates.

The previous solution encoded form *values* (`fv_` prefix) but not *errors* (`fe_` prefix). The form component accepted a `fieldErrors` prop but it was always `undefined`.

## Solution

Encode field errors as URL params with a `fe_` prefix, mirroring the `fv_` pattern for form values. Decode both in the shared page data loader.

### Step 1: Encode field errors in the redirect URL

```typescript
function buildErrorRedirectUrl(
  parsed: Record<string, string>,
  extra?: { creating?: boolean; editing?: string; formError?: string; fieldErrors?: Record<string, string> },
): string {
  let params = gridStateToParams({ offset: parsed._offset, sort: parsed._sort, order: parsed._order, filter: parsed._filter })
  if (extra?.creating) params.set('creating', 'true')
  if (extra?.editing) params.set('editing', extra.editing)
  if (extra?.formError) params.set('error', extra.formError)

  // Encode form values
  let fv = encodeFormValues(parsed)
  for (let [k, v] of Object.entries(fv)) params.set(k, v)

  // Encode field errors (key addition)
  if (extra?.fieldErrors) {
    let fe = encodeFieldErrors(extra.fieldErrors)
    for (let [k, v] of Object.entries(fe)) params.set(k, v)
  }

  return '/admin/appointments' + (params.size ? '?' + params.toString() : '')
}
```

### Step 2: Encode/decode helpers

```typescript
function encodeFieldErrors(errors: Record<string, string>): Record<string, string> {
  let params: Record<string, string> = {}
  for (let [k, v] of Object.entries(errors)) {
    params[`fe_${k}`] = v
  }
  return params
}

function decodeFieldErrors(url: URL): Record<string, string> | undefined {
  let errors: Record<string, string> = {}
  let hasAny = false
  for (let key of FORM_VALUE_KEYS) {
    let val = url.searchParams.get(`fe_${key}`)
    if (val !== null) { errors[key] = val; hasAny = true }
  }
  return hasAny ? errors : undefined
}
```

### Step 3: Reconstruct errors in the page data loader

```typescript
async function loadAppointmentPageData(context: AppContext, overrides?) {
  // ... queries ...
  let formValues = overrides?.formValues ?? decodeFormValues(context.url)
  let fieldErrors = overrides?.fieldErrors ?? decodeFieldErrors(context.url)
  // ... return { formValues, fieldErrors, ... }
}
```

### Step 4: Controller passes fieldErrors on validation failure

```typescript
let validationResult = validateAppointmentForm(parsed)
if (!validationResult.ok) {
  let formError = Object.values(validationResult.fieldErrors)[0]
  return new Response(null, {
    status: 302,
    headers: { Location: buildErrorRedirectUrl(parsed, {
      creating: true,
      formError,
      fieldErrors: validationResult.fieldErrors,  // <-- key addition
    }) },
  })
}
```

## Why

- **Same pattern as form values**: `fe_` mirrors `fv_` — consistent, predictable, easy to maintain.
- **Survives the redirect**: URL params are the only state that survives a 302 redirect without session storage or in-memory state.
- **No validation re-run on GET**: Unlike re-validating on every page load, errors are computed once on POST and carried through the URL.
- **First error as banner fallback**: Still sets `?error=` with the first field error for users without JavaScript or for accessibility.
- **Works with frame navigation**: Remix 3 frame runtime follows 302 redirects, preserving all query params.

## Trade-offs

- Adds `fe_resource_id`, `fe_title`, etc. to URL params (visible in address bar).
- URL length grows with each errored field (still well under limits for 6 fields).
- If errors contain sensitive information about validation logic, they'll be visible in the URL.
