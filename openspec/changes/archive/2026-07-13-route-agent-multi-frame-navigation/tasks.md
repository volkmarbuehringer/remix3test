## 1. Route-to-Target Mapping in Controller

- [x] 1.1 In `app/actions/route-agent/controller.tsx`, add a route-to-target mapping function `getTarget(path: string): string` that maps path prefixes to frame target names:
  - `/admin` → `admin-content`
  - `/lists` → `lists-content`
  - `/mastra` → `admin-content` (admin support agent lives in admin area)
  - default → `lists-content` (backward compatible)
  - Longer prefixes match first (e.g., `/admin/chatlog` matches `/admin` before `/a` could match)

- [x] 1.2 In the same file, update `filterAndForward()` to use `getTarget(result.path)` instead of the hardcoded `target: 'lists-content'` on line 85

## 2. Admin-Content Frame in Route-Agent Page

- [x] 2.1 In `app/ui/route-agent-page.tsx`, add a second `<Frame name="admin-content">` inside the `#route-agent-frame-container` div, alongside the existing `lists-content` frame
  - Initial `src`: `{routes.routeAgent.panel.href()}` (same placeholder as lists-content)
  - Both frames stacked in the same container (both `position: absolute` + `inset: 0` or similar)
  - `fallback` same as lists-content
  - Set `data-active-frame="lists-content"` on the container initially

- [x] 2.2 Style the frame container as a relative-positioned wrapper, with both frames absolutely positioned to fill it (only one visible at a time via `display: none/block`)

## 3. Frame Visibility Control in Client

- [x] 3.1 In `app/assets/route-agent-stream.tsx`, update `handleNavigate()` to:
  - When `target` is provided: find the frame by target name via `handle.frames.get(target)`
  - Hide the previously active frame container (set `display: none`)
  - Show the target frame container (set `display: block` or `flex`)
  - Update `data-active-frame` attribute on the container

- [x] 3.2 Reset the previously hidden frame's `src` to the panel placeholder URL to prevent stale content

- [x] 3.3 Update `handleFrameFormSubmit()` (line 318) to reload the currently active frame instead of hardcoding `lists-content`:
  - Read `data-active-frame` from the container
  - Use `handle.frames.get(activeFrame)` instead of `handle.frames.get('lists-content')`

## 4. Verification

- [ ] 4.1 Navigate to `/route-agent` and verify the initial frame shows the "Ask the agent to navigate" placeholder

- [ ] 4.2 Type "show me the lists" and verify the lists-content frame navigates correctly (existing behavior preserved)

- [ ] 4.3 Type "show me the chat log" and verify the admin-content frame navigates to `/admin/chatlog` and renders the ChatLogPage fragment

- [ ] 4.4 Test pagination inside the admin-content frame (click "Weiter →" on chatlog page)

- [ ] 4.5 Test deleting a chat thread inside the admin-content frame

- [ ] 4.6 Navigate between admin and lists routes and verify frames switch correctly

- [ ] 4.7 Navigate back to lists and verify the lists-content frame shows fresh content (not stale placeholder)

## 5. Cleanup

- [ ] 5.1 Remove the unused `frames.adminChatlog` or `frames.adminMessages` if any were created but are no longer needed (none should exist — the standard `frames.adminContent` is used)

- [x] 5.2 Run `npm run typecheck` to verify no type errors
