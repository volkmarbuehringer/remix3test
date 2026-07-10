## Why

The canonical Remix 3 pattern for form validation — `context.render(<Page errors={...} formValues={...} />, { status: 400 })` — works when rendering through `Layout` directly but has never been demonstrated end-to-end in newapp with field-level validation and form value preservation. Auth pages use it only for a single error string and lose input values. Admin pages cannot use it due to the `ShellOrFragment` frame layout discarding children on POST. A test route provides a clean reference implementation proving the pattern works and where the frame-layout boundary lies.

## What Changes

- Add a new `/test-form` route with a standalone controller
- GET handler renders a sample form (name, email, message fields)
- POST handler validates input with `parseSafe`, returning field-level errors and preserving submitted values on failure via `context.render()`
- Success path redirects to a simple confirmation page
- Route uses `Layout` directly, bypassing the `ShellOrFragment`/admin frame pipeline
- Form page component accepts `formValues` and `fieldErrors` props and renders `value` attributes on inputs

## Capabilities

### New Capabilities

- `form-render-post`: A form that validates input server-side and re-renders the page on validation failure, preserving the user's submitted values and showing per-field error messages — without URL parameters, session flash, or redirects.

### Modified Capabilities

<!-- None -->

## Impact

- New route definition in `app/routes.ts` (`testForm`)
- New controller at `app/actions/test-form-controller.tsx`
- New page component (inline or co-located) for the form UI
- New route mapping in `app/router.ts`
- No changes to existing routes, middleware, or rendering pipeline
