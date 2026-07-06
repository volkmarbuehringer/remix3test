---
name: remix3-frame-direct-render
description: "Avoid Frame double-load crash by branching on X-Remix-Target in route actions"
origin: auto-extracted
---

# Remix 3: Render Frame-Backed Routes Directly on Full-Page GET

**Extracted:** 2026-07-06
**Context:** A route living inside a Remix 3 `<Frame>` must render differently depending on how it is reached, or it will produce a nested Frame shell that crashes the browser.

## Problem

When a Remix 3 route is backed by a `<Frame>` (via `ShellOrFragment` in a sidebar layout), a full-page GET renders `<Frame src={url} />`. The Frame then fetches the same URL. On the second request, `ShellOrFragment` detects `X-Remix-Target` and returns just the content fragment.

But this double-load (shell → Frame fetch) can crash the browser when the route has heavy rendering, inline scripts, or complex state. The outer shell loads resources, then the Frame loads duplicate resources.

## Solution

Branch in the route's `index` action: detect whether the request is a frame fragment (has `X-Remix-Target`), and if not, render the full page directly without going through `ShellOrFragment`'s Frame wrapper.

```tsx
import { Layout } from '../../ui/layout.tsx'
import { AdminLayout, renderAdminPage } from '../../ui/admin-layout.tsx'
import { frames } from '../../routes.ts'

// In the route's index action:
async index(context) {
  // ... load data ...

  let isFrameRequest = context.request.headers.get('X-Remix-Target') === frames.adminContent
  if (isFrameRequest) {
    // Fragment mode: just the content (sidebar + page) — used by rmx-target navigation
    return renderAdminPage(context.render, 'support',
      <MastraChatPage messages={chatMessages} threadId={threadId} error={error} />
    )
  }
  // Full page mode: no Frame wrapper — avoids double-load crash
  return context.render(
    <Layout>
      <AdminLayout activeItem="support">
        <MastraChatPage messages={chatMessages} threadId={threadId} error={error} />
      </AdminLayout>
    </Layout>,
  )
}
```

## When to Use

- Any Remix 3 route rendered inside a `<Frame>` with `rmx-target` navigation
- When full-page navigation to the route causes a browser crash, slowdown, or resource duplication
- When the route has inline scripts, complex CSS, or heavy rendering
