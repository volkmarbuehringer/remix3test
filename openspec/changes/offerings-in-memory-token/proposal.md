## Why

Remix 3 demos (`timeboxer`, `social-auth`, `bookstore`) establish a clear pattern for form validation with value preservation: **re-render from POST** — the controller calls `context.render(<Page values={...} errors={...} />)` directly instead of redirecting. The browser URL stays as the POST URL, so form state is naturally preserved without URL params, session flash, or in-memory stores.

The `admin-appointments` controller already has per-field validation (`{ ok, fieldErrors }`), form value preservation, and inline error rendering — but implements it via 302 redirect + URL param encoding (`fv_`/`fe_`). This approach has known issues: URL bloat, address-bar visibility, and type-coercion bugs (PostgreSQL `number` vs URL `string`). The `admin-offerings` controller (`/admin/offerings`) still uses the old `string | null` validation and has no per-field errors at all.

This change introduces a **general reusable validation pattern** following Remix 3's recommended approach (re-render from POST, per-field errors via `Record<string, string>`) and applies it first to `admin-offerings`. The pattern is designed to be portable to all admin forms (`admin-users`, `admin-resources`, `admin-offering-configs`, etc.) in later changes.

## What Changes

- Add shared form validation utility in `app/utils/form-errors.ts`:
  - `type ValidationResult = { ok: true } | { ok: false, fieldErrors: Record<string, string> }`
  - `function fieldErrorsFromResult(result: ValidationResult): Record<string, string> | undefined`
- Apply the pattern to `admin-offerings`:
  - Change `validateOfferingForm()` return type from `string | null` to `ValidationResult`
  - Replace 302 redirect on validation errors with `renderOfferingsPage(context, data)` returning 200 HTML
  - Preserve submitted form values via `formValues` prop extracted from `context.formData`
  - Render per-field inline errors with `input.error` CSS mixin on errored fields
  - Keep 302 redirect for success path (PRG pattern)
  - Keep 302 redirect for business-rule errors (holiday, past-date, exclusion) — these are form-level, not field-level
  - Remove manual `backState`/`backParams` grid state reconstruction from error paths
- Add `formValues` and `fieldErrors` props to `AdminOfferingsCreatePage` and `AdminOfferingsEditPage`
- Add `formError` banner prop for business-rule error messages

## Capabilities

### New Capabilities

- `admin-offerings-form-validation`: Per-field validation with form value preservation for admin offerings create/edit forms, using re-render-from-POST (Remix 3 recommended pattern) with `context.render()`

## Impact

- `newapp/app/utils/form-errors.ts` — new shared validation utility
- `newapp/app/actions/admin-offerings-controller.tsx` — new validation return type, re-render on validation failure, page data loader extraction
- `newapp/app/ui/admin-offerings-create-page.tsx` — accept `formValues`/`fieldErrors`/`formError` props
- `newapp/app/ui/admin-offerings-edit-page.tsx` — accept `formValues`/`fieldErrors`/`formError` props
- `newapp/app/ui/admin-offerings-page.tsx` — accept and thread new props
- No dependency changes, no route changes, no middleware changes
