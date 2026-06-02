## 1. Validation Function — Structured Errors

- [ ] 1.1 Change `validateAppointmentForm()` to return `{ ok: true } | { ok: false, fieldErrors?: Record<string, string>, formError?: string }` instead of `string | null`
- [ ] 1.2 Map each existing error string to its corresponding field key (resource_id, user_id, title, date, start_min, end_min)
- [ ] 1.3 Keep form-level errors (past date, overlap, outside offering hours) as `formError` separate from `fieldErrors`

## 2. Controller — Re-render on Error

- [ ] 2.1 In the `create` action, on validation failure call `context.render()` with the full page + `formValues` + `fieldErrors` instead of redirecting via `errorRedirect()`
- [ ] 2.2 In the `update` action, on validation failure call `context.render()` with the full page + `formValues` + `fieldErrors` instead of redirecting via `errorRedirect()`
- [ ] 2.3 Build `formValues` from the parsed form data string-to-string mapping for the error render path
- [ ] 2.4 Keep `context.render()` on success paths unchanged (still redirect)

## 3. Page Component — Error Props

- [ ] 3.1 Add `formErrors?: { fieldErrors?: Record<string, string>; formError?: string; formValues?: Record<string, string> }` to `AdminAppointmentsPageProps`
- [ ] 3.2 Thread `formErrors` through to `AdminAppointmentsCreatePage` and `AdminAppointmentsEditPage`
- [ ] 3.3 Fall back to the `?error=` URL param for form-level error display on initial GET (not post-redirect)

## 4. Form Component — Per-Field Display

- [ ] 4.1 Accept `formErrors` prop in `AdminAppointmentsForm`
- [ ] 4.2 Compute value priority: `formValues.field ?? row?.field ?? default` for each input
- [ ] 4.3 Compute `<option selected>` from `formValues` on error path
- [ ] 4.4 Apply `input.error` mixin to fields with errors
- [ ] 4.5 Render inline error message below each errored field

## 5. Tests

- [ ] 5.1 Update existing create-validation tests to expect structured errors instead of redirect
- [ ] 5.2 Add test: create with empty title returns field error for title
- [ ] 5.3 Add test: create with start > end returns field error for end_min
- [ ] 5.4 Add test: update with past date returns form-level error
- [ ] 5.5 Add test: submitted values are preserved in formValues on error response
