---
name: remix3-forms
description: "Use when working on Remix 3 forms or form validation — data-schema top-level s.optional(), s.defaulted() returning its default without running the wrapped schema (defaulted→required fields silently bypass validation), parseSafe direct re-render with preserved values and per-field errors, coerce/select pitfalls and the empty-string select fallback, announcing and focusing server-rendered errors, admin grid state on validation failure, delete confirmation via capture-phase delegation or an in-app alertdialog with requestConfirm reuse, password security/toggle, session.flash soft-fork routing, a session value mutated in place that never persists, and a native form fallback on an SSE-backed agent decision route (approve/decline and ask_user questions without JS)."
user-invocable: false
origin: consolidated
---

# Remix 3 Forms & Validation Errors

Consolidated from 2 former learned skills (`remix-forms`, `form-error-handling-remix3`) on 2026-10-17. Reference files are namespaced under `references/<former-skill>/`. Everything vendor-supplied (guides, package READMEs, the vendor `remix` / `mastra` skills) stays authoritative — sections below are deltas only.

## Load Only The Sections You Need

| You need... | Section | References |
| --- | --- | --- |
| Forms/data — s.optional(), delete confirmation, password forms, session.flash soft-fork routing, non-persisting session values, native form on SSE decision route | § Forms & Mutations | `references/remix-forms/` |
| Form validation errors — parseSafe re-render, preserved values, per-field errors, coerce/select pitfalls, empty-string select fallback, admin grid state | § Validation Errors | `references/form-error-handling-remix3/` |

## Forms & Mutations

_(formerly `remix-forms` — references live under `references/remix-forms/`)_

**Consolidated from:** `remix-data-schema-optional-top-level`, `remix-data-confirm-delete-event-delegation`, `remix-password-form-patterns`, `remix-session-flash-soft-fork`

This skill is the **index** for form/data deltas. For validation and error re-render, use `remix3-forms § Validation Errors`; for the framework API, the vendor `remix` skill references.

The vendor guide `node_modules/remix/guides/09-forms-and-mutations.md` (authored as of rc.4) is canonical for the basics this skill does not restate: `parseSafe` re-render with preserved `values`/`issues` and status 400, `303`-after-save redirects, the frame `reloadStart`/`reloadComplete` "Saving…" pending button (§"Add pending feedback"), and `_method` override with `formMethod: "PATCH"` (§"Use other HTTP methods when the route calls for them"). The rules below stay deltas because the guide does not cover them: top-level `s.optional()`, capture-phase delete confirmation, password-form handling, and `session.flash()` soft-fork routing.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Adding a `confirm()` dialog to server-rendered delete forms; intercepting a form submit before frame navigation; replacing native `confirm()` with a styled native modal `<dialog>` (focus containment, inert page, focus restoration), reusing it from context-menu or bulk triggers, or freezing a bulk action's confirmed id set against a selection that changes behind the dialog (`formdata` rewrite) | `references/remix-forms/delete-confirmation.md` |
| Password confirmation (cross-field), keeping passwords out of `defaultValue`, visibility toggle (`data-toggle-pw`), the `app/ui` vs `app/assets` `clientEntry` trap | `references/remix-forms/password-forms.md` |
| One-shot UI state after a POST (routing card) that must self-clear on refresh — `session.flash()` vs `session.set()` | `references/remix-forms/session-flash-routing.md` |
| A session value you mutated in place is missing on the next request — storing a map/array/set in the session | `references/remix-forms/session-value-persistence.md` |
| An agent tool decision or `ask_user` question must be resolvable without JS; a native `<form>` must post to an SSE-backed route — resolving the pending gate, per-button `formaction`, repeated `answer` fields for multi-select, the `skipCsrf()` token fallback, draining the stream to `303` + flash | `references/remix-forms/native-form-on-sse-decision.md` |

### Core Rules

- `remix/data-schema` `.optional()`/`.nullable()` are **top-level functions**, not methods: use `s.optional(s.string())`, not `s.string().optional()` (`Property 'optional' does not exist on type 'Schema<...>'`). Full API: `node_modules/remix/src/data-schema/README.md`.
- Delete confirmation must intercept at the **capture-phase click** level (`{ capture: true }` + `preventDefault()` + `stopPropagation()`); a `submit`-phase listener can be preempted by frame navigation.
- A **bulk** confirmation must freeze the id set and rewrite the payload in the form's `formdata` listener — the dialog is not inert, Chromium builds the payload after `requestSubmit()` returns, and it can fire `formdata` more than once for one submission.
- Render exactly **one** `<ConfirmDelete />` per grid section — one per row causes N stacked `confirm()` dialogs.
- When a dialog re-submits, call `form.requestSubmit(submitter)`, never `form.submit()`: `submit()` bypasses the `submit` event and the frame runtime, producing a full-page navigation.
- Never put `defaultValue` on password fields; exclude them from `readFormFieldValues` key arrays.
- Use `session.flash()` (not `session.set()`) for UI state that should render once and disappear on refresh.
- Session values persist only through `session.set()`/`unset()`: both stores' `save()` write only when `session.dirty`, which in-place mutation never sets. Read-modify-write a **fresh** container and call `set()`; never mutate the object returned by `get()`.
- An SSE-backed decision endpoint can also accept a native form: render the resolved gate as `<form method="post">` (one form, per-button `formaction`), let a token-bearing form fall through `skipCsrf()` to the regular `csrf()` check, drain the SSE response server-side, then `303` + `session.flash()`. Enhance by intercepting `submit` and reusing the stream — never a click handler on a bare button.
- An `ask_user` question gate takes the same form: a hidden `selectionMode` plus named `answer` control(s). A multi-select posts the name repeatedly, so normalize `formData.getAll('answer')` to a JSON array in the controller for **both** transports — the engine parses a leading `[`. A single multi-select field may already hold that JSON array (SSE clients), so wrap only when the value does not start with `[`; a blanket wrap double-encodes. The customer `/chat` and admin `/admin/support-agent` gates share the `completeDecisionForm`/`normalizeAnswerFields` helpers in `app/utils/agent-chat.ts`.

### Related Skills

- `remix3-server § Controllers` — `form()` routes need `createController`
- `remix3-ui § Frames` — clientEntry lifecycle, `ref()` usage, drag-and-drop (`references/remix3-frame-cliententry/cliententry-lifecycle.md`, `references/remix3-frame-cliententry/cliententry-dom-and-styling.md`), and input value across frame reloads (`references/remix3-frame-cliententry/frame-layout-and-testing.md`)
- `remix3-forms § Validation Errors` — `parseSafe` validation re-render, `coerce.number()` empty-select pitfall, `<select selected>` type coercion
- `remix3-server § Security` — the `skipCsrf()` agent-path token fallback (`references/security-gotchas/security-middleware.md`)

---

## Validation Errors

_(formerly `form-error-handling-remix3` — references live under `references/form-error-handling-remix3/`)_

Handle form validation errors with the **direct re-render** pattern (preferred): use `parseSafe` from `remix/data-schema` to make validation failures a return value instead of an exception, then re-render the page with `formValues` and `fieldErrors`.

The URL-param roundtrip pattern (`fv_`/`fe_` encoding) is **deprecated** — `form-params.ts` has been removed and all forms use direct re-render. Frame-based forms that once needed URL params are handled by the `ShellOrFragment` patch in `remix3-ui § Frames`.

The vendor guide `node_modules/remix/guides/09-forms-and-mutations.md` (authored as of rc.4) canonically shows the `parseSafe` + preserved-`values`/`issues` + status-400 pattern (§"Return validation failures with the form", §"Parse and save the submitted form") and the `readText()` display-values helper. This skill keeps the app-specific deltas the guide cannot know: admin-grid `renderGridFormError` returning **200 not 400**, `<select>` `selected` over `defaultValue`, and the `coerce.number()` empty-select trap.

### When To Use This Skill

- Adding validation to a POST/PUT/DELETE form action
- Rendering per-field error messages next to form inputs
- Preserving submitted form values after a validation failure
- Preserving admin grid state (sort/filter/pagination) across a failed POST
- Re-rendering an admin edit form after a partial/API update with optional fields
- Testing form validation controller behavior

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| `parseSafe` + schema, value preservation, select fields, `coerce.number()`/empty-select and Postgres `number`-vs-string traps, the empty-string `""` select fallback, code-based `errorMap` localization, `role="alert"`/`aria-invalid`/focus-first-invalid wiring, cross-field and wizard checks, validation tests | `references/form-error-handling-remix3/validation-and-schema.md` |
| `s.defaulted()` returning its default **without running the wrapped schema** — defaulted→required fields silently bypass validation; missing-field fail-fast and issue-message mapping (`promptSchema`, `promptIssueMessage`) | `references/form-error-handling-remix3/defaulted-skips-validation.md` |
| Admin CRUD grids: a shared `loadPageData`, `grid-state.ts` hidden inputs, `renderGridFormError` returning **200 not 400**, error banners, partial updates with optional fields, open edit/create panel state | `references/form-error-handling-remix3/admin-grid-state.md` |
| Adding a new URL-query-param filter that drives a SQL `WHERE` (the 8+ touchpoint checklist), or separating status tabs from text search | `references/form-error-handling-remix3/url-param-filter-checklist.md` |

### Core Rules

- Use `s.parseSafe`, never `s.parse`, for form validation. `parse` throws and loses error details; `parseSafe` returns `{ success, value }` or `{ success, issues }`.
- Localize built-in check messages through `parseSafe(..., { errorMap })` keyed on `context.code`; Standard Schema issues carry no `code` (only `message`/`path`), and comparing the vendor's English `message` breaks on rewording.
- **`s.defaulted(chained, default)` returns its default without running the wrapped schema** — never wrap a required/validated field in it. A defaulted→required field parses the default as a *success*, silently bypassing every `.refine` in the chain. Let missing fields fail the base type check and map the generic issue at the response boundary (`promptIssueMessage()` in `app/actions/agent-events/controller.tsx`). Details + pinned vendor line refs (`schema.ts:515/519-525`, build `7f900151`): `references/form-error-handling-remix3/defaulted-skips-validation.md`.
- Extract raw string values from `FormData` **before** validation and pass them back as `formValues` so the user never re-types input.
- `formValues` (from a failed submit) take priority over row data (from the DB); fall back to the row only when absent. For optional update fields, make absence real with `formData.has(key)`; otherwise `readFormFieldValues()` fills `''` and the row is overwritten.
- Never overload one grid param: status tabs get `status`, free-text search gets `filter` (trimmed, LIKE-escaped, ORed with a numeric id). Grid navigation links must re-append an open `editing`/`creating` panel.
- `<select>` does not honor `defaultValue` in Remix 3 — use `selected` on each `<option>`.
- A cleared select submits `""`, and `"" != null` is true: normalize the preserved id to `""` and select a disabled placeholder option when empty, or the browser shows the first option while the field error says required.
- Server-rendered errors need `role="alert"`, `aria-invalid`/`aria-describedby` on the control, and a focus-first-invalid `clientEntry`; the markup alone is silent to screen readers.
- Full-page/non-admin forms re-render with `{ status: 400 }`. Admin **grid** forms must render through `renderGridFormError`, which returns **200** so the frame shows inline errors (a non-OK response becomes an error card).
- Keep `formError` (form validation) and `error` (destroy flow) strictly separate — never chain them.

### References in This Codebase

- `app/utils/schema-utils.ts` — shared `issuesToFieldErrors()` and `readFormFieldValues()`
- `app/actions/agent-events/controller.tsx` — `promptSchema` (required field, no `s.defaulted`) + `promptIssueMessage()` response-boundary mapping, tested in `prompt-schema.test.ts`
- `app/utils/offering-schema.ts` — declarative `f.object()` + `coerce.number()` + `.refine()`
- `app/utils/grid-state.ts` — `gridStateFromFormData`, `gridStateOverrides`, `gridStateToParams`
- `app/actions/client/controller.tsx` + `controller.test.ts` — direct-re-render reference and tests
- `app/ui/admin-grid-error.tsx` — `renderGridFormError` (status 200)

### Related

- `remix3-ui § Frames` — the `ShellOrFragment` patch that makes a 400 full-page re-render correct inside a `<Frame>`
- `remix3-server § Route Wiring` (`references/remix3-route-wiring/route-relocation.md`) — route relocation checklist and form-validation upgrade cross-reference
