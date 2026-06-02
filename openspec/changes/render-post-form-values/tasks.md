## 1. Route Definition

- [ ] 1.1 Add `testForm: form('/test-form')` route to `app/routes.ts` as a standalone export

## 2. Controller

- [ ] 2.1 Create `app/actions/test-form-controller.tsx` with `createController`
- [ ] 2.2 Implement GET `index` action: renders form page via `context.render(<Layout><TestFormPage /></Layout>)`
- [ ] 2.3 Implement POST `action`: extracts raw `FormData` values, validates with `parseSafe`, on failure re-renders with `{ status: 400 }` passing `formValues` and `fieldErrors` props
- [ ] 2.4 Implement form schema using `remix/data-schema` and `remix/data-schema/form-data` (`name`: string minLength(1), `email`: string + email check, `message`: optional string maxLength(500))
- [ ] 2.5 Implement helper to convert `parseSafe` issues to `Record<string, string>` field-level errors
- [ ] 2.6 On successful validation, redirect to `/test-form` with a success query param or render a success state

## 3. Page Component

- [ ] 3.1 Implement `TestFormPage` component (inline in controller or co-located) accepting `formValues`, `fieldErrors`, `formError`, and `success` props
- [ ] 3.2 Render `<form method="POST">` with `CsrfTokenInput`, name input, email input, message textarea, and submit `Button`
- [ ] 3.3 Render `value={formValues?.name}` on inputs when `formValues` is provided (preserving submitted values)
- [ ] 3.4 Render per-field error messages next to each input when `fieldErrors` has entries
- [ ] 3.5 Render form-level error banner when `formError` is set
- [ ] 3.6 Render success state when `success` is true

## 4. Router Wiring

- [ ] 4.1 Import controller in `app/router.ts`
- [ ] 4.2 Map route: `router.map(routes.testForm, testFormController)` (or direct `router.form(...)`)

## 5. Verification

- [ ] 5.1 Run `npm run typecheck` and fix any type errors
- [ ] 5.2 Run `npm test` and ensure no regressions
- [ ] 5.3 Manually verify: GET `/test-form` renders the form
- [ ] 5.4 Manually verify: POST with valid data redirects successfully
- [ ] 5.5 Manually verify: POST with invalid email re-renders form with email value preserved and error shown
- [ ] 5.6 Manually verify: POST with empty name re-renders with name error and other fields preserved
