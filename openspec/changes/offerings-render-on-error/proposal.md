## Why

The offerings, resources, and offering-configs admin forms currently use a redirect-based error pattern: on validation failure, form values and field errors are encoded as URL query parameters (`fv_*`/`fe_*`), a 302 redirect is issued, and the GET index handler decodes them back. This creates bloated, bookmarkable URLs full of error state. The /client route demonstrates a cleaner pattern: on validation failure, the controller re-renders the page directly (status 400) with `formValues` and `fieldErrors` passed as server-side props — no URL parameters, no redirect, no decode step. All three verwaltung forms should adopt this same pattern.

## What Changes

- **Offerings controller**: Remove `buildErrorRedirect()`, replace with direct re-render on error (status 400). Drop `encodeFormValues`/`decodeFormValues`/`encodeFieldErrors`/`decodeFieldErrors`. Pass `formValues` and `fieldErrors` as props.
- **Resources controller**: Replace `context.json({ ok: false, error: ... }, { status: 400 })` with re-rendered page showing `formValues` and `fieldErrors`. Currently resources has no field preservation or inline errors on failure — this adds them.
- **Offering-configs controller**: Same as resources — replace JSON error responses with re-rendered page. Currently has no field preservation or inline errors — this adds them.
- **Keep existing error behaviors**: Inline error display under fields, form-level error banners, field value preservation on error.

## Capabilities

### New Capabilities
- `resources-form-validation`: Resources form SHALL preserve field values on validation failure and SHALL display inline per-field errors. Currently only returns JSON `{ ok: false, error: ... }` with no field preservation.
- `offering-configs-form-validation`: Offering-configs form SHALL preserve field values on validation failure and SHALL display inline per-field errors. Currently only returns JSON `{ ok: false, error: ... }` with no field preservation.

### Modified Capabilities
- `admin-offerings-form-validation`: Requirements change from redirect-based error handling (302 → GET decodes URL params) to render-based error handling (POST re-renders page with status 400, passing formValues/fieldErrors as props). Field preservation, inline error display, and error message placement remain the same.

## Impact

- **Offerings controller**: `app/actions/admin-offerings-controller.tsx` — remove `buildErrorRedirect()`, `encodeFormValues`, `decodeFormValues`, `encodeFieldErrors`, `decodeFieldErrors`; update `create` and `update` to re-render on error
- **Resources controller**: `app/actions/admin-resources-controller.tsx` — replace `context.json()` error responses with page re-render including `fieldErrors` prop; add `formValues` and `fieldErrors` props to `AdminResourcesPage`
- **Offering-configs controller**: `app/actions/admin-offering-configs-controller.tsx` — replace `context.json()` error responses with page re-render including `fieldErrors` prop; add `formValues` and `fieldErrors` props to `AdminOfferingConfigsPage`
- **Page components**: `app/ui/admin-resources-page.tsx` and `app/ui/admin-offering-configs-page.tsx` — add `formValues`/`fieldErrors` props and render inline errors under fields (following the pattern already used by offerings)
