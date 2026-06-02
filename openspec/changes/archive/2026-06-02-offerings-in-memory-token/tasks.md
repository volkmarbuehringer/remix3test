## 1. Shared form validation utility

- [x] 1.1 Create `app/utils/form-errors.ts` with `ValidationOk`, `ValidationFail`, `ValidationResult` types
- [x] 1.2 Add `fieldErrorsFromResult(result: ValidationResult): Record<string, string> | undefined` helper

## 2. Structured validation function

- [x] 2.1 Import `ValidationResult` into `admin-offerings-controller.tsx`
- [x] 2.2 Change `validateOfferingForm` return type from `string | null` to `ValidationResult` with per-field errors
- [x] 2.3 Update error messages to be short inline-style (`"ist erforderlich."` not `"Ressource ist erforderlich."`)

## 3. Page data loader extraction

- [x] 3.1 Add `OfferingPageData` interface consolidating all index-action return values
- [x] 3.2 Extract `index` action logic into `loadOfferingPageData(context, overrides?)`: grid query, pagination, sort, filter, edit row fetch, config loading
- [x] 3.3 Add `fetchOfferingEditRow(id)` helper (extract from inline query)
- [x] 3.4 Add `renderOfferingsPage(context, data)` helper (wrap `renderAdminPage`)
- [x] 3.5 Simplify `index` action to call `loadOfferingPageData()` + `renderOfferingsPage()`

## 4. Controller: create action

- [x] 4.1 Add `readOfferingFormValues(formData)` helper — extracts resource_id, day, start_min, end_min from FormData
- [x] 4.2 On schema parse error (`catch` block): call `loadOfferingPageData(context, { creating: true, formError })` → `renderOfferingsPage(context, data)`
- [x] 4.3 On validation failure: call `loadOfferingPageData(context, { creating: true, formValues, fieldErrors, ...gridState })` → `renderOfferingsPage(context, data)`
- [x] 4.4 Add `buildErrorRedirect(parsed, { creating?, editing?, error? })` helper for business-rule errors (holiday, past-date, exclusion) — extracts grid state once, returns 302 Response
- [x] 4.5 Replace holiday error path with `buildErrorRedirect(parsed, { creating: true, error: '...' })`
- [x] 4.6 Replace past-date error path with `buildErrorRedirect(parsed, { error: '...' })`
- [x] 4.7 Replace exclusion constraint error path with `buildErrorRedirect(parsed, { creating: true, error: '...' })`

## 5. Controller: update action re-render on validation failure

- [x] 5.1 On schema parse error: `loadOfferingPageData(context, { editRow, formError })` → `renderOfferingsPage`
- [x] 5.2 On validation failure: `loadOfferingPageData(context, { editRow, formValues, fieldErrors, ...gridState })` → `renderOfferingsPage`
- [x] 5.3 Replace holiday/past-date/exclusion error paths with `buildErrorRedirect(parsed, { editing: id, error: '...' })`

## 6. UI: AdminOfferingsCreatePage inline errors

- [x] 6.1 Add `formValues?: Record<string, string>`, `fieldErrors?: Record<string, string>`, `formError?: string` to props interface
- [x] 6.2 Add `inlineErrorStyle` CSS (red text, small font)
- [x] 6.3 Add error banner div at top of form (for `formError`)
- [x] 6.4 Apply value priority chain: resource select uses `formValues?.resource_id` → `selected` with `String()` coercion
- [x] 6.5 Apply value priority: day input uses `formValues?.day` fallback → `value={resolvedDay}`
- [x] 6.6 Apply value priority: start_min select uses `formValues?.start_min` (Number) → defaults to 480
- [x] 6.7 Apply value priority: end_min select uses `formValues?.end_min` (Number) → defaults to 1020
- [x] 6.8 Apply `input.error` mixin on errored fields (`fieldErrors?.<field>`)
- [x] 6.9 Render inline `<span mix={inlineErrorStyle}>` below each errored field

## 7. UI: AdminOfferingsEditPage inline errors

- [x] 7.1 Add `formValues?`, `fieldErrors?`, `formError?` to props interface
- [x] 7.2 Add `inlineErrorStyle` CSS and error banner
- [x] 7.3 Apply value priority chain: resource select uses `formValues?.resource_id` ?? `row.resource_id` with `String()` coercion
- [x] 7.4 Apply value priority: day input uses `formValues?.day` fallback → `value={resolvedDay}`
- [x] 7.5 Apply value priority: start_min/end_min uses `formValues?.start_min` (Number) ?? parsed from `row.during`
- [x] 7.6 Apply `input.error` mixin and inline error messages

## 8. UI: AdminOfferingsPage prop threading

- [x] 8.1 Add `formValues?`, `fieldErrors?`, `formError?` to `AdminOfferingsPageProps`
- [x] 8.2 Thread props to `AdminOfferingsCreatePage` and `AdminOfferingsEditPage` render calls

## 9. Verification

- [x] 9.1 Run `npm run typecheck` and fix type errors
- [x] 9.2 Run `npm test` and fix test failures
- [ ] 9.3 Manual smoke test: create offering with empty fields → verify per-field errors + preserved values inline on the form
- [ ] 9.4 Manual smoke test: create offering on holiday → verify banner error via redirect
- [ ] 9.5 Manual smoke test: create overlapping offering → verify banner error via redirect
