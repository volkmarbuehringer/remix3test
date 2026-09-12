---
name: form-error-handling-remix3
description: "Use when handling form validation errors in Remix 3 — `parseSafe` direct re-render, preserved values, per-field errors, coerce/select pitfalls, and admin grid state on validation failure."
---

# Form Error Handling in Remix 3

Handle form validation errors with the **direct re-render** pattern (preferred): use `parseSafe` from `remix/data-schema` to make validation failures a return value instead of an exception, then re-render the page with `formValues` and `fieldErrors`.

The URL-param roundtrip pattern (`fv_`/`fe_` encoding) is **deprecated** — `form-params.ts` has been removed and all forms use direct re-render. Frame-based forms that once needed URL params are handled by the `ShellOrFragment` patch in `remix3-frame-cliententry`.

## When To Use This Skill

- Adding validation to a POST/PUT/DELETE form action
- Rendering per-field error messages next to form inputs
- Preserving submitted form values after a validation failure
- Preserving admin grid state (sort/filter/pagination) across a failed POST
- Testing form validation controller behavior

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| `parseSafe` + schema, value preservation, select fields, `coerce.number()`/empty-select and Postgres `number`-vs-string traps, cross-field and wizard checks, validation tests | `references/validation-and-schema.md` |
| Admin CRUD grids: a shared `loadPageData`, `grid-state.ts` hidden inputs, `renderGridFormError` returning **200 not 400**, error banners | `references/admin-grid-state.md` |
| Adding a new URL-query-param filter that drives a SQL `WHERE` (the 8+ touchpoint checklist) | `references/url-param-filter-checklist.md` |

## Core Rules

- Use `s.parseSafe`, never `s.parse`, for form validation. `parse` throws and loses error details; `parseSafe` returns `{ success, value }` or `{ success, issues }`.
- Extract raw string values from `FormData` **before** validation and pass them back as `formValues` so the user never re-types input.
- `formValues` (from a failed submit) take priority over row data (from the DB); fall back to the row only when absent.
- `<select>` does not honor `defaultValue` in Remix 3 — use `selected` on each `<option>`.
- Full-page/non-admin forms re-render with `{ status: 400 }`. Admin **grid** forms must render through `renderGridFormError`, which returns **200** so the frame shows inline errors (a non-OK response becomes an error card).
- Keep `formError` (form validation) and `error` (destroy flow) strictly separate — never chain them.

## References in This Codebase

- `app/utils/schema-utils.ts` — shared `issuesToFieldErrors()` and `readFormFieldValues()`
- `app/utils/offering-schema.ts` — declarative `f.object()` + `coerce.number()` + `.refine()`
- `app/utils/grid-state.ts` — `gridStateFromFormData`, `gridStateOverrides`, `gridStateToParams`
- `app/actions/client/controller.tsx` + `controller.test.ts` — Pattern 1 reference and tests
- `app/ui/admin-grid-error.tsx` — `renderGridFormError` (status 200)

## Related

- `remix3-frame-cliententry` — the `ShellOrFragment` patch that makes a 400 full-page re-render correct inside a `<Frame>`
- `remix-route-relocation` — route relocation checklist and form-validation upgrade cross-reference
- `.agents/knowledge/remix3-parseSafe-declarative-schemas.md`, `.agents/knowledge/remix3-render-from-post-validation.md`
