---
name: remix3-frame-post-uninterceptable
description: "POST form submissions inside Remix 3 Frames cannot be intercepted — full-page navigation is unavoidable"
user-invocable: false
origin: auto-extracted
---

# Remix 3: POST Form Submissions Cannot Be Intercepted by Frame Navigation

**Extracted:** 2026-06-17
**Context:** Migrating a render-on-error CRUD form into the admin sidebar Frame. Form validation errors caused 404 GETs because the 400 HTML response created a `<Frame>` that fetched the POST URL.

## Problem

Form validation errors inside a Remix 3 admin sidebar Frame fail with:

```
POST /admin/resource/:id → 400
GET  /admin/resource/:id → 404
```

The root cause chain:
1. `rmx-target` on `<form method="POST">` is **never read** by the Frame Navigation API
2. The browser Navigation API blocks `event.canIntercept` for all non-GET navigations
3. POST form submissions always do a **full-page navigation**, never intercepted
4. `renderAdminPage()` wraps in `ShellOrFragment` which, without `X-Remix-Target`, renders `<Layout><Frame src={request.url}/></Layout>`
5. The `request.url` is the POST URL which has no GET route → 404

## Root Cause

The Frame Navigation API uses the browser's Navigation API (`window.navigation`). The Navigation API's `navigate` event has `event.canIntercept === false` for POST navigations per spec. The `getSourceElementNavigationState` function in `navigation.ts` only reads `rmx-target` from `<a>`/`<area>` elements via `sourceElement.closest('a, area')` — `rmx-target` on `<form>` is never accessed.

## Solution

On POST form error paths, **render the sidebar directly** instead of going through `renderAdminPage()`:

```tsx
// ❌ Broken: Creates Frame → GETs POST URL → 404
return renderAdminPage(context.render, 'resource',
  <Page formValues={rawValues} fieldErrors={fieldErrors} />,
  { status: 400 },
)

// ✅ Works: Renders sidebar directly, no Frame, no GET fallback
import { renderAdminPage, AdminLayout } from '../../ui/admin-layout.tsx'
import { Layout } from '../../ui/layout.tsx'

return context.render(
  <Layout>
    <AdminLayout activeItem="resource">
      <Page formValues={rawValues} fieldErrors={fieldErrors} />
    </AdminLayout>
  </Layout>,
  { status: 400 },
)
```

The `index` action (GET) continues using `renderAdminPage()` — that's fine because GET navigations ARE intercepted by the Frame.

On success, the POST handler redirects (standard Post/Redirect/Get), the browser follows the redirect as GET, and the Frame bootstraps normally.

### Better Fix: One-Time `ShellOrFragment` Patch

Instead of the per-controller workaround above, patch the shared `ShellOrFragment` in `sidebar-layout.tsx` to wrap non-GET responses in the outer `<Layout>`:

```tsx
// app/ui/sidebar-layout.tsx
function ShellOrFragment(handle: Handle<PageProps>) {
  return () => {
    let { activeItem, children } = handle.props
    if (isFrameRequest()) {
      return <LayoutComponent activeItem={activeItem}>{children}</LayoutComponent>
    }
    // POST/PUT/DELETE validation errors: render full page (outer Layout + admin shell)
    // not just LayoutComponent — otherwise the browser gets no <html>/<head>/<body>/MainNav
    if (getContext().request.method !== 'GET') {
      return (
        <Layout>
          <LayoutComponent activeItem={activeItem}>{children}</LayoutComponent>
        </Layout>
      )
    }
    return (
      <Layout>
        <Frame name={frameTarget} src={getContext().request.url} />
      </Layout>
    )
  }
}
```

This way **every controller** can use `renderAdminPage()` uniformly — even on POST validation error paths — and the shared component handles the wrapping correctly:

```tsx
// ✅ All controllers — works on GET, POST, PUT, DELETE
return renderAdminPage(context.render, 'resource',
  <Page formValues={rawValues} fieldErrors={fieldErrors} />,
  { status: 400 },
)
```

**Why this is better:**
- One fix applies to all admin routes — no per-controller `Layout + AdminLayout` duplication
- Controllers stay consistent (always `renderAdminPage`)
- The outer `<Layout>` provides `<Document>` (html/head/body), `<MainNav>` (top nav), `<main>`, and `<footer>` — without it, browsers receive a bare `<div>` fragment with no page structure, causing a "layout crash"

## When to Use

- Adding render-on-error form validation to a CRUD page inside an admin sidebar Frame
- Any `<form method="POST">` with `rmx-target` that unexpectedly does a full-page navigation
- Debugging "GET → 404" after a POST form submission inside a Frame
- Understanding why `rmx-target` on `<form>` elements is ignored
