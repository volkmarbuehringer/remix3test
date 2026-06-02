## 1. Shared form validation utility

- [ ] 1.1 Create `app/utils/form-errors.ts` with `ValidationOk`, `ValidationFail`, `ValidationResult` types
- [ ] 1.2 Add `fieldErrorsFromResult(result: ValidationResult): Record<string, string> | undefined` helper

## 2. Structured validation function

- [ ] 2.1 Import `ValidationResult` into `admin-offerings-controller.tsx`
- [ ] 2.2 Change `validateOfferingForm` return type from `string | null` to `ValidationResult` with per-field errors
- [ ] 2.3 Update error messages to short inline-style (`"ist erforderlich."` not `"Ressource ist erforderlich."`)

## 3. Page data loader extraction

- [ ] 3.1 Add `OfferingPageData` interface consolidating all index-action return values
- [ ] 3.2 Extract `index` action logic into `loadOfferingPageData(context, overrides?)`
- [ ] 3.3 Add `fetchOfferingEditRow(id)` helper
- [ ] 3.4 Add `renderOfferingsPage(context, data)` helper
- [ ] 3.5 Simplify `index` action to call `loadOfferingPageData()` + `renderOfferingsPage()`

## 4. Controller: create action

- [ ] 4.1 Add `readOfferingFormValues(formData)` helper
- [ ] 4.2 On schema parse error: `loadOfferingPageData(context, { creating: true, formError })` → `renderOfferingsPage`
- [ ] 4.3 On validation failure: `loadOfferingPageData(context, { creating: true, formValues, fieldErrors, ...gridState })` → `renderOfferingsPage`
- [ ] 4.4 Add `buildErrorRedirect(parsed, { creating?, editing?, error? })` helper for business-rule errors
- [ ] 4.5 Replace holiday/past-date/exclusion error paths with `buildErrorRedirect(...)`

## 5. Controller: update action

- [ ] 5.1 On schema parse error: `loadOfferingPageData(context, { editRow, formError })` → `renderOfferingsPage`
- [ ] 5.2 On validation failure: `loadOfferingPageData(context, { editRow, formValues, fieldErrors, ...gridState })` → `renderOfferingsPage`
- [ ] 5.3 Replace holiday/past-date/exclusion error paths with `buildErrorRedirect(parsed, { editing: id, error: '...' })`

## 6. UI: AdminOfferingsCreatePage inline errors

- [ ] 6.1 Add `formValues?`, `fieldErrors?`, `formError?` to props interface
- [ ] 6.2 Add `inlineErrorStyle` CSS (red text, small font) and error banner div
- [ ] 6.3 Apply value priority chain: resource select uses `formValues?.resource_id` → `selected` with `String()` coercion
- [ ] 6.4 Apply value priority: day input uses `formValues?.day` fallback
- [ ] 6.5 Apply value priority: start_min/end_min uses `formValues` (Number) → defaults
- [ ] 6.6 Apply `input.error` mixin on errored fields, render inline error messages

## 7. UI: AdminOfferingsEditPage inline errors

- [ ] 7.1 Add `formValues?`, `fieldErrors?`, `formError?` to props interface
- [ ] 7.2 Add `inlineErrorStyle` CSS and error banner
- [ ] 7.3 Apply value priority chain with `String()` coercion for selects
- [ ] 7.4 Apply `input.error` mixin and inline error messages

## 8. UI: AdminOfferingsPage prop threading

- [ ] 8.1 Add `formValues?`, `fieldErrors?`, `formError?` to `AdminOfferingsPageProps`
- [ ] 8.2 Thread props to `AdminOfferingsCreatePage` and `AdminOfferingsEditPage`

## 9. Verification

- [ ] 9.1 Run `npm run typecheck` and fix type errors
- [ ] 9.2 Run `npm test` and fix test failures
- [ ] 9.3 Manual smoke test: create offering with empty fields → per-field errors + preserved values
- [ ] 9.4 Manual smoke test: holiday/past-date/exclusion → banner errors via redirect
