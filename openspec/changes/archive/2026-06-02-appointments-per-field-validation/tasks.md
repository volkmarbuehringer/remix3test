## 1. Validation Function — Structured Errors

- [x] 1.1 Change `validateAppointmentForm()` to return `{ ok: true } | { ok: false, fieldErrors?: Record<string, string>, formError?: string }` instead of `string | null`
- [x] 1.2 Map each existing error string to its corresponding field key (resource_id, user_id, title, date, start_min, end_min)
- [x] 1.3 Keep form-level errors (past date, overlap, outside offering hours) as `formError` separate from `fieldErrors`

## 2. Controller — Flash + Redirect

- [x] 2.1 In the `create` action, on validation failure flash form state to session and redirect to index
- [x] 2.2 In the `update` action, on validation failure flash form state to session and redirect to index
- [x] 2.3 Build `formValues` from the parsed form data string-to-string mapping
- [x] 2.4 Keep success paths unchanged (still redirect)

## 3. Page Component — Flash Reading

- [x] 3.1 Add `formValues`, `fieldErrors`, `formError` props to `AdminAppointmentsPageProps`
- [x] 3.2 Read flashed form state in `index` action, merge into page data
- [x] 3.3 Thread through `AdminAppointmentsCreatePage` and `AdminAppointmentsEditPage`

## 4. Form Component — Per-Field Display

- [x] 4.1 Accept `formValues`, `fieldErrors`, `formError` props in `AdminAppointmentsForm`
- [x] 4.2 Compute value priority: `formValues.field ?? row?.field ?? default` for each input
- [x] 4.3 Compute `<option selected>` from `formValues` on error path
- [x] 4.4 Apply `input.error` mixin to fields with errors
- [x] 4.5 Render inline error message below each errored field

## 5. Tests

- [x] 5.1 Update create-validation tests to expect 302 redirect
- [x] 5.2 Update update-validation tests to expect 302 redirect
- [x] 5.3 All 39 appointment controller tests pass
