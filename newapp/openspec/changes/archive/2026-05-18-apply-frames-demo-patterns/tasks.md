## 1. Client Grid: Post-CRUD Auto-Refresh

- [x] 1.1 Create `GridAutoRefresh` client entry in `app/assets/grid-auto-refresh.tsx` that watches for a data attribute on mount and calls `handle.frames[frameName].reload()` after a short delay
- [x] 1.2 Add `GridAutoRefresh` to `ClientPage` so it renders after CRUD redirect (when `?editing=` or `?_created` param is present)
- [x] 1.3 Modify client controller's `create` action to append `&_created=true` to the redirect URL
- [x] 1.4 Add inline "Refresh" button to `ClientGridPage` via a new `FrameRefreshButton` client entry that calls `handle.frame.reload()`
- [x] 1.5 Test: client grid auto-refreshes after create, edit, and delete without full page navigation

## 2. Admin Dashboard: Nested Independent Frames

- [x] 2.1 Add admin fragment routes in `app/routes.ts` (e.g., `admin.fragments.stats`, `admin.fragments.recentActivity`, `admin.fragments.userDetail`)
- [x] 2.2 Create `admin-fragments-controller.tsx` with actions for stats, recent activity, and user detail fragments
- [x] 2.3 Create `app/ui/admin-fragments/stats-fragment.tsx` — server-time stats card with simulated delay
- [x] 2.4 Create `app/ui/admin-fragments/recent-activity-fragment.tsx` — activity list with nested user-detail Frame per entry
- [x] 2.5 Create `app/ui/admin-fragments/user-detail-fragment.tsx` — user detail popover (simple info card)
- [x] 2.6 Update `AdminDashboardContent` in `app/ui/admin-page.tsx` to replace static cards with `<Frame>` components for stats and recent activity
- [x] 2.7 Wire the fragment controller to the router in `app/router.ts`
- [x] 2.8 Test: dashboard renders stats and activity frames independently; clicking a user expands nested detail frame; each level streams without blocking others

## 3. AI Agent: Client-Mounted Result Frame

- [x] 3.1 Create `AiAgentResultToggle` client entry in `app/assets/ai-agent-result-toggle.tsx` — toggles a `<Frame>` mount on "Run Agent" click, with close button to unmount
- [x] 3.2 Add AI fragment route in `app/routes.ts` (e.g., `ai.fragments.agentResult`)
- [x] 3.3 Create AI fragments controller (`app/actions/ai-fragments-controller.tsx`) with agent result action
- [x] 3.4 Create `app/ui/ai-fragments/agent-result-fragment.tsx` — renders agent execution output (streamed or static)
- [x] 3.5 Update `AgentPage` in `app/ui/agent-page.tsx` to render the toggle client entry instead of doing a form POST with full nav
- [x] 3.6 Wire AI fragment routes in `app/router.ts`
- [x] 3.7 Test: clicking "Run Agent" mounts a frame with loading fallback; result streams in; clicking close unmounts the frame

## 4. Admin Chatlog: Client-Mounted Detail Frame

- [x] 4.1 Add admin chatlog fragment route in `app/routes.ts` (e.g., `admin.chatlog.fragments.detail`)
- [x] 4.2 Add chatlog detail action to `admin-chatlog-controller.tsx` (or a new `admin-chatlog-fragments-controller.tsx`)
- [x] 4.3 Create `ChatlogRowDetail` client entry in `app/assets/chatlog-row-detail.tsx` — toggles a `<Frame>` on row click
- [x] 4.4 Create `app/ui/admin-fragments/chatlog-detail-fragment.tsx` — renders full message list for a single conversation
- [x] 4.5 Update `ChatLogPage` to render each row with the toggle client entry
- [x] 4.6 Test: clicking a chatlog row mounts a detail frame with messages; clicking close unmounts it; list remains intact

## 5. Root Reload Entry Lifecycle

- [x] 5.1 Create `AdminViewToggle` client entry in `app/assets/admin-view-toggle.tsx` — toggles between list/detail views in admin via `handle.frames.top.reload()`, with `handle.signal.addEventListener('abort')` for cleanup
- [x] 5.2 Create `PersistentAdminCounter` client entry in `app/assets/persistent-admin-counter.tsx` — demo entry that persists across root reload with `handle.queueTask()` for post-hydration setup
- [x] 5.3 Demonstrate lifecycle by wiring the toggle into the admin content frame header (buttons that add/remove a removable entry on reload)
- [x] 5.4 Test: root reload preserves persistent entries; removable entries get disposed with abort callback; `queueTask` runs after hydration

## 6. Documentation

- [x] 6.1 Create `.opencode/context/project-intelligence/frames/guides/programmatic-frame-reload.md` — how to use `handle.frame.reload()`, `handle.frames.top.reload()`, and `handle.frame.src` in newapp
- [x] 6.2 Create `.opencode/context/project-intelligence/frames/guides/client-mounted-frames.md` — pattern for mounting/unmounting frames from client entries
- [x] 6.3 Create `.opencode/context/project-intelligence/frames/guides/nested-frames-admin-dashboard.md` — how the admin dashboard uses nested frames
- [x] 6.4 Create `.opencode/context/project-intelligence/frames/guides/root-reload-lifecycle.md` — persistent vs removable entries, `abort` handler, `queueTask`
- [x] 6.5 Update `.opencode/context/project-intelligence/frames/navigation.md` index to reference new guides
