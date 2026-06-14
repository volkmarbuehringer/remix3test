---
title: "Preserving form state across Remix 3 frame redirects"
tags: [remix3, forms, validation, frames, session, redirect, admin, url-params]
created: 2026-06-02
status: archived
---

## Problem

When a Remix 3 form submission (via `rmx-target` frame navigation) fails validation on the server:

1. **200 re-render causes 404**: Returning HTML directly from POST causes the frame runtime to navigate to the POST URL as GET, which 404s since there's no GET handler for that route.
2. **302 redirect loses values**: Redirecting back (302) with `?error=` works for frame navigation but loses all submitted form values.
3. **Session flash corrupts files**: `session.flash()` with file-based session storage hits race conditions on concurrent POST+GET, corrupting the session JSON file.

## Solution

Encode form values and field errors as URL query params in the 302 redirect. Frame follows redirect to valid GET route, which decodes params and restores form state.

### Key patterns

**1. Encode form values with `fv_` prefix**
```typescript
const FORM_KEYS = ['resource_id', 'user_id', 'title', 'date', 'start_min', 'end_min'] as const

// Encode: { title: "Meeting" } → { fv_title: "Meeting" }
function encodeFormValues(keys: readonly string[], parsed: Record<string, string>): Record<string, string> {
  let params: Record<string, string> = {}
  for (let key of keys) {
    if (parsed[key]) params[`fv_${key}`] = parsed[key]
  }
  return params
}

// Decode: { fv_title: "Meeting" } → { title: "Meeting" }
function decodeFormValues(keys: readonly string[], url: URL): Record<string, string> | undefined {
  let values: Record<string, string> = {}
  let hasAny = false
  for (let key of keys) {
    let val = url.searchParams.get(`fv_${key}`)
    if (val !== null) { values[key] = val; hasAny = true }
  }
  return hasAny ? values : undefined
}
```

**2. Encode field errors with `fe_` prefix**
```typescript
function encodeFieldErrors(errors: Record<string, string>): Record<string, string> {
  let params: Record<string, string> = {}
  for (let [k, v] of Object.entries(errors)) {
    params[`fe_${k}`] = v
  }
  return params
}

function decodeFieldErrors(keys: readonly string[], url: URL): Record<string, string> | undefined {
  let errors: Record<string, string> = {}
  let hasAny = false
  for (let key of keys) {
    let val = url.searchParams.get(`fe_${key}`)
    if (val !== null) { errors[key] = val; hasAny = true }
  }
  return hasAny ? errors : undefined
}
```

**3. Always use 302 redirect for validation errors**
```typescript
let validationResult = validateForm(parsed)
if (!validationResult.ok) {
  let formError = Object.values(validationResult.fieldErrors)[0]
  return new Response(null, {
    status: 302,
    headers: { Location: buildRedirectUrl(parsed, { creating: true, formError, fieldErrors: validationResult.fieldErrors }) },
  })
}
```

**4. Auto-decode in the GET data loader**
```typescript
// In loadPageData():
let formValues = overrides?.formValues ?? decodeFormValues(FORM_KEYS, context.url)
let fieldErrors = overrides?.fieldErrors ?? decodeFieldErrors(FORM_KEYS, context.url)
```

**5. Form value priority chain**
```typescript
let resolvedTitle = formValues?.title ?? (isEdit && row ? row.title : undefined)
let resolvedStartMin = formValues?.start_min ? Number(formValues.start_min) : defaultStartMin
```

## Why

- URL params reliably survive frame redirects (unlike session flash which corrupts)
- No file I/O, no in-memory store, no race conditions
- Compact: 4-6 fields easily fit in URLs
- Works without JavaScript
- Inline errors display via `input.error` CSS mixin + adjacent `<span>`

## Trade-offs

- Values visible in URL (acceptable for admin tools)
- Field names exposed in URL (don't use for sensitive data)
- Max URL length limit for many fields
- Inline errors require `novalidate` on forms (HTML5 `required` blocks submission)
