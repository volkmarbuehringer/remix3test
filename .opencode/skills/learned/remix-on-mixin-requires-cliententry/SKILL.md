---
name: remix-on-mixin-requires-cliententry
description: "The `on` event mixin only fires inside `clientEntry` components in Remix 3 — it silently fails in server-rendered components."
user-invocable: false
origin: auto-extracted
---

# Remix 3: `on` Mixin Silently Fails in Server-Rendered Components

**Extracted:** 2026-06-04
**Context:** Adding a "Vergangene löschen" button with a `confirm()` dialog to an admin offerings page in a Remix 3 project.

## Problem

Using the `on` event mixin from `remix/ui` in a server-rendered Remix 3 component (not wrapped in `clientEntry`) compiles without errors but the event handler **never fires** on the client. Attempts to use raw HTML event attributes (`onsubmit`, `onclick`) as string props also fail with TypeScript errors.

### What was tried (all failed)

```tsx
// ❌ TypeScript error — 'onsubmit' not a valid prop
<form onsubmit="return confirm('Wirklich löschen?')">

// ❌ Compiles, but handler never fires (server-rendered component)
import { on } from 'remix/ui'
<form mix={on('submit', (e) => { if (!confirm('...')) e.preventDefault() })}>

// ❌ Same — compiles but never fires
<Button mix={on('click', () => { if (!confirm('...')) return })}>
```

## Root Cause

The `on` mixin generates event handler code that only gets hydrated when the component is a `clientEntry`. In server-rendered components, the mixin output is static HTML with no client-side JavaScript to attach the handler.

## Solution

Wrap the interactive element in a `clientEntry` component. This is the established pattern in the codebase (see `admin-action-button.tsx`, `admin-offerings-context-menu.tsx`).

```tsx
// ✅ Works — clientEntry ensures the on() handler is hydrated
import { clientEntry, on, type Handle, type SerializableProps } from 'remix/ui'
import { Button } from 'remix/ui/button'

interface DeleteButtonProps extends SerializableProps {
  csrfToken: string
  offset: string
  sort: string
  order: string
  filter: string
  period: string
}

export const DeletePastButton = clientEntry(
  import.meta.url + '#DeletePastButton',
  function DeletePastButton(handle: Handle<DeleteButtonProps>) {
    return () => {
      let clickHandler = on<HTMLButtonElement>('click', () => {
        if (!confirm('Wirklich löschen?')) return
        // Build and submit form programmatically, or use fetch()
        let form = document.createElement('form')
        form.method = 'POST'
        form.action = '/target/url'
        // ... add hidden inputs ...
        document.body.appendChild(form)
        form.submit()
        form.remove()
      })

      return <Button type="button" tone="danger" mix={clickHandler}>Löschen</Button>
    }
  },
)
```

### Where to Mount Global clientEntry Behaviors

A `clientEntry` that registers global event listeners (e.g., theme toggle, analytics, keyboard shortcuts) must mount in the **root `<Document>` wrapper**, not `<Layout>`. Pages rendered directly through `<Document>` (standalone landing pages) never mount `<Layout>`, so the `clientEntry` never hydrates and the feature silently breaks.

Mount global `clientEntry` components in `<body>` inside `Document`:

```tsx
// app/ui/document.tsx — shared by ALL pages
export function Document(handle: Handle<DocumentProps>) {
  return () => (
    <html>
      <head>...</head>
      <body>
        {children}
        <ThemeToggle />   {/* ← mounted on every page */}
      </body>
    </html>
  )
}
```

Remove duplicate mounts from `<Layout>` — `<Document>` is the single root wrapper for all routes, and `clientEntry` components use an `initialized` flag to prevent duplicate hydration.

**Key points:**
- Props must extend `SerializableProps` (strings, numbers, booleans, null — no functions)
- Use `import.meta.url + '#ComponentName'` as the entry ID
- The `on` handler is written in setup scope (inside the `return () => {` closure) so it has stable references
- For form submission, create the form programmatically in the handler, or use `fetch()` + `handle.frame.reload()` (see `admin-action-button.tsx`)

## When to Use

- Adding `confirm()` dialogs to admin action buttons
- Any event-driven interactivity (click, submit, input) in server-rendered Remix 3 pages
- When `on` mixin compiles but the handler doesn't fire — immediately suspect missing `clientEntry`
- Before reaching for inline `<script>` tags or raw DOM manipulation outside the component system
