## Context

Three verwaltung forms currently use different error handling patterns:

| Form | Current Pattern | Form Values Preserved? | Inline Errors? |
|------|----------------|----------------------|----------------|
| Offerings | 302 redirect with `fv_*`/`fe_*` URL params | Yes (via decode) | Yes |
| Resources | `context.json({ ok: false }, 400)` | No | No |
| Offering-configs | `context.json({ ok: false }, 400)` | No | No |

The `/client` route demonstrates the preferred pattern: on validation failure, the controller calls `context.render()` directly with the page component, passing `formValues` (raw `FormData` entries) and `fieldErrors` (from `issuesToFieldErrors()`) as props, returning status 400. No redirect, no URL encoding/decoding, no JSON error response.

Since the verwaltung routes now use `renderVerwaltungPage` (a simple `<Layout>` wrapper without frame-based rendering), `context.render()` from POST actions works correctly.

## Goals / Non-Goals

**Goals:**
- Unify all three forms to the same render-on-error pattern used by /client
- Remove redirect-based error handling from offerings controller
- Add field preservation and inline error display to resources and offering-configs forms
- Pass `formValues` and `fieldErrors` directly as props on error

**Non-Goals:**
- Changing the appointments controller (has more complex calendar integration, separate change)
- Changing validation schemas or business rules
- Changing grid state handling (hidden `_offset`/`_sort`/`_order`/`_filter` form fields continue to work)

## Decisions

**1. Direct re-render on validation failure, status 400**

All three controllers call `renderVerwaltungPage(context.render, <PageComponent .../>, { status: 400 })` on validation failure.

Rationale: Matches the /client pattern. No redirect means no URL bloat. Status 400 signals client error for debugging.

**2. Offerings: render `AdminOfferingsPage` directly from create/update**

The existing `renderOfferingsPage(context, data)` helper already works for both index and error re-render paths. On error in create/update, load data via `loadOfferingPageData(context)` with form value/error overrides, then render. Remove `buildErrorRedirect()` entirely.

**3. Resources and offering-configs: add `formValues`/`fieldErrors` props to page components**

These pages currently have no field-level error display. Add:
- `formValues?: Record<string, string>` prop — pre-fill inputs on error
- `fieldErrors?: Record<string, string>` prop — show inline error messages
- Error styling on inputs with errors (red border, error text below field)

Follow the exact pattern from offerings forms and /client forms.

**4. Resources validation: use `s.parseSafe` with a real schema**

Currently resources uses `s.parse()` with `resourceSaveSchema` and catches exceptions. Switch to `s.parseSafe()` to get typed validation issues, then use `issuesToFieldErrors()` for per-field errors. Pass raw values via `readFormFieldValues()` for field preservation.

**5. Offering-configs validation: use `s.parseSafe` with a real schema**

Same change as resources — switch from `s.parse()` to `s.parseSafe()` for the `offeringConfigSchema`, allowing per-field error extraction.

**6. Business-rule errors still use JSON or a separate flow**

Resources and offering-configs have business-rule checks (duplicate resource, start >= end range, etc.) that are not field-level. These can continue using `context.json()` for now, or be added as `formError` in the page data — whichever is simpler per case.

## Risks / Trade-offs

- **Risk: Resources/offering-configs pages need new error UI** — These pages currently have no inline error display. Adding it requires DOM changes.
  - Mitigation: Follow the exact pattern from offerings forms and /client forms. The pattern is well-established in the codebase.
- **Risk: Frame layout assumptions** — The old `buildErrorRedirect` existed because `context.render()` from POST was incompatible with Frame architecture. Since verwaltung no longer uses frames, this is not a concern.
  - Mitigation: Already addressed by the verwaltung-route-tree change.
