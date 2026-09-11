---
name: remix-forms
description: 'Use when working on Remix 3 forms/data — data-schema top-level `s.optional()`, delete confirmation via capture-phase delegation, password security/toggle, session.flash soft-fork routing.'
user-invocable: false
origin: consolidated
---

# Remix 3 Form & Data Patterns

**Consolidated from:** `remix-data-schema-optional-top-level`, `remix-data-confirm-delete-event-delegation`, `remix-password-form-patterns`, `remix-session-flash-soft-fork`

This skill is the **index** for form/data deltas. For validation and error re-render, use `form-error-handling-remix3`; for the framework API, the vendor `remix` skill references.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Adding a `confirm()` dialog to server-rendered delete forms; intercepting a form submit before frame navigation | `references/delete-confirmation.md` |
| Password confirmation (cross-field), keeping passwords out of `defaultValue`, visibility toggle (`data-toggle-pw`), the `app/ui` vs `app/assets` `clientEntry` trap | `references/password-forms.md` |
| One-shot UI state after a POST (routing card) that must self-clear on refresh — `session.flash()` vs `session.set()` | `references/session-flash-routing.md` |

## Core Rules

- `remix/data-schema` `.optional()`/`.nullable()` are **top-level functions**, not methods: use `s.optional(s.string())`, not `s.string().optional()` (`Property 'optional' does not exist on type 'Schema<...>'`). Full API: `~/remix/packages/data-schema/README.md`.
- Delete confirmation must intercept at the **capture-phase click** level (`{ capture: true }` + `preventDefault()` + `stopPropagation()`); a `submit`-phase listener can be preempted by frame navigation.
- Render exactly **one** `<ConfirmDelete />` per grid section — one per row causes N stacked `confirm()` dialogs.
- Never put `defaultValue` on password fields; exclude them from `readFormFieldValues` key arrays.
- Use `session.flash()` (not `session.set()`) for UI state that should render once and disappear on refresh.

## Related Skills

- `remix-controllers` — `form()` routes need `createController`
- `remix3-frame-cliententry` — clientEntry lifecycle, `ref()` usage, drag-and-drop (`references/cliententry-lifecycle.md`, `references/cliententry-dom-and-styling.md`), and input value across frame reloads (`references/frame-layout-and-testing.md`)
- `form-error-handling-remix3` — `parseSafe` validation re-render, `coerce.number()` empty-select pitfall, `<select selected>` type coercion
