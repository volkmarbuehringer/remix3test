## Context

The admin appointments controller currently uses a redirect-based error pattern: on validation failure, it calls `buildErrorRedirectUrl()` which encodes form values (`fv_*`) and field errors (`fe_*`) as URL query parameters, issues a 302 redirect, and the GET index handler decodes them back via `loadAppointmentPageData()`. Every other verwaltung sub-route (offerings, resources, offering-configs) has already adopted the direct re-render pattern.

The verwaltung route tree no longer uses frames (since the verwaltung-route-tree change), so `context.render()` from POST actions works correctly — no server/client render mismatch to worry about.

## Goals / Non-Goals

**Goals:**

- Replace redirect-based error handling with direct re-render on validation failure (status 400)
- Remove all usage of `encodeFormValues`, `decodeFormValues`, `encodeFieldErrors`, `decodeFieldErrors`
- Use `gridStateFromFormData()` with typed extractors instead of manual `formData.get(...)` destructuring
- Delete `app/utils/form-params.ts` after removing its only consumer
- Keep all existing behaviors: SSE broadcasts, rate limiting, audit logging, past-date checks, slot-bookable checks, exclusion constraint handling

**Non-Goals:**

- Changing validation schemas or business rules
- Changing the `destroy` action (already uses `gridStateFromFormData` and a simpler error redirect for its single error case — keep as-is for consistency with delete flow)
- Changing `appointment-schema.ts` or data layer
- Changing the `/events` SSE endpoint
- Adding new field validation rules

## Decisions

**1. Direct re-render on validation failure, status 400**

The `create` and `update` actions call `renderAppointmentsPage(context, data, { status: 400 })` on any validation failure instead of issuing a 302 redirect through `buildErrorRedirectUrl()`.

Rationale: Matches the offerings, resources, and offering-configs pattern. No redirect means no URL bloat, no encode/decode round-trip. Status 400 signals client error semantically.

**2. Add `ResponseInit` parameter to `renderAppointmentsPage`**

```typescript
function renderAppointmentsPage(
  context: AppContext,
  data: AppointmentPageData,
  init?: ResponseInit,
): Response {
  return renderVerwaltungPage(context.render, <AdminAppointmentsPage ... />, init)
}
```

This allows `create` and `update` to pass `{ status: 400 }` on error while `index` calls without `init` for the default 200.

**3. Use `gridStateFromFormData` with extractor functions**

Replace the manual destructuring pattern used by `create` and `update`:

```typescript
// OLD
let gridValues: GridState = {
  offset: (formData.get('_offset') as string) ?? '',
  sort: (formData.get('_sort') as string) ?? '',
  order: (formData.get('_order') as string) ?? '',
  filter: (formData.get('_filter') as string) ?? '',
}

// NEW
let gridValues = gridStateFromFormData(formData)
// then use extractors when loading page data:
gridStateOffset(gridValues), gridStateSort(gridValues), etc.
```

Rationale: The `destroy` action already uses `gridStateFromFormData`. Consistency across all mutations reduces duplication. The `grid-state.ts` module is already imported.

**4. Remove URL-decoded fallbacks from `loadAppointmentPageData`**

Change lines 267–269 from:

```typescript
let error = overrides?.error ?? (context.url.searchParams.get('error') || undefined)
let formValues = overrides?.formValues ?? decodeFormValues(APPOINTMENT_FORM_KEYS, context.url)
let fieldErrors = overrides?.fieldErrors ?? decodeFieldErrors(APPOINTMENT_FORM_KEYS, context.url)
```

To:

```typescript
let error = overrides?.error ?? (context.url.searchParams.get('error') || undefined)
let formValues = overrides?.formValues ?? undefined
let fieldErrors = overrides?.fieldErrors ?? undefined
```

The `error` fallback is kept because the `destroy` action still uses a simple error redirect with `?error=` URL parameter (single error message, not per-field).

Rationale: On direct re-render, form state arrives via props, not URL parameters. The `destroy` action's error redirect is a separate, simpler flow that still uses a query parameter — but only for a single error message, not for form field preservation.

**5. Remove `buildErrorRedirectUrl` and imports**

Remove the `buildErrorRedirectUrl` function entirely. Remove imports of `encodeFormValues`, `decodeFormValues`, `encodeFieldErrors`, `decodeFieldErrors` from `form-params.ts`. The `form-params.ts` file can then be deleted since appointments was its only consumer.

**6. Pass grid state extractors directly to `loadAppointmentPageData`**

On error, extract grid state components using the typed extractors and pass them as overrides:

```typescript
let gridValues = gridStateFromFormData(formData)
// ... on error:
let data = await loadAppointmentPageData(context, {
  creating: true,
  formValues,
  fieldErrors,
  formError: '...',
  offset: gridStateOffset(gridValues),
  sortColumn: gridStateSort(gridValues),
  sortDirection: gridStateDirection(gridValues),
  filter: gridStateFilter(gridValues),
})
```

Rationale: `loadAppointmentPageData` already accepts overrides for `offset`, `sortColumn`, `sortDirection`, `filter`. Using the extractor functions is cleaner than constructing a partial `GridState` object.

**7. Form error banner matches offerings `formErrorBanner` style — no page-level duplication**

Replace the solid `table.errorBanner` styling in `AdminAppointmentsForm` with a local `formErrorBanner` style matching the offerings create page: transparent danger-tinted background, solid danger border, danger-colored text. The page-level `AdminAppointmentsPage` SHALL NOT render `formError` at page level — only the form panel renders it, avoiding the double-error bug currently present in offerings (where `formError` appears both at page level and inside the form). The page-level `error` prop (from destroy redirects) continues to show only when `!hasFormPanel`.

Rationale: The offerings page has a bug where `formError` renders twice — once at page level (line 120, unconditionally) and once inside the form panel. Appointments should not replicate this bug. The form error belongs inside the form, not duplicated above the table.

**8. Fix offerings double-error bug**

In `AdminOfferingsPage`, line 120 renders `formError` unconditionally at page level:

```tsx
{
  formError ? <div mix={table.errorBanner}>{formError}</div> : null
}
```

This causes a double render when a form panel is also showing `formError` inside the form. Change to:

```tsx
{
  !hasFormPanel && formError ? <div mix={table.errorBanner}>{formError}</div> : null
}
```

Matching the pattern used on line 121 for the `error` prop.

Rationale: This is a bug in the offerings page discovered during this migration. The fix is trivial (one character change: remove the `formError` guard, keep only the `!hasFormPanel && formError` guard).

**9. Destroy action stays as-is**

The `destroy` action uses `gridStateFromFormData` already and issues a simple 302 redirect with only `error` and grid state params — not `fv_*`/`fe_*` params. This is appropriate for a delete flow (no form re-render needed). Keep unchanged.

## Risks / Trade-offs

- **Risk: `AdminAppointmentsPage` form state props are already wired** — The page component already accepts `formValues`, `fieldErrors`, and `formError` props, and the form components already render inline errors from these props. The shared `AdminAppointmentsForm` component reads `formValues` for pre-filling and `fieldErrors` for error display. No UI changes needed.
  - Mitigation: Already verified — the form UI was built alongside the controller and has always accepted these props. The migration only changes how they're delivered (props vs URL params).

- **Risk: Tests rely on redirect assertions** — Existing tests for `create` and `update` likely assert 302 status codes and redirect `Location` headers. These need updating to assert 400 status and page content.
  - Mitigation: Update test helpers and assertions to verify re-render behavior instead of redirect behavior. The test-utils file also needs updating.

- **Risk: `errorRedirectDestroy` still uses URL params for error** — The destroy action redirect pattern uses `?error=<msg>` which `loadAppointmentPageData` still reads from the URL. This is intentional — the destroy flow doesn't involve form re-render, just a simple error flash.
  - Mitigation: No action needed. The `error` URL param fallback in `loadAppointmentPageData` is preserved for destroy flow compatibility.

- **Risk: `form-params.ts` deletion breaks other code** — The file could be imported elsewhere.
  - Mitigation: Verify via typecheck after removal. The file has a single consumer (appointments controller).
