## 1. Offerings Controller — Remove Redirect Pattern

- [ ] 1.1 In `admin-offerings-controller.tsx`, remove `buildErrorRedirect()` function and its usage in `create` and `update` actions
- [ ] 1.2 Remove imports of `encodeFormValues`, `decodeFormValues`, `encodeFieldErrors`, `decodeFieldErrors`
- [ ] 1.3 Update `create` action: on validation failure, call `loadOfferingPageData()` with overrides then `renderOfferingsPage()` with status 400
- [ ] 1.4 Update `update` action: same treatment as create (re-render on error, status 400)
- [ ] 1.5 Update `loadOfferingPageData()`: remove `decodeFormValues`/`decodeFieldErrors` from URL — only use overrides or defaults
- [ ] 1.6 Remove `creating`/`editing`/`error`/`fieldErrors` URL param reading from `loadOfferingPageData` — pass everything via overrides

## 2. Resources Controller — Add Render-on-Error

- [ ] 2.1 Switch `create` action from `s.parse()` to `s.parseSafe()` for the `resourceSaveSchema`
- [ ] 2.2 On validation failure in `create`, call `readFormFieldValues()` for raw values, use `issuesToFieldErrors()` for errors, re-render `AdminResourcesPage` with `formValues`/`fieldErrors` props and status 400
- [ ] 2.3 Apply same error handling to `update` action
- [ ] 2.4 Add `formValues?: Record<string, string>` and `fieldErrors?: Record<string, string>` props to `AdminResourcesPage` interface and component

## 3. Offering-Configs Controller — Add Render-on-Error

- [ ] 3.1 Switch `create` action from `s.parse()` to `s.parseSafe()` for the `offeringConfigSchema`
- [ ] 3.2 On validation failure in `create`, re-render `AdminOfferingConfigsPage` with `formValues`/`fieldErrors` and status 400
- [ ] 3.3 Apply same error handling to `update` action
- [ ] 3.4 Add inline error display to `AdminOfferingConfigsPage` edit and create form sections (red border + error text below resource select)

## 4. Resources Page — Add Inline Error UI

- [ ] 4.1 Add `formValues`/`fieldErrors` props to `AdminResourcesPage` component
- [ ] 4.2 In the edit form (`<RestfulForm method="PUT">`), render error message below description input when `fieldErrors?.description` is present
- [ ] 4.3 In the create form (`<RestfulForm method="POST">`), render error message below description input when `fieldErrors?.description` is present
- [ ] 4.4 Apply red border styling (`input.error`) to description inputs with errors

## 5. Verify

- [ ] 5.1 Run `npm run typecheck` and fix any type errors
- [ ] 5.2 Run `npm test` and ensure all tests pass
- [ ] 5.3 Manually verify: submit offerings form with invalid data → form values preserved, inline errors shown, no URL params
- [ ] 5.4 Manually verify: submit resources form with empty description → inline error shown, form value preserved
- [ ] 5.5 Manually verify: submit offering-configs form with invalid data → form values preserved, inline errors shown
