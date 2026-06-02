## Context

The admin appointments controller (`admin-appointments-controller.tsx`) handles CRUD at `/admin/appointments` using frame-based navigation (`rmx-target`). Currently, all mutations return HTTP redirects on validation failure, passing a single error string via `?error=`. The page then re-renders with blank default inputs.

The frame mechanism (Remix) replaces frame content with the HTTP response body. A `context.render()` response on a POST is handled the same as a redirect — the content is swapped into the target frame. This means re-rendering on error works without any client-side changes.

The form has 6 fields: 4 `<select>` elements (resource, user, start_min, end_min) and 2 `<input>` elements (title, date). The `input.error` CSS mixin already exists for red border styling.

## Goals / Non-Goals

**Goals:**
- Replace redirect-on-validation-failure with re-render in `create` and `update` actions
- Change `validateAppointmentForm()` to return `{ ok: true } | { ok: false, fieldErrors?: Record<string, string>, formError?: string }`
- Thread `formErrors` and `formValues` through AdminAppointmentsPage → AdminAppointmentsForm
- Render per-field error messages adjacent to each input
- Apply `input.error` CSS on errored fields
- Preserve submitted values on re-render (including `<select>` selection state)

**Non-Goals:**
- No changes to the `destroy` action (no form to validate)
- No changes to the `index` action beyond reading new query params
- No client-side validation (remains server-only, can be added separately)
- No changes to other admin forms (offerings, nutzer)
- No changes to the shared `input` mixin

## Decisions

1. **Re-render instead of redirect on validation failure**: The frame mechanism handles `context.render()` responses from POST naturally — it swaps the HTML into the target frame. This preserves form state without session tricks or URL encoding. Redirects are only used on success. This is the same pattern already used by the auth controllers (`auth-register-controller.tsx`, `auth-login-controller.tsx`).

2. **Structured error return from validation**: Change `validateAppointmentForm()` from returning `string | null` to returning `{ ok: true } | { ok: false, fieldErrors: Record<string, string>, formError?: string }`. This allows the controller to distinguish per-field errors from form-level errors and pass them through to the UI. The function already knows which field failed — the mapping is direct (e.g., "Ressource ist erforderlich." → `{ resource_id: "ist erforderlich." }`).

3. **Value priority chain for form inputs**: `formValues` (from submitted form data) > `row` (from DB for edit mode) > `defaults` (for create mode). On the error re-render path, `formValues` is populated from the parsed form data. On the initial GET, it's undefined and the existing fallback chain applies.

4. **Frame-level errors as URL params, field-level as props**: Both error types are returned via `context.render()` props. This is cleaner than the current `?error=` approach because structured data doesn't need URL serialization. However, for consistency with frame navigation that might reload the index page directly, we keep the `?error=` URL param as a fallback for the initial GET path.

5. **Success path unchanged**: On successful create/update, the controller still returns a 302 redirect. This is correct — it navigates back to the list view with `?editing=ID` to show the result.

## Risks / Trade-offs

- **[Risk] Form state lost on browser refresh after error**: If the user refreshes the page after a validation error re-render, the form reverts to its initial state (create = blank, edit = DB values). This is acceptable — it's the same behavior users experience today, and the error message would be lost on refresh regardless.
- **[Risk] Select elements need careful value restoration**: `<select>` elements use `selected` on `<option>`, not `value` on `<select>`. The re-render needs to compute the correct `selected` attribute from `formValues` on the error path. This is already handled in edit mode (which computes `selected` from `row`), so the pattern extends naturally.
- **[Trade-off] No client-side validation**: Adding real-time client-side validation (on blur/input) would reduce server round-trips but is out of scope. The server-side re-render pattern is fast enough for frame navigation.
- **[Risk] Large form submissions could fragment**: If the form grows significantly, passing all field values through `context.render()` props could become verbose. For the current 6-field form this is negligible.
