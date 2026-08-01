---
name: remix-forms
description: 'Remix 3 form patterns — data-schema optional syntax, delete confirmation via capture-phase event delegation, password field security, and session.flash soft-fork routing'
user-invocable: false
origin: consolidated
---

# Remix 3 Form & Data Patterns

**Consolidated from:** `remix-data-schema-optional-top-level`, `remix-data-confirm-delete-event-delegation`, `remix-password-form-patterns`, `remix-session-flash-soft-fork`

Covers four aspects of Remix 3 forms and data:
1. `remix/data-schema` optional/nullable syntax (top-level functions, not methods)
2. Delete confirmation via capture-phase click event delegation
3. Password form patterns (cross-field validation, value security, visibility toggle)
4. Using `session.flash()` for soft-fork routing decisions

---

## Part 1: `remix/data-schema`: `.optional()` is a Top-Level Function

### Gotcha

TypeScript reports `Property 'optional' does not exist on type 'Schema<unknown, string>'` when using `.optional()` as a method. It exists — but as a **top-level function**, not a method. Use `s.optional(...)` wrapping the schema expression:

```ts
import * as s from 'remix/data-schema'

const mySchema = s.object({
  name: s.optional(s.string()), // ✅ not s.string().optional()
  tags: s.optional(s.array(s.string())),
})
```

Both `s.optional()` and `s.nullable()` are exported as standalone functions. For the full API, see `~/remix/packages/data-schema/README.md`.

---

## Part 2: Delete Confirmation via Event Delegation

### Problem

Server-rendered delete forms (`<form method="POST">` with a DELETE override) have no built-in confirmation. You need to add a `confirm()` dialog, but:

1. **`onclick`/`onsubmit` attributes** fail TypeScript — they're not valid props in Remix 3's JSX types
2. **`on` mixin** silently fails on server-rendered components (only works inside `clientEntry`)
3. **Per-component clientEntry** requires converting each form into a separate clientEntry component with its own props, action URL, and hidden inputs — lots of boilerplate
4. **`submit` event listeners** at the document level are unreliable in Remix 3 frame navigation — the Remix router intercepts the form submission before the native `submit` event fires, silently skipping the confirm dialog

### Root Cause

Remix 3's frame navigation (`rmx-target`) intercepts form submissions at the click/pointer level using its own event handling, which can preempt the native `submit` event. A `submit`-phase listener may never fire.

### Solution

Use a **single shared `clientEntry`** with a **capture-phase `click` listener** that intercepts clicks on submit buttons inside `[data-confirm]` forms _before_ Remix's router intercepts them.

#### 1. Create the shared component

```tsx
// app/assets/confirm-delete.tsx
import { clientEntry, css, ref, type Handle } from 'remix/ui'

export const ConfirmDelete = clientEntry(
  import.meta.url + '#ConfirmDelete',
  function ConfirmDelete(handle: Handle) {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            document.addEventListener(
              'click',
              (e) => {
                let target = e.target as HTMLElement
                let btn = target.closest('button[type="submit"]') as HTMLButtonElement | null
                if (!btn) return
                let form = btn.closest('form[data-confirm]') as HTMLFormElement | null
                if (!form) return
                let message = form.getAttribute('data-confirm') || 'Wirklich löschen?'
                if (!confirm(message)) {
                  e.preventDefault()
                  e.stopPropagation()
                }
              },
              { capture: true, signal: handle.signal },
            )
          }),
        ]}
      />
    )
  },
)
```

#### 2. Add to page + attribute to forms

```tsx
import { ConfirmDelete } from '../assets/confirm-delete.tsx'

// In the page component, render it once inside the grid wrapper:
<div mix={table.minWidth0}>
  <ConfirmDelete />
  {/* ... table, forms, etc ... */}
</div>

// On each delete form, add the data-confirm attribute:
<RestfulForm
  method="DELETE"
  action="/resources/123"
  data-confirm="Wirklich löschen?"
>
  {/* ... hidden inputs, buttons ... */}
</RestfulForm>
```

#### Key Details

- **Capture phase** (`{ capture: true }`): The listener fires during the capture phase, before Remix's own event handling in the bubble phase. This ensures the confirm dialog appears before any navigation starts.
- **`e.preventDefault()` + `e.stopPropagation()`**: Both are needed. `preventDefault()` cancels the click, `stopPropagation()` prevents Remix's frame navigation handler from firing.
- **`handle.signal`**: The AbortSignal from `clientEntry` auto-cleans up the listener when the component unmounts.
- **`data-confirm` on the `<form>`**: The attribute lives on the form element, not the button, so it survives any button restructuring.
- **Single instance per page**: One `<ConfirmDelete />` at the grid section level handles all delete forms in that section.

#### Pitfall: Multiple `<ConfirmDelete />` Instances Break Confirmation

Rendering `<ConfirmDelete />` inside a loop (e.g., inside `.map()`) creates **N instances**, each registering its own `document`-level capture-phase click listener via `ref()`. Clicking any delete button fires **all N listeners** — the user sees N consecutive `confirm()` dialogs. Clicking OK on the first and Cancel on any subsequent one calls `preventDefault()` and blocks form submission.

```tsx
// ❌ WRONG — N instances, N listeners, N dialogs on one click
{
  items.map((item) => (
    <div key={item.id}>
      <form data-confirm="Löschen?">...</form>
      <ConfirmDelete />
    </div>
  ))
}

// ✅ CORRECT — single instance handles all forms
{
  items.map((item) => (
    <div key={item.id}>
      <form data-confirm="Löschen?">...</form>
    </div>
  ))
}
;<ConfirmDelete />
```

**Root cause:** `clientEntry`'s `ref()` callback runs once per rendered instance during hydration. Unlike React's synthetic event delegation (which deduplicates at the root), each `clientEntry` instance independently calls `document.addEventListener(...)`. Since all listeners share `capture: true` and the same selector logic, they all match the same click target and all fire.

**Test for this bug:** Click a delete button and count the confirmation dialogs. If you see more than one, you have multiple `<ConfirmDelete />` instances on the page.

#### Comparison

| Approach                                          | Boilerplate                                                    | Reliability                                               | Scalability                      |
| ------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------- |
| Per-component clientEntry (`on` mixin)            | High — each form needs its own component with serialized props | Medium — works only if `on` fires before Remix intercepts | Low — N components for N forms   |
| `submit` event listener (bubble phase)            | Low — one listener                                             | Low — may not fire in frame navigation                    | High — one listener handles all  |
| **Capture-phase click delegation** (this pattern) | Low — one component + `data-confirm` attribute                 | High — fires before Remix intercepts                      | High — one component handles all |

---

## Part 3: Password Form Patterns

### Problem

Auth forms with password fields have three distinct concerns that standard form error handling patterns don't address:

1. **Cross-field validation**: Schema validators like `minLength(8)` check individual fields, but can't express "password === confirmPassword". You need a post-parse cross-field check.

2. **Security leak via `defaultValue`**: Admin form patterns preserve submitted values via `readFormFieldValues` + `defaultValue` on inputs. But password fields with `defaultValue` expose the submitted password in the HTML source — visible in View Source and DevTools, even though the browser masks it as dots.

3. **Password visibility toggle**: Remix 3 has no built-in password toggle. Using `clientEntry` in a shared UI file like `app/ui/auth-card.tsx` triggers the Remix asset server to trace imports through `remix/ui` into `@remix-run/async-context-middleware`, which imports `node:async_hooks` — a Node.js built-in that can't be bundled for the client. This causes `AssetServerCompilationError`.

### Solution 1: Cross-field password confirmation

Validate individual fields with the schema, then add a post-parse check for matching passwords:

```typescript
import * as s from 'remix/data-schema'
import { minLength } from 'remix/data-schema/checks'
import * as f from 'remix/data-schema/form-data'

const registerSchema = f.object({
  name: f.field(s.string().pipe(minLength(1))),
  email: f.field(s.string().pipe(email())),
  password: f.field(s.string().pipe(minLength(8))),
  confirmPassword: f.field(s.string().pipe(minLength(1))),
})

// In the action handler:
let parsed = s.parseSafe(registerSchema, formData)
if (!parsed.success) {
  return context.render(
    <Page errors={issuesToFieldErrors(parsed.issues)} />,
    { status: 400 },
  )
}

// Cross-field check AFTER schema parse — both fields validated individually
if (parsed.value.password !== parsed.value.confirmPassword) {
  return context.render(
    <Page error="Passwords do not match." errors={{ confirmPassword: 'Passwords do not match' }} />,
    { status: 400 },
  )
}
```

### Solution 2: Security — no `defaultValue` on password fields

When using the standard `readFormFieldValues` + render-on-error pattern, **exclude password fields** from both the form keys array and the input's `defaultValue`:

```typescript
// Only non-sensitive fields — NEVER include password/confirmPassword
const FORM_KEYS = ['name', 'email'] as const

let formValues = readFormFieldValues(FORM_KEYS, formData)
let parsed = s.parseSafe(registerSchema, formData)
if (!parsed.success) {
  return context.render(
    <Page errors={issuesToFieldErrors(parsed.issues)} formValues={formValues} />,
    { status: 400 },
  )
}
```

```tsx
{/* Safe: name and email use defaultValue */}
<input name="name" defaultValue={formValues?.name ?? ''} />
<input name="email" defaultValue={formValues?.email ?? ''} />

{/* SECURITY: NO defaultValue on password fields */}
<input type="password" name="password" />
<input type="password" name="confirmPassword" />
```

### Solution 3: Password visibility toggle via `data-toggle-pw`

Create a `clientEntry` in `app/assets/` (NOT in `app/ui/`) that uses document-level event delegation:

```typescript
// app/assets/password-toggle.tsx
import { clientEntry, type Handle } from 'remix/ui'

const eyeSvg = `<svg xmlns="..." width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`

const eyeOffSvg = `<svg xmlns="..." ...><path d="M17.94 17.94..."/><line x1="1" y1="1" x2="23" y2="23"/></svg>`

export const PasswordToggle = clientEntry(
  import.meta.url + '#PasswordToggle',
  function PasswordToggleEntry(_handle: Handle) {
    let initialized = false
    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true
        document.addEventListener('click', (e) => {
          let btn = (e.target as HTMLElement).closest('[data-toggle-pw]') as HTMLElement | null
          if (!btn) return
          let fieldName = btn.getAttribute('data-toggle-pw')
          if (!fieldName) return
          let form = btn.closest('form')
          if (!form) return
          let input = form.querySelector<HTMLInputElement>(`[name="${fieldName}"]`)
          if (!input) return
          let isPassword = input.type === 'password'
          input.type = isPassword ? 'text' : 'password'
          btn.innerHTML = isPassword ? eyeOffSvg : eyeSvg
          btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password')
        })
      }
      return null
    }
  },
)
```

Render the toggle once via a shared component (e.g., in `AuthForm`):

```typescript
// app/ui/auth-card.tsx (or your shared form component)
import { PasswordToggle } from '../assets/password-toggle.tsx'

export function AuthForm(handle: Handle<AuthFormProps>) {
  return () => (
    <form ...>
      <PasswordToggle />   {/* renders nothing, just registers listener */}
      ...
    </form>
  )
}
```

Server-render the toggle buttons with `data-toggle-pw` pointing to the input's `name`:

```tsx
<div mix={inputWrapperCss}>
  <input type="password" name="password" />
  <button type="button" data-toggle-pw="password" aria-label="Show password" mix={toggleButtonCss}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  </button>
</div>
```

#### CSS for toggle button positioning

```typescript
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'

export const inputWrapperCss = css({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
})

export const inputHasToggleCss = css({
  paddingRight: '2.25rem',
})

export const toggleButtonCss = css({
  position: 'absolute',
  right: '0.25rem',
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '2rem',
  height: '2rem',
  padding: 0,
  border: 'none',
  borderRadius: theme.radius.sm,
  background: 'transparent',
  color: theme.colors.text.muted,
  cursor: 'pointer',
  '&:hover': {
    color: theme.colors.text.primary,
    background: theme.surface.lvl1,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.action.primary.background}`,
    outlineOffset: -2,
  },
})
```

#### Why clientEntry must be in `app/assets/`, not `app/ui/`

Placing `clientEntry(import.meta.url, ...)` in a file under `app/ui/` (like `auth-card.tsx`) triggers the Remix asset server to trace all imports from that file for client-side bundling. The trace follows `remix/ui` → `remix/middleware/async-context` → `@remix-run/async-context-middleware`, which imports `node:async_hooks` — a Node.js built-in that cannot be resolved for client bundles. This produces:

```
AssetServerCompilationError: Failed to resolve import "node:async_hooks"
```

The fix: keep `clientEntry` components in `app/assets/` (the designated directory for browser modules) and use `data-*` attributes + event delegation to bridge to server-rendered components.

---

## Part 4: Session Flash for Soft-Fork Routing

### Problem

When a user completes an action (e.g., booking an appointment) and you want to show a routing decision card ("Fertig" / "Noch einen Termin"), using `session.set()` creates a hard gate:

```
action handler:
  session.set('routingFlag', '1')  // ← persistent across refreshes

index handler:
  if (session.get('routingFlag')) → render routing card, hide textarea
```

This causes two bugs:

1. **Stuck state on refresh**: The flag persists, so the routing card shows again even after refresh. The user can't type or interact normally.
2. **Stuck state on missing display data**: If `session.set('bookingResult', msg)` is consumed but `session.set('routingFlag')` persists, the UI renders nothing — no routing card (no text), no textarea (flag blocks it).

### Solution

Use `session.flash()` instead of `session.set()` for any UI state that should only render once and disappear on refresh:

```typescript
// Action handler — use flash for one-time state
session.flash('postBookingDecision', '1')
session.set('bookingResult', 'Termin #42 wurde gebucht.')

// Index handler — flash is consumed on read
let postBookingDecision = session.get('postBookingDecision')  // returns '1' once, then null
let bookingResult = session.get('bookingResult')

// Always consume bookingResult after reading
if (bookingResult) session.unset('bookingResult')
```

The routing card renders only on the first GET after the POST. On refresh, the flash is gone and the normal chat UI returns.

---

## When to Use

- Writing a schema with `s.object({ ... })` that needs optional fields (`Property 'optional' does not exist on type 'Schema<...>'`)
- Porting from Zod where `.optional()` is a method — Remix's `data-schema` requires the top-level wrapper
- Adding `confirm()` dialogs to server-rendered `<form>` elements in Remix 3 admin grids
- Any time you need to intercept form submission before Remix's frame navigation (`rmx-target`) handles it
- Adding password confirmation ("confirm password") to registration or password-reset forms
- Preserving submitted form values on validation errors while keeping password fields secure
- Adding password visibility toggle buttons to any form with password inputs
- When a `clientEntry` in `app/ui/` causes `AssetServerCompilationError` with `node:async_hooks`
- Post-action routing decisions and any session state that should self-clean on page refresh

## Related Skills

- `remix-password-form-patterns` covered in Part 3 above
- `remix-createController-requires-route-map` — `form()` routes need `createController`
- `remix3-cliententry-drag-and-drop` — clientEntry lifecycle and `ref()` usage
- `remix-frame-input-value-preservation` — input value behavior across frame reloads
- `form-error-handling-remix3` — `parseSafe` validation re-render, `coerce.number()` empty-select pitfall, `<select selected>` type coercion
