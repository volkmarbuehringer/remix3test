## Why

The Client Lab route (`/client`) already uses `Layout` directly without the `ShellOrFragment` frame wrapper, making it capable of re-render-from-POST. But its form actions return JSON error responses on validation failure, losing the form context. This refactors those actions to use the canonical Remix 3 pattern — `context.render(<Page formValues={...} fieldErrors={...} />, { status: 400 })` — demonstrating that form values and per-field errors survive a failed POST without URL params, session flash, or client-side JavaScript.

## What Changes

- Add `minLength(8)` to the `name` field schema in `app/actions/client/controller.tsx`
- Switch from `s.parse` + try/catch to `s.parseSafe` for form validation
- Replace `context.json()` error responses with `context.render()` re-render on validation failure, passing `formValues` and `fieldErrors` props
- Update `ClientEditPage` and `ClientCreatePage` to accept and render per-field errors and preserved form values
- Forward `formValues`/`fieldErrors` props through `ClientPage` to the edit/create sub-components
- Add `{ label: 'Client Lab', href: '/client' }` to the main navbar in `app/ui/nav.ts`
- The Frame-based grid and all other route behavior remain unchanged

## Capabilities

### New Capabilities

- `form-validation`: Server-side form validation using `parseSafe` that re-renders the form page on failure with per-field errors and preserved input values — no redirects, no URL params, no client-side JS required.

### Modified Capabilities

<!-- None — this is a new pattern applied to an existing route, not a requirement change to an existing spec. -->

## Impact

- `app/actions/client/controller.tsx` — schema changes, parseSafe, context.render on error
- `app/actions/client/page.tsx` — new props forwarded to sub-components
- `app/actions/client/edit-page.tsx` — new props, inline error display, value attributes
- `app/actions/client/create-page.tsx` — new props, inline error display, value attributes
- `app/ui/nav.ts` — navbar entry for Client Lab
- Existing tests in `app/actions/client/*.test.ts` may need updates
