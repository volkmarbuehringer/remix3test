---
name: remix3-frame-fragment-flash-banner
description: "Use when a Remix 3 page uses Post/Redirect/Get (session.flash) and renders as a frame fragment (X-Remix-Target), but the PRG message never appears — the content-only fragment path has no flash banner"
metadata:
  origin: auto-extracted
---

# Frame Fragment PRG Flash Banner

**Extracted:** 2026-08-24
**Context:** Remix 3 remix/ui app (`newapp`). A route served both as a full document and as a content-only frame fragment (via `X-Remix-Target`), where `session.flash` set by a Post/Redirect/Get action is silently dropped.

## Problem

Full-document pages surface `session.flash` (error/success) through the top-level `<Layout>`, which reads `session.get('error' | 'success')` and renders a banner. But when the same route is requested as a **content-only frame fragment** (Remix 3 detects `X-Remix-Target`; e.g. the fragment branch of `renderVerwaltungPage`, or `createSidebarLayout`'s `LayoutComponent`, renders content only), that `<Layout>` is NOT rendered. A `session.flash` set by a PRG action → redirect is then **consumed by the next request but never displayed**.

Symptom: a mutation redirects (302), the frame content swaps, but the "X erstellt" / error message never appears.

## Solution

Render a flash banner in the fragment path itself, reading the same session keys the full `<Layout>` uses. Only read the flash in the fragment branch so the two render paths never double-consume it.

```tsx
// app/ui/verwaltung-layout.tsx — fragment branch of renderVerwaltungPage
let flashError: string | undefined
let flashSuccess: string | undefined
try {
  let session = getContext().session
  if (session) {
    let err = session.get('error')
    if (typeof err === 'string') flashError = err
    let success = session.get('success')
    if (typeof success === 'string') flashSuccess = success
  }
} catch { /* no session context */ }

if (isFrame) {
  return render(
    <>
      {flashError ? <div mix={flashErrorStyle}>{flashError}</div> : null}
      {flashSuccess ? <div mix={flashSuccessStyle}>{flashSuccess}</div> : null}
      {content}
    </>,
    init,
  )
}
return render(<Layout>{content}</Layout>, init)
```

`flashErrorStyle` / `flashSuccessStyle` mirror the `flashBase` + `surface.dangerBg` / `surface.successBg` tokens already in `app/ui/layout.tsx`. In a sidebar shell, the same banner goes into the `createSidebarLayout` `LayoutComponent`.

## When to Use

- A Remix 3 route renders both a full document and a frame fragment (its layout helper has an `isFrame` / `X-Remix-Target` branch).
- You add PRG + `session.flash` to a mutation and the message is missing after the redirect.
- You're adding a flash banner to a fragment render and need to avoid double-consuming the flash.
