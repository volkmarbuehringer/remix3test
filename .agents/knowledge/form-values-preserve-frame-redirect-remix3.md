---
title: "Preserving form values across frame-based form submissions in Remix 3"
tags: [remix3, forms, validation, frames, session, redirect, admin]
created: 2026-06-02
status: active
---

## Problem

When a Remix 3 form submission (via `rmx-target` frame navigation) fails validation on the server, returning a 200 response with the form HTML causes a 404 GET to the form action URL (because the frame runtime navigates there). Redirecting back (302) with `?error=` works but loses all submitted form values — every field resets to defaults.

Using `session.flash()` to preserve form values across the redirect hits a race condition with file-based session storage: concurrent POST + GET requests corrupt the session file, causing `SyntaxError: Unexpected end of JSON input` and crashing the server.

## Solution

Encode the submitted form values directly as URL query parameters in the redirect. The frame follows the 302 redirect to a valid GET route, which reads the params and restores the values.

### Step 1: Encode form values into the redirect URL

```typescript
// Define the fields to preserve
const FORM_VALUE_KEYS = ['resource_id', 'user_id', 'title', 'date', 'start_min', 'end_min'] as const

// Extract values from the parsed form data, prefix with fv_
function encodeFormValues(parsed: Record<string, string>): Record<string, string> {
  let params: Record<string, string> = {}
  for (let key of FORM_VALUE_KEYS) {
    if (parsed[key]) params[`fv_${key}`] = parsed[key]
  }
  return params
}

// Reconstruct form values from URL params
function decodeFormValues(url: URL): Record<string, string> | undefined {
  let values: Record<string, string> = {}
  let hasAny = false
  for (let key of FORM_VALUE_KEYS) {
    let val = url.searchParams.get(`fv_${key}`)
    if (val !== null) {
      values[key] = val
      hasAny = true
    }
  }
  return hasAny ? values : undefined
}
```

### Step 2: Redirect on validation failure with values in URL

```typescript
// In the controller action (create/update):
let validationResult = validateAppointmentForm(parsed)
if (!validationResult.ok) {
  // First error as banner fallback
  let formError = validationResult.fieldErrors
    ? Object.values(validationResult.fieldErrors)[0]
    : undefined
  // buildErrorRedirectUrl now includes fv_* params from encodeFormValues
  return new Response(null, {
    status: 302,
    headers: { Location: buildErrorRedirectUrl(parsed, { creating: true, formError }) },
  })
}
```

### Step 3: Read values from URL in the GET handler

```typescript
// In the index action:
let data = await loadAppointmentPageData(context)
let fv = decodeFormValues(context.url)
if (fv) {
  data.formValues = fv
}
```

### Step 4: Form component uses preserved values

```typescript
// Value priority: formValues (from URL) > row (from DB) > defaults
let resolvedTitle = formValues?.title ?? (isEdit && row ? row.title : undefined)
let resolvedResourceId = formValues?.resource_id ?? (isEdit && row ? row.resource_id : undefined)
```

## Why

- **URL params survive the redirect**: The Remix frame runtime follows 302 redirects correctly, preserving all query parameters including the `fv_*` params.
- **No file I/O**: Unlike `session.flash()` which reads/writes session files, URL params have zero I/O overhead and no race conditions.
- **No memory store**: In-memory stores (Map keyed by UUID) don't work across server restarts or multi-process deployments.
- **Compact**: 6 fields is small enough for URL encoding (well under the 2048 char limit).
- **Works without JavaScript**: The redirect approach works even if the frame runtime doesn't intercept the form submission.

## Trade-offs

- URL params are visible in the address bar (acceptable for internal admin tools).
- Field names are exposed in the URL (don't use for sensitive data).
- Max URL length limits the number/ size of fields that can be preserved.
- Field-level inline errors can't be encoded in URL params — use the first error as a banner fallback.
