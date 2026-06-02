## Why

The `/admin/appointments` form currently shows all validation errors as a single banner message at the top of the page. When validation fails, the form redirects with `?error=` which loses all user input — every field resets to default values. This is a poor UX: users can't tell which field is wrong and have to re-enter everything.

## What Changes

- Replace the redirect-on-error pattern with a re-render-on-error pattern in the admin appointments controller — the frame receives rendered HTML directly instead of following a redirect
- Add structured per-field validation errors (`Record<string, string>`) returned alongside form-level errors
- Thread `formValues` and `fieldErrors` through the page component stack so inputs render with submitted values preserved and per-field error messages inline
- Apply the existing `input.error` CSS mixin on errored fields
- Show form-level errors (past dates, overlaps, outside offering hours) in the existing banner slot
- Keep the success path as a redirect (302 → list with `?editing=ID`)

## Capabilities

### New Capabilities
- *(none — this enhances an existing capability)*

### Modified Capabilities
- `admin-appointments`: New requirement — appointment form MUST render per-field validation errors inline and preserve submitted values on validation failure instead of resetting all inputs. Field errors are rendered adjacent to the corresponding input. Form-level errors (overlap, past date, outside offering hours) remain as a top banner.

## Impact

- **Controller**: `admin-appointments-controller.tsx` — `create` and `update` actions return `context.render()` instead of redirect on validation failure; `validateAppointmentForm()` returns structured `{ fieldErrors?, formError? }` instead of `string | null`
- **Page component**: `AdminAppointmentsPage` — accepts `fieldErrors` and `formValues` props, threads them to the form panel
- **Form component**: `AdminAppointmentsForm` — accepts `fieldErrors` and `formValues` props; renders inline error messages and pre-fills inputs with submitted values
- **CSS mixin**: `input.error` already exists and is used
