## Context

newapp uses Remix 3's `remix/ui` `Frame` component and `clientEntry` runtime, but currently only for a single grid at `/client`. The frames demo at `~/remix/demos/frames` demonstrates several advanced patterns that the framework already supports:

1. **Programmatic frame reload** — `handle.frame.reload()`, `handle.frames.top.reload()`, `handle.frame.src` setter
2. **Client-mounted frames** — `<Frame>` mounted/unmounted from within `clientEntry` rendering functions
3. **Nested non-blocking frames** — `<Frame>` inside `<Frame>` content, each resolving independently
4. **Root reload entry lifecycle** — `handle.signal.addEventListener('abort')`, `handle.queueTask()`, persistent vs removable entries

All of these rely on `run()` from `remix/ui` (already in `app/assets/entry.tsx`) and `renderToStream()` with `resolveFrame` (already in `app/middleware/render.tsx`). No new framework capabilities are needed — this is an application-layer change.

**Current app architecture:**

```
/client          (page)             ← full page render via Layout
  └── Frame "client-grid"           ← loads /client/grid fragment
       └── <a href rmx-target>      ← pagination/sort via link navigation

/admin           (page)
  └── (static content, no frames)

/ai              (page)
  └── (form submissions, full-page reload)
```

**Target architecture:**

```
/client          (page)
  └── Frame "client-grid"
       └── <FrameRefreshButton>     ← client entry calling handle.frame.reload()
       └── <a href rmx-target>      ← pagination/sort preserved
       └── auto-reload after CRUD   ← handle.edit(frameId).reload() on save

/admin           (page)
  └── Frame "admin-stats"           ← dashboard stats (non-blocking)
  └── Frame "admin-recent"          ← recent activity (non-blocking)
       └── Frame "user-detail"      ← lazy-loaded detail panel

/ai              (page)
  └── agent runner form
  └── Frame "ai-result"             ← client-mounted result panel
       └── Frame "ai-tool-output"   ← nested tool call output

/admin/chatlog   (page)
  └── Frame "chatlog-list"          ← filterable list
  └── Frame "chatlog-detail"        ← client-mounted detail on row click
```

## Goals / Non-Goals

**Goals:**

- Add programmatic frame reload (`handle.frame.reload()`) to the existing client grid for post-CRUD auto-refresh
- Add a client-mounted frame panel for AI agent results (mount on "Run Agent", unmount on close)
- Add nested non-blocking frames for admin dashboard (stats + activity + detail)
- Add a frame-based detail view for admin chatlog (click row → mounted detail frame)
- Demonstrate root reload entry lifecycle in admin view toggling
- Document applied patterns in `.opencode/context/project-intelligence/frames/`

**Non-Goals:**

- Not replacing all link-based navigation with frame reload — only where clear UX benefit exists
- Not retrofitting every existing page — only client grid, admin dashboard, admin chatlog, and AI agent
- Not changing `resolveFrame` or render middleware — existing infrastructure suffices
- Not rewriting existing controllers — new frame fragment endpoints are added alongside existing routes
- Not adding new npm dependencies — all patterns use `remix/ui` which is already a dependency

## Decisions

### Decision 1: Add frame fragment routes alongside existing routes

**Choice**: New routes for frame content use a `/fragments/` prefix under each section (e.g., `/admin/fragments/stats`, `/ai/fragments/agent-result`).

**Rationale**: Frame content differs from full-page content — no `<Layout>`, `<!DOCTYPE>`, or `<Document>` wrapper. Keeping fragments under a separate route namespace avoids conflicts with existing page routes and makes the `X-Remix-Frame` check (already in render middleware) cleaner.

**Alternatives considered**:

- _Reuse existing page routes with `X-Remix-Frame` header detection_ — adds conditional logic to existing actions, harder to reason about
- _Shared fragment controller_ — single controller for all fragments is too coupled

### Decision 2: Client-mounted frames via boolean toggle in `clientEntry`

**Choice**: Use a simple boolean state variable in `clientEntry` to conditionally render `<Frame>`. When `showFrame = true`, the `<Frame>` JSX is included; when `false`, `null`.

**Rationale**: Matches the demo pattern exactly (`client-frame-example.tsx`, `client-mounted-page-example.tsx`). The `run()` runtime handles mount/unmount automatically — when `<Frame>` enters the virtual tree, it resolves the src and streams in content. When it leaves, the frame is disposed. No extra lifecycle management needed.

**Key detail**: The `<Frame>` must be inside a `clientEntry` function (not a server-rendered component) for client-side state control.

### Decision 3: Frame reload via `handle.frame.reload()` after CRUD

**Choice**: After a create/update/delete operation in the client grid, the server redirects back to `/client` with `?editing=` and grid state. On page load, a client entry detects the grid frame by name and calls `handle.frame.reload()` on it.

**Rationale**: The existing redirect-based CRUD flow preserves grid state (offset, sort, filter) in URL params. The frame auto-reload is triggered after the page renders — the client entry finds the frame by name (`"client-grid"` via `handle.frames[frameName]`) and reloads it. This means the grid content is always fresh without extra server logic.

**Alternatives considered**:

- _`handle.frames.top.reload()` after CRUD_ — reloads the entire document unnecessarily
- _Return fragment response directly from CRUD actions_ — requires different response handling and doesn't work with redirect-based flow

### Decision 4: Admin dashboard uses three nested frames with staggered delays

**Choice**: Admin dashboard at `/admin` renders three independent frames: `admin-stats` (fast, ~200ms simulated), `admin-recent-activity` (slower, ~1s), and inside activity a `user-detail-popover` frame (lazy on hover/click).

**Rationale**: Each frame streams independently. The stats frame renders quickly while the activity frame loads. The user detail frame only resolves when needed. This matches the demo's activity → activityDetail → time chain.

**Frame hierarchy:**

```
/admin
  └── Frame "admin-stats"          src: /admin/fragments/stats
  └── Frame "admin-recent"         src: /admin/fragments/recent-activity
       └── Frame "user-detail-{id}" src: /admin/fragments/user-detail/:userId
```

### Decision 5: Root reload entry lifecycle for admin view toggles

**Choice**: Use `handle.signal.addEventListener('abort')` for cleanup in admin panels that toggle between different views (chatlog list → message detail). Use `handle.queueTask()` for post-hydration setup (e.g., restoring scroll position after reload).

**Rationale**: When toggling admin views via `handle.frames.top.reload()`, some client entries (navigation, theme toggle) should persist, while transient panels (detail drawers, expanded sections) should clean up. The `abort` event is the clean mechanism for this.

## Risks / Trade-offs

- **[Risk] Frame reload flash** — If the frame's server endpoint is fast enough, the swap is seamless. If slow, the fallback content briefly shows → **Mitigation**: Keep fallback minimal (skeleton/spinner matching layout dimensions)
- **[Risk] Stale client entry state** — Per `concepts/frame-boundary-hydration.md`, client entries inside `<Frame>` boundaries do NOT re-hydrate on parent frame reload → **Mitigation**: Use `clientEntry` directly (not wrapped in `<Frame>`) for interactive items that need prop updates; document this in context files
- **[Risk] Over-nesting** — 3+ levels of frames means 3+ sequential round-trips to resolve the deepest content → **Mitigation**: Keep critical content at level 1-2; use level 3+ only for optional detail panels
- **[Risk] Admin section auth gating** — Frame content endpoints must enforce the same auth checks as their parent pages → **Mitigation**: Use `requireAuth()` middleware on fragment controllers (same pattern as existing admin routes)
- **[Risk] Cookie forwarding on frame reload** — Already handled by `resolveFrame` in `render.tsx` (passes `Cookie` header) and `entry.tsx` (browser sends cookies naturally via `fetch`)
