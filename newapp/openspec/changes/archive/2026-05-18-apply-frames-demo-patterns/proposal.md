## Why

The `~/remix/demos/frames` demo showcases advanced Frame patterns that newapp doesn't yet leverage — programmatic frame reload, client-mounted frames, dynamic frame src, 3+ level nested streams, and root-reload client entry lifecycle. These patterns would make the admin dashboard, AI section, and client grid feel more fluid and reduce full-page navigations.

Currently, newapp's frame usage is limited to a single `<Frame>` grid at `/client` with link-based pagination. The Remix 3 `remix/ui` `Frame` component and `clientEntry` runtime support all of these patterns — they just need to be wired into the app.

## What Changes

- **Programmatic frame reload**: Replace link-based grid refresh (`<a rmx-target>`) with `handle.frame.reload()` for CRUD post-save auto-refresh, and `handle.frames.top.reload()` where document-level reload is needed
- **Client-mounted frames**: Add toggleable frame panels in the AI section (agent runner results, workflow outputs) and admin area (detail panels that lazy-load on click)
- **Dynamic frame src**: Enable client-side frame source changes in admin chatlog and message views (e.g., filter-as-you-type without page navigation)
- **Nested non-blocking frames**: Extend the admin and AI areas with 2-3 level frame hierarchies where each frame loads independently
- **Root reload entry lifecycle**: Properly handle client entry persistence and cleanup across document-level reloads for admin and AI view toggling
- **New frame documentation**: Capture the new patterns in project intelligence context files

## Capabilities

### New Capabilities

- `programmatic-frame-reload`: Server round-trip without full page navigation — `handle.frame.reload()` for frame-scoped refresh, `handle.frames.top.reload()` for document-level reload, and `handle.frame.src` for URL updates. Used in client grid post-save, admin dashboard refresh, and AI agent result panel.
- `client-mounted-frames`: Dynamic `<Frame>` mount/unmount controlled by client-side state. Used for lazy-loading admin detail panels, AI agent result toggles, and workflow output views.
- `nested-nonblocking-frames`: Frame hierarchies where each level streams independently without blocking siblings or children. Used for admin dashboard (stats → activity → user detail) and AI chat (chat → tool call result → streaming output).
- `root-reload-entry-lifecycle`: Client entry behavior during document-level reload — `handle.signal.addEventListener('abort')` for cleanup, `handle.queueTask()` for post-hydration setup, and persistent-vs-removable entry distinction.

### Modified Capabilities

*(No existing specs change — all new capabilities)*

## Impact

- **`app/actions/client/controller.tsx`**: Add programmatic grid reload after create/update/delete
- **`app/actions/client/grid-page.tsx`**: Client entry for inline refresh button and auto-reload on save
- **`app/actions/admin-*.tsx`** and controllers: Add client-mounted frames for detail panels, nested frames for dashboard
- **`app/actions/ai-controller.tsx`**, **`chat-controller.tsx`**, **`agent-controller.tsx`**: Add client-mounted result frames, frame-scoped reload for agent output
- **`app/assets/`**: New client entry files for frame reload controls, client-mounted panels
- **`app/routes.ts`**: New nested route groups for admin frame fragments and AI frame fragments
- **`app/middleware/render.tsx`**: May need adjustments for root reload entry lifecycle (no fundamental changes expected)
- **`app/assets/entry.tsx`**: May need updates for frame reload signal handling
- **`.opencode/context/`**: New context files documenting the applied patterns
