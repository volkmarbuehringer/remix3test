---
name: remix3-frame-target-registration
description: 'Register nested frame names as content-only targets so admin pages render as fragments, not full shells'
origin: auto-extracted
---

# Remix 3 Frame Target Registration & Content-Only Panels

**Extracted:** 2026-07-31
**Context:** Moving admin agent routes under `/admin` with a sidebar, embedding a nested "panel" frame that loads other admin pages. Two symptoms appeared in sequence: a duplicate MainNav navbar in the panel, then a duplicate sidebar.

## Problem

A `<Frame name="X" src="/path">` fetches its content with `X-Remix-Target: X`. The sidebar layout (`createSidebarLayout`/`ShellOrFragment`) only renders a **fragment** when the incoming `X-Remix-Target` is in its registered set (`frameTarget` + `acceptFrameTargets`), or in `contentOnlyTargets` (which renders bare page content).

Three failure modes:

1. **Unregistered target → duplicate navbar**: Load `/admin/users` into a frame named `agent-events-panel`. The request carries `X-Remix-Target: agent-events-panel`, which isn't accepted → `isFrameRequest()` is false → `ShellOrFragment` renders `<Layout><Frame name={frameTarget} src={url}/></Layout>` (the frame target defaults to the top frame), so the full page (`Layout` with public `MainNav`) renders INSIDE the panel → a second navbar, because the URL re-enters the `admin-content` frame.

2. **Registered target → duplicate sidebar**: If you "fix" mode 1 by adding the panel name to `acceptFrameTargets`, the admin fragment includes the sidebar shell → the panel now shows a second sidebar (the host page already renders via `renderAdminPage` with the sidebar on the left).

3. **Frame-name collision**: `getNamedFrame(name)` resolves within the current document's runtime and falls back to the top frame. If a page living inside the `admin-content` frame embeds another frame ALSO named `admin-content`, sidebar `NavLink`s (target `admin-content`) resolve to the inner panel instead of the page frame.

## Solution

### Centralize frame names

Keep every frame name in one `frames` const so the `<Frame name>`, `data-active-frame`, SSE navigate targets, and the layout's target lists cannot drift:

```tsx
// app/routes.ts
export const frames = {
  adminContent: 'admin-content',
  listsContent: 'lists-content',
  appointmentContent: 'appointment-content',
  appointTypes: 'appoint-types',
  workflowAgentPanel: 'workflow-agent-panel',
  agentEventsPanel: 'agent-events-panel',
} as const
```

### Register panel targets as content-only

`createSidebarLayout` gained a `contentOnlyTargets` set. When `X-Remix-Target` matches one, `ShellOrFragment` returns just the page content (`children`) — no sidebar shell, no `Layout` shell:

```tsx
export type SidebarLayoutConfig<ID extends string> = {
  frameTarget: string
  acceptFrameTargets?: string[]
  contentOnlyTargets?: string[]   // render only children for these targets
  // ...
}

// ShellOrFragment
let target = getContext().request.headers.get('X-Remix-Target')
if (target != null && contentOnlyTargetSet.has(target)) {
  return children
}
```

Register the panel names as content-only (NOT as full-shell accepted targets):

```tsx
createSidebarLayout<AdminNavItem>({
  frameTarget: frames.adminContent,
  acceptFrameTargets: [frames.listsContent],
  contentOnlyTargets: [frames.agentEventsPanel, frames.workflowAgentPanel],
  // ...
})
```

### Use unique names for nested panels

A frame nested inside the `admin-content` frame must have a DIFFERENT name than `admin-content`. Otherwise sidebar navigation (target `admin-content`) hits the inner panel frame.

### Prefer panel navigation over whole-page navigation when streaming continues

If an action navigates the panel AND then continues streaming a workflow result into the same SSE connection, do NOT navigate the whole page — that tears down the connection and loses the result. Navigate the panel frame and let it reload on completion.

## When to Use

- Embedding a nested `<Frame>` (panel) inside a page that already renders a sidebar layout, where the panel loads other admin/content routes
- After changing a frame's `name`, `data-active-frame`, or SSE navigate `target` — the frame name becomes the `X-Remix-Target`, and the layout must know it
- Seeing a second navbar or second sidebar appear inside a frame
- Seeing sidebar navigation "jump into" the wrong (inner) frame
