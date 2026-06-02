## 1. Shared schema utilities

- [x] 1.1 Create `app/utils/schema-utils.ts` with `issuesToFieldErrors(issues)` function mapping parseSafe issues to `Record<string, string>` (path[0] as key, root-level issues under `_form`)
- [x] 1.2 Add `readFormFieldValues(keys, formData)` function extracting raw string values from FormData (missing fields → empty string)
- [x] 1.3 Verify `schema-utils.ts` has no imports from `remix/ui`, `remix/router`, or any controller module

## 2. Offering form schema

- [x] 2.1 Create `app/utils/offering-schema.ts` with `offeringSaveSchema` using `f.object({ resource_id: f.field(coerce.number().refine(...)), day: f.field(s.string().refine(...)), start_min: f.field(coerce.number().refine(...)), end_min: f.field(coerce.number().refine(...)), _offset, _sort, _order, _filter: f.field(s.defaulted(s.string(), '')) })`
- [x] 2.2 Export `OFFERING_FORM_KEYS = ['resource_id', 'day', 'start_min', 'end_min'] as const`
- [x] 2.3 Add `.refine()` messages in German matching existing `validateOfferingForm` messages (`"ist erforderlich."`, `"Gültiges Datum erforderlich (YYYY-MM-DD)."`, `"ist ungültig."`)

## 3. Appointment form schema

- [x] 3.1 Create `app/utils/appointment-schema.ts` with `appointmentSaveSchema` using `f.object({ resource_id: f.field(coerce.number().refine(...)), user_id: f.field(coerce.number().refine(...)), title: f.field(s.string().refine(...)), date: f.field(s.string().refine(...)), start_min: f.field(coerce.number().refine(...)), end_min: f.field(coerce.number().refine(...)), _offset, _sort, _order, _filter: f.field(s.defaulted(s.string(), '')) })`
- [x] 3.2 Export `APPOINTMENT_FORM_KEYS = ['resource_id', 'user_id', 'title', 'date', 'start_min', 'end_min'] as const`
- [x] 3.3 Add `.refine()` messages in German matching existing `validateAppointmentForm` messages

## 4. Admin offerings controller: switch to parseSafe

- [x] 4.1 Import `offeringSaveSchema` and `OFFERING_FORM_KEYS` from `../utils/offering-schema.ts`
- [x] 4.2 Import `issuesToFieldErrors`, `readFormFieldValues` from `../utils/schema-utils.ts`
- [x] 4.3 Replace `s.parse(offeringSaveSchema, ...)` try/catch with `s.parseSafe(offeringSaveSchema, formData)` in `create` action
- [x] 4.4 Replace `s.parse(offeringSaveSchema, ...)` try/catch with `s.parseSafe` in `update` action
- [x] 4.5 On parseSafe failure: extract formValues via `readFormFieldValues(OFFERING_FORM_KEYS, formData)`, extract fieldErrors via `issuesToFieldErrors(result.issues)`, call `buildErrorRedirect(formValues, { creating/editing, fieldErrors })`
- [x] 4.6 Remove `validateOfferingForm()` function — all field-level validation is now in schema `.refine()` chains
- [x] 4.7 Add manual `endMin <= startMin` check after successful parseSafe in both create and update actions
- [x] 4.8 Remove `ValidationResult` import from `../utils/form-errors.ts` (no longer needed)
- [x] 4.9 Remove old `f.object` definition for `offeringSaveSchema` (replaced by import from offering-schema.ts)

## 5. Admin appointments controller: switch to parseSafe

- [x] 5.1 Import `appointmentSaveSchema` and `APPOINTMENT_FORM_KEYS` from `../utils/appointment-schema.ts`
- [x] 5.2 Import `issuesToFieldErrors`, `readFormFieldValues` from `../utils/schema-utils.ts`
- [x] 5.3 Replace `s.parse(appointmentSaveSchema, ...)` try/catch with `s.parseSafe(appointmentSaveSchema, formData)` in `create` action
- [x] 5.4 Replace `s.parse(...)` try/catch with `s.parseSafe` in `update` action
- [x] 5.5 On parseSafe failure: extract formValues + fieldErrors, redirect via `buildErrorRedirectUrl(formValues, { creating/editing, fieldErrors })`
- [x] 5.6 Remove `validateAppointmentForm()` function
- [x] 5.7 Add manual `endMin <= startMin` check after parseSafe in both actions
- [x] 5.8 Remove old `appointmentSaveSchema` definition (replaced by import)

## 6. Client controller: refine schema

- [x] 6.1 Replace inline `registered` year validation with `.refine()` chain on the `registered` field in `clientSaveSchema`
- [x] 6.2 Move any remaining inline `parseInt`/`Number()` checks from `create` and `update` actions into schema `.refine()` chains
- [x] 6.3 Import `issuesToFieldErrors` from `../utils/schema-utils.ts` (deduplicate existing `issuesToFieldErrors` in client controller)
- [x] 6.4 Remove local `issuesToFieldErrors` and `extractFormValues` from client controller (replace with shared utilities)

## 7. Verification

- [x] 7.1 Run `npm run typecheck` and fix all type errors
- [x] 7.2 Run `npm test` and fix all test failures
- [x] 7.3 Manual smoke test: create offering with invalid fields → per-field errors via URL params + preserved values
- [x] 7.4 Manual smoke test: update offering with invalid fields → per-field errors + preserved values
- [x] 7.5 Manual smoke test: create appointment with invalid fields → per-field errors + preserved values
- [x] 7.6 Manual smoke test: update appointment with invalid fields → per-field errors + preserved values
- [x] 7.7 Manual smoke test: client create/update with invalid fields → re-render-from-POST with per-field errors
