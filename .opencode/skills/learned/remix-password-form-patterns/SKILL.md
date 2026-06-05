---
name: remix-password-form-patterns
description: "Server-side password confirmation, security-aware value preservation (no defaultValue on password fields), and visibility toggle for Remix 3 auth forms."
user-invocable: false
origin: auto-extracted
---

# Remix 3 Password Form Patterns

**Extracted:** 2026-06-05
**Context:** Adding password confirmation and visibility toggle to a Remix 3 registration form and reset-password form.

## Problem

Auth forms with password fields have three distinct concerns that standard form error handling patterns don't address:

1. **Cross-field validation**: Schema validators like `minLength(8)` check individual fields, but can't express "password === confirmPassword". You need a post-parse cross-field check.

2. **Security leak via `defaultValue`**: Admin form patterns preserve submitted values via `readFormFieldValues` + `defaultValue` on inputs. But password fields with `defaultValue` expose the submitted password in the HTML source — visible in View Source and DevTools, even though the browser masks it as dots.

3. **Password visibility toggle**: Remix 3 has no built-in password toggle. Using `clientEntry` in a shared UI file like `app/ui/auth-card.tsx` triggers the Remix asset server to trace imports through `remix/ui` into `@remix-run/async-context-middleware`, which imports `node:async_hooks` — a Node.js built-in that can't be bundled for the client. This causes `AssetServerCompilationError`.

## Solution

### 1. Cross-field password confirmation

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

### 2. Security: no `defaultValue` on password fields

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

### 3. Password visibility toggle via `data-toggle-pw`

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
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  </button>
</div>
```

### CSS for toggle button positioning

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

## Why clientEntry must be in `app/assets/`, not `app/ui/`

Placing `clientEntry(import.meta.url, ...)` in a file under `app/ui/` (like `auth-card.tsx`) triggers the Remix asset server to trace all imports from that file for client-side bundling. The trace follows `remix/ui` → `remix/middleware/async-context` → `@remix-run/async-context-middleware`, which imports `node:async_hooks` — a Node.js built-in that cannot be resolved for client bundles. This produces:

```
AssetServerCompilationError: Failed to resolve import "node:async_hooks"
```

The fix: keep `clientEntry` components in `app/assets/` (the designated directory for browser modules) and use `data-*` attributes + event delegation to bridge to server-rendered components.

## When to Use

- Adding password confirmation ("confirm password") to registration or password-reset forms
- Preserving submitted form values on validation errors while keeping password fields secure
- Adding password visibility toggle buttons to any form with password inputs
- When a `clientEntry` in `app/ui/` causes `AssetServerCompilationError` with `node:async_hooks`
