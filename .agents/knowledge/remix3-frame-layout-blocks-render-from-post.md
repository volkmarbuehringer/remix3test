---
title: "Remix 3 Frame Layout Blocks Re-Render-From-POST for Admin Forms"
tags: [remix3, admin, forms, validation, sidebar-layout, createSidebarLayout, ShellOrFragment, frame, re-render-from-post]
created: 2026-06-02
status: active
---

## Problem

Admin pages built with `createSidebarLayout` (e.g., `/admin/offerings`, `/admin/appointments`) use a
two-tier frame architecture:

1. Outer page (no `X-Remix-Target` header): `ShellOrFragment` renders `<Layout><Frame src="..."/></Layout>`
2. Inner frame (with `X-Remix-Target` header): `ShellOrFragment` renders `<LayoutComponent>` = sidebar + children

When a form submits via POST (no `rmx-target`, no `X-Remix-Target` header), the controller action
calls `renderOfferingsPage(context, data)` → `renderAdminPage(...)`. `ShellOrFragment` detects
a non-frame request and renders `<Layout><Frame src="..."/></Layout>` — **discarding the
`children` prop entirely**. The `AdminOfferingsPage` with errors and preserved form values never
reaches the browser.

The Remix 3 `timeboxer` demo's re-render-from-POST pattern (`context.render(<Page errors={...}/>)`)
works for simple pages (auth, register) but **not** for frame-based admin layouts.

## Solution

Use **redirect + encoded state** for admin form errors. On validation failure, the controller
redirects with form values and errors encoded as URL search params (`fv_` and `fe_` prefix).
The GET handler (`index` action) decodes them in the page data loader and passes them to the
form component.

### Controller encode/decode helpers

```typescript
const FORM_VALUE_KEYS = ['resource_id', 'day', 'start_min', 'end_min'] as const

function encodeFormValues(parsed: Record<string, string>): Record<string, string> {
  let params: Record<string, string> = {}
  for (let key of FORM_VALUE_KEYS) {
    if (parsed[key]) params[`fv_${key}`] = parsed[key]
  }
  return params
}

function decodeFormValues(url: URL): Record<string, string> | undefined {
  let values: Record<string, string> = {}
  let hasAny = false
  for (let key of FORM_VALUE_KEYS) {
    let val = url.searchParams.get(`fv_${key}`)
    if (val !== null) { values[key] = val; hasAny = true }
  }
  return hasAny ? values : undefined
}

// Same pattern for encodeFieldErrors / decodeFieldErrors with `fe_` prefix
```

### Error redirect builder

```typescript
function buildErrorRedirect(
  parsed: Record<string, string>,
  opts: { creating?: boolean; editing?: number | string; error?: string; fieldErrors?: Record<string, string> },
): Response {
  let params = gridStateToParams(gridStateFromForm(parsed))
  if (opts.creating) params.set('creating', 'true')
  if (opts.editing) params.set('editing', String(opts.editing))
  if (opts.error) params.set('error', opts.error)
  let fv = encodeFormValues(parsed)
  for (let [k, v] of Object.entries(fv)) params.set(k, v)
  if (opts.fieldErrors) {
    let fe = encodeFieldErrors(opts.fieldErrors)
    for (let [k, v] of Object.entries(fe)) params.set(k, v)
  }
  return new Response(null, {
    status: 302,
    headers: { Location: '/admin/offerings?' + params.toString() },
  })
}
```

### Page data loader reads decoded params

```typescript
let formValues = overrides?.formValues ?? decodeFormValues(context.url)
let fieldErrors = overrides?.fieldErrors ?? decodeFieldErrors(context.url)
```

### Action validation failure path

```typescript
if (!validationResult.ok) {
  let formError = Object.values(validationResult.fieldErrors)[0]
  return buildErrorRedirect(parsed, {
    creating: true,
    error: formError,
    fieldErrors: validationResult.fieldErrors,
  })
}
```

## Why

Attempted fixes (modify `ShellOrFragment` to render content for non-GET, use `AdminLayout` +
`Layout` directly, add `rmx-target` to forms) all failed due to client-side hydration mismatches
in Remix 3's frame-based architecture. The outer shell expects a `<Frame>` element with an
iframe; replacing it with direct content breaks the client-side JS.

The redirect approach is proven in the codebase (`admin-appointments-controller.tsx`). It
works because:
- The redirect converts POST to GET, which `ShellOrFragment` handles via the frame path
- `X-Remix-Target: adminContent` is sent by the frame, so `ShellOrFragment` renders `<LayoutComponent>` with content
- Form values and errors are small enough for URL encoding (4-6 fields, short error messages)
- Type coercion with `String()` comparisons avoids PostgreSQL `number` vs URL `string` bugs

## Alternatives (not viable for this architecture)

| Approach | Why it fails |
|---|---|
| `context.render()` from POST action | `ShellOrFragment` discards children for non-frame requests |
| Session flash | File-based session storage causes race conditions with concurrent POST+GET |
| In-memory token store | Doesn't survive server restarts, not in any Remix 3 demo |
| `rmx-target` on form | Client-side JS doesn't properly hydrate the POST response |
