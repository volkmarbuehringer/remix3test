## Context

The route-agent (at `/route-agent`) is a proof-of-concept that lets an AI agent navigate the application. It has:

- A **Mastra agent** (`app/actions/mastra/agents/route-agent.ts`) with a `routeNavigate` tool that returns `{ type: 'route', path: '...' }`
- A **controller** (`app/actions/route-agent/controller.tsx`) that runs the agent, pipes output as SSE, and has `filterAndForward()` that detects `{ type: 'route', path }` tool results and emits `navigate` SSE events
- A **page** (`app/ui/route-agent-page.tsx`) with a single `<Frame name="lists-content">` that displays the navigated content
- A **client entry** (`app/assets/route-agent-stream.tsx`) that receives SSE events and navigates frames

**Current limitation**: `filterAndForward` hardcodes `target: 'lists-content'`. The route-agent can only navigate to routes that expect to render in a `lists-content` frame — i.e., the lists area.

**Frame rendering model**: When a `<Frame name="admin-content" src="/admin/chatlog">` loads, Remix sends `X-Remix-Target: admin-content` with the request. The `createSidebarLayout` factory (used by the admin layout) checks for this header — if it matches the frame target, it renders only the content fragment (no sidebar, no outer shell).

This means any frame-based route already works as a fragment when loaded with the correct `X-Remix-Target`. We just need the route-agent to send the right target.

## Goals / Non-Goals

**Goals:**
- The route-agent can navigate admin pages (e.g., `/admin/chatlog`, `/admin/messages`, `/admin/users`)
- The route-agent can navigate lists pages (existing behavior preserved)
- The correct frame target is determined automatically from the path
- Only the active frame is visible; the inactive one is hidden
- No changes to admin layout, chatlog controller, or any target route

**Non-Goals:**
- No changes to the Mastra route-agent agent definition or tools (the tool returns `path`, the controller maps to `target`)
- No support for routes that don't use frames (e.g., full-page routes like `/auth/login`) — the agent should only navigate frame-compatible routes
- No multi-frame simultaneous display (only one frame visible at a time)
- No dynamic frame target registration (targets are hardcoded in the mapping)

## Decisions

### 1. Path-prefix to target mapping in the controller

The `filterAndForward` function already processes tool results. Adding a mapping there keeps the logic centralized:

```
/admin[/...] → admin-content
/lists[/...] → lists-content
default      → lists-content (backward compatible)
```

The mapping is a simple `Map<string, string>` keyed by path prefix. Longer prefixes match first to avoid `/a` matching `/admin`.

### 2. Two frames, visibility toggled by client

The page renders both frames in a container. The client-side stream handler toggles visibility via CSS `display: none/block` on the frame container. A `data-active-frame` attribute on the container tracks which frame is active.

Both frames are always in the DOM. Only one is visible at a time. When navigating, the client hides the old frame, shows the new one, waits for the new frame's content to load, and resets scroll.

### 3. Frame src reset for hidden frames

When a frame is hidden and the agent navigates to a different target, the hidden frame's `src` is reset to a placeholder (the panel placeholder endpoint). This prevents stale content from flashing when the frame is shown again, and avoids unnecessary network requests while hidden.

### 4. Backward compatibility

The existing `lists-content` behavior is unchanged. If no route prefix matches (or for unknown routes), `lists-content` is used as the default target. The `handleFrameFormSubmit` handler currently hardcodes `lists-content` for form reloads — it needs to reload the currently active frame instead.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Route Agent Page                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Frame Container                      │   │
│  │  ┌─ frame "lists-content" (visible or hidden) ─┐ │   │
│  │  │ lists panel / lists content                  │ │   │
│  │  └──────────────────────────────────────────────┘ │   │
│  │  ┌─ frame "admin-content" (visible or hidden) ──┐ │   │
│  │  │ admin pages / admin content                  │ │   │
│  │  └──────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Agent bar (status / question UI)                        │
│  [input_________________________] [send]                 │
└──────────────────────────────────────────────────────────┘
```

### SSE Event Flow

```
User: "show me the chat log"
       │
       ▼
POST /route-agent { message: "show me the chat log" }
       │
       ▼
agent.stream("show me the chat log")
  → tool call: navigate({ path: "/admin/chatlog" })
  → tool result: { type: "route", path: "/admin/chatlog" }
       │
       ▼
filterAndForward():
  path = "/admin/chatlog"
  target = getTarget(path)  → "admin-content"
  emit navigate SSE event:
    event: navigate
    data: { href: "/admin/chatlog", target: "admin-content", history: "push" }
       │
       ▼
RouteAgentStream client receives "navigate"
  → find frame "admin-content"
  → hide "lists-content" container, show "admin-content" container
  → set frame.src = "/admin/chatlog"
  → frame.reload()
  → pushState to /admin/chatlog
       │
       ▼
Browser loads /admin/chatlog in admin-content frame
  → X-Remix-Target: admin-content header sent
  → createSidebarLayout detects frame request
  → renders only ChatLogPage fragment (no sidebar)
       │
       ▼
ChatLogPage renders in route-agent's admin-content frame
```

### Client Follow-up Actions

When the user interacts within a frame (e.g., clicking pagination or deleting a thread), the form uses `rmx-target={frames.adminContent}`. This targets the frame with a POST. The client's `handleFrameFormSubmit` captures form submissions, re-fetches them, and reloads the active frame.

This already works for the `admin-content` target — the admin layout's createSidebarLayout handles POST requests by rendering the full layout (not the frame shell). The key change is that `handleFrameFormSubmit` must reload the **currently active** frame, not hardcode `lists-content`.

## Data Flow

```
┌─────────┐   navigate event    ┌──────────────┐   X-Remix-Target    ┌──────────────┐
│  Agent  │ ───────────────────▶│ RouteAgent   │ ──────────────────▶│ Target Route │
│  (LLM)  │  { href, target }   │ Stream Client │  (set by Frame)   │  Controller  │
└─────────┘                     └──────────────┘                    └──────────────┘
                                       │                                    │
                                       │ show/hide frames                   │ render fragment
                                       ▼                                    ▼
                                ┌──────────────┐                    ┌──────────────┐
                                │ Frame         │                    │ Fragment     │
                                │ Container     │                    │ (ChatLogPage)│
                                └──────────────┘                    └──────────────┘
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Frame visibility toggle causes layout shift | Both frames share the same container; `display: none` removes from layout cleanly; container has fixed `flex: 1; min-height: 0` |
| Two frames with independent scroll positions confuse users | Only one visible at a time; scroll resets to top on navigation via `frame.reload()` |
| Frame re-mount when shown again triggers network fetch | Acceptable — the frame needs to load the new content anyway; hidden frame has `src` set to placeholder to prevent stale state |
| Agent navigates to a path that doesn't match any known target | Default to `lists-content` (backward compatible); `navigate` event validation already rejects non-`/` paths |
| Form submission inside admin-content frame needs the active frame reload | `handleFrameFormSubmit` changed from hardcoded `lists-content` to read `data-active-frame` attribute |
| Agent memory/thread ID lost when navigating between frames | `currentThreadId` persists on the client across navigations; frame navigation doesn't affect the parent page's JS state |

## Open Questions

- Should the `admin-content` frame also support `lists-content` as an accepted target, or vice versa? (Currently the admin layout already has `acceptFrameTargets: [listsContent]`, so it can render lists fragments. The route-agent only needs one active frame.)
- What happens when the agent navigates to a route that doesn't use frames at all (e.g., `/auth/login`)? The frame would load a full page — should we validate and warn?
- Should we add a third frame for future targets (e.g., `appointment-content`), or add frames lazily as targets are needed?
