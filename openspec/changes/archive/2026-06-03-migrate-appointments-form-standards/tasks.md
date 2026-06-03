## 1. Controller — Replace Redirect with Direct Render

- [x] 1.1 In `admin-appointments-controller.tsx`, add `ResponseInit` parameter to `renderAppointmentsPage()` so it passes through to `renderVerwaltungPage()`
- [x] 1.2 Update `create` action: replace manual `formData.get(...)` destructuring with `gridStateFromFormData(formData)` and extractor functions
- [x] 1.3 Update `create` action: on any validation failure, call `loadAppointmentPageData()` with overrides (formValues, fieldErrors, formError, grid state), then `renderAppointmentsPage(context, data, { status: 400 })`
- [x] 1.4 Update `create` action: on rate-limit, use same re-render pattern instead of 302 redirect
- [x] 1.5 Update `update` action: same treatment as create — `gridStateFromFormData`, re-render on error with status 400
- [x] 1.6 Remove `buildErrorRedirectUrl()` function entirely
- [x] 1.7 Remove imports of `encodeFormValues`, `decodeFormValues`, `encodeFieldErrors`, `decodeFieldErrors` from `form-params.ts`
- [x] 1.8 Remove `formValues` and `fieldErrors` URL-param decoding from `loadAppointmentPageData()` — use only overrides (keep `error` URL param fallback for destroy flow)

## 2. Form UI — Error Banner Style + No Double Errors

- [x] 2.1 In `admin-appointments-form.tsx`, replace `table.errorBanner` with a local `formErrorBanner` style matching the offerings create page pattern (transparent danger background, danger border, danger text)
- [x] 2.2 In `admin-offerings-page.tsx`, fix line 120: gate `formError` banner behind `!hasFormPanel` to avoid double render when the form panel already shows it (`{!hasFormPanel && formError ? ...}`)
- [x] 2.3 Verify `inlineErrorStyle` per-field errors already match the offerings pattern (red text below inputs)

## 3. Cleanup — Remove form-params.ts

- [x] 3.1 Verify `form-params.ts` has no remaining consumers after controller changes
- [x] 3.2 Delete `app/utils/form-params.ts`

## 4. Tests — Update to Assert Render Pattern

- [x] 4.1 Update `admin-appointments-controller.test-utils.ts`: adjust helpers for render-on-error assertions instead of redirect assertions (no changes needed — file only provides test setup data)
- [x] 4.2 Update `admin-appointments-controller.create.test.ts`: assert 400 status and page content on validation failure instead of 302 redirect
- [x] 4.3 Update `admin-appointments-controller.update.test.ts`: assert 400 status and page content on validation failure instead of 302 redirect

## 5. Verify

- [x] 5.1 Run `npm run typecheck` in `newapp/` and fix any type errors
- [x] 5.2 Run `npm test` in `newapp/` and ensure all tests pass
