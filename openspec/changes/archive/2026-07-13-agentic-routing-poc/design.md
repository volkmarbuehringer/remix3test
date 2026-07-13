## Context

The app has three agent endpoints (`testAgent`, `customerAgent`, `supportAgent`) that all stream via SSE. Each uses the same pattern: POST message → agent.stream() → store stream → client opens EventSource to `/…/stream/:runId`. The client-side stream handlers (`test-agent-stream.tsx`, `customer-chat-stream.tsx`) forward events as DOM mutations (chat bubbles, tool cards).

Existing routes (`/lists`, `/admin/lists`, etc.) have their own frame system using `remix/ui` `Frame` component with named targets (`admin-content`, `lists-content`). Lists specifically use `frames.listsContent` target and have a complete CRUD UI with sidebar.

The gap: the agent can only output text/cards. It cannot navigate the user to a full-page route.

## Goals / Non-Goals

**Goals:**
- Build a test page at `/route-agent` with a content frame + persistent input bar
- Add a `navigate(path, query?)` tool to the test agent that emits route events
- Client-side handler catches `route` SSE events and navigates the frame
- Prove the concept with lists: "show me the lists" → navigates to `/lists`

**Non-Goals:**
- Modifying existing admin or list routes
- Adding sidebar navigation to the test page
- Agent performing CRUD on lists (lists UI handles that directly)
- Production readiness — this is a throwaway POC

## Decisions

### 1. Reuse testAgent vs new agent
**Decision:** Reuse `testAgent` with a new `navigate` tool and updated instructions.

The testAgent already has admin auth, SSE streaming, tool approval, and memory. Adding one tool to it is minimal. A new agent would duplicate all that infrastructure.

### 2. Frame target: `lists-content`
**Decision:** Name the frame `lists-content` so `X-Remix-Target: lists-content` matches the lists route's fragment rendering.

Lists already check for this header and render their sidebar + content grid as a fragment. Loading `/lists` inside this frame works without changes to the lists route.

### 3. Route detection via SSE `tool-result` event
**Decision:** The agent's `navigate` tool returns `{ type: "route", path: "/lists" }`. The server SSE forwarder passes it through as a standard `tool-result` event. The client checks `data.result.type === "route"` and navigates the frame.

Alternative considered: a custom `route` SSE event type. Rejected because it requires modifying the server-side SSE forwarder. The `tool-result` passthrough is simpler and the client can distinguish by checking `result.type`.

### 4. Frame navigation via `handle.frames`
**Decision:** The clientEntry accesses the named frame through `handle.frames.get('lists-content')`, sets `.src`, and calls `.reload()`.

This is the same pattern used by `lists-client.tsx`, `grid-refresh-button.tsx`, and `admin-view-toggle.tsx`. Established and reliable.

### 5. No sidebar on the test page
**Decision:** `/route-agent` is a bare page: a `<Frame name="lists-content">` and an input bar. The lists route's own sidebar renders inside the frame.

This keeps the test page minimal and proves the agent can navigate to any route.

## Risks / Trade-offs

- **Double sidebar if navigating to admin routes** — The lists sidebar renders inside the frame. Admin routes have their own sidebar. If the agent later navigates to `/admin/*`, two sidebars would appear. Mitigation: POC scope is lists only. A production version would need universal fragment rendering.

- **Agent hallucinates routes** — Without proper route manifest, the agent might guess paths. Mitigation: POC agent instructs only `/lists` and `/lists?load=<id>`.

- **Frame createContextKey / handle access from sibling clientEntry** — If `handle.frames.get(name)` isn't accessible from a sibling, fallback to `document.querySelector('iframe')` or a `MutationObserver` on the Frame's comment markers. Low risk given existing patterns.
