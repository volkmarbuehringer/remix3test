## Why

The admin appointments form still uses a redirect-based error pattern — on validation failure, form values and field errors are encoded as URL query parameters (`fv_*`/`fe_*`), a 302 redirect is issued, and the GET index handler decodes them back. Every other verwaltung sub-route (offerings, resources, offering-configs) has already adopted the direct re-render pattern: on validation failure, the controller re-renders the page directly (status 400) with `formValues` and `fieldErrors` passed as server-side props. This eliminates URL bloat, removes the need for `encodeFormValues`/`decodeFormValues`/`encodeFieldErrors`/`decodeFieldErrors`, and simplifies the data flow.

## What Changes

- **Appointments controller**: Replace `buildErrorRedirectUrl()` in `create` and `update` with direct re-render on error (status 400). Pass `formValues` and `fieldErrors` as props through `loadAppointmentPageData()`. Drop all usage of `encodeFormValues`, `decodeFormValues`, `encodeFieldErrors`, `decodeFieldErrors`.
- **Page components**: Remove URL-decoded form state fallbacks in `loadAppointmentPageData()`. Accept `formValues` and `fieldErrors` only via props (no URL param decoding).
- **Form error banner**: Appointments form uses `formErrorBanner` style (transparent bg + border) matching offerings. `formError` renders only inside the form panel, not at page level — avoiding double errors.
- **Offerings page**: Fix the `formError` double-render bug — `formError` at page level (line 120) currently renders unconditionally, duplicating the form-level banner. Gate it behind `!hasFormPanel` like `error` is.
- **Remove `form-params.ts`**: After migration, `app/utils/form-params.ts` has no remaining consumers and can be deleted.
- **Use `gridStateFromFormData`**: Replace manual `formData.get(...)` destructuring with the shared `gridStateFromFormData()` helper and typed extractors (matching offerings pattern).
- **Keep existing behaviors**: Inline per-field errors, form-level error banners, field value preservation on validation failure, and SSE live updates remain unchanged.

## Capabilities

### New Capabilities

- `admin-appointments-form-validation`: Admin appointments form SHALL re-render directly on validation failure (status 400) with `formValues` and `fieldErrors` passed as server-side props — no URL parameter encoding. Form inputs SHALL display inline per-field errors and preserve submitted values on re-render.

### Modified Capabilities

<!-- None — this is a new capability for appointments form behavior, not a change to existing spec-level requirements -->

## Impact

- **Appointments controller**: `app/actions/admin-appointments-controller.tsx` — remove `buildErrorRedirectUrl()`, `encodeFormValues`, `decodeFormValues`, `encodeFieldErrors`, `decodeFieldErrors`; use `gridStateFromFormData()`; update `create` and `update` to re-render on error with status 400
- **Appointments page data**: `loadAppointmentPageData()` in controller — remove URL-decoded fallbacks for `formValues` and `fieldErrors`
- **Appointments form**: `app/ui/admin-appointments-form.tsx` — replace `table.errorBanner` with local `formErrorBanner` style
- **Offerings page**: `app/ui/admin-offerings-page.tsx` — fix `formError` at page level (line 120) to only show when `!hasFormPanel`
- **form-params.ts**: `app/utils/form-params.ts` — delete entire file (no remaining consumers)
- **Tests**: Update `admin-appointments-controller.create.test.ts`, `update.test.ts`, and `test-utils.ts` to validate re-render behavior instead of redirect
