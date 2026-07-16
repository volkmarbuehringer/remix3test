## Context

The support agent lives at `/mastra/chat` and is served in two modes:

- **Full page** (`app/ui/support-agent-page.tsx`): has a frame container with two frames (`support-content` for chat thread, `admin-content` for navigation targets), an agent bar, and an input bar. The agent bar shows streaming text and interactive question/approval widgets.

- **Frame mode** (inside admin sidebar): just `MastraChatPage` — the chat message UI without agent bar or input.

The route agent at `/route-agent` demonstrates the target pattern: its full page has a single primary frame (defaults to a placeholder), an agent bar, and an input bar. The agent drives navigation via `routeNavigate` tool → `{ type: 'route', path }` → `filterAndForward` in `agent-sse.ts` emits a `navigate` SSE event → `handleNavigate()` in the clientEntry switches frames and calls `frame.reload()`.

The support agent's `SupportAgentStream` clientEntry already has `handleNavigate()` and handles `navigate` SSE events. The agent just lacks the `routeNavigate` tool.

## Goals / Non-Goals

**Goals:**
- Support agent full-page layout matches route-agent: primary frame + agent bar + input bar (no chat-thread frame)
- Support agent has `routeNavigate` tool wired in
- Default frame shows a placeholder prompt
- Agent instructions mention navigation capability

**Non-Goals:**
- Defining which queries map to which routes (deferred)
- Changing the admin-sidebar frame mode (stays as-is)
- Modifying the route agent or shared SSE infrastructure
- Building new target pages

## Decisions

### Decision: Reuse `routeNavigate` tool as-is

The existing `routeNavigate` tool in `app/actions/mastra/tools/route-navigate.ts` accepts `{ path, query?, data? }` and returns `{ type: 'route', path, data }`. This is generic and stateless — no coupling to any specific agent. The support agent imports it directly.

Alternatives considered:
- **New `supportNavigate` tool** — would duplicate identical logic. No benefit.
- **Route agent-specific import path** — the tool is already in a shared location under `mastra/tools/`.

### Decision: Remove `support-content` frame, keep `admin-content` as primary

The current layout has two frames. After this change, only `admin-content` remains. The chat thread frame is removed because the conversation moves to the agent bar (same as route agent).

### Decision: Placeholder uses same pattern as route-agent panel

Route agent serves a static placeholder at `/route-agent/panel`. The support agent will serve a static placeholder at `/mastra/chat/panel` (or via inline JSX when the frame loads without a nav target). The exact mechanism depends on how the frame default is set — either a route or a `fallback` prop.

### Decision: Agent instructions get a generic navigation mention

The support agent's instructions will include: "You can navigate to pages in the frame by using the navigate tool. For example, you might show admin pages, user data, or system views. Use navigate when showing a page would be more helpful than just answering in text." — without specific route mappings (deferred).

## Risks / Trade-offs

- **[Layout change] Removing the chat-thread frame changes the user experience** → The agent bar already shows streaming text and interactive elements (questions, approvals). The chat-thread frame was a secondary view of the same conversation. Users won't lose information.
- **[Agent misnavigation] Without concrete mapping rules, the agent might navigate unpredictably** → Mitigated by the generic instruction wording ("you *can* navigate" not "you *should* navigate") and the fact that `routeNavigate` only returns a path — the agent must actively choose to call it.
- **[Frame state] After a navigation, the frame shows the target page but the agent bar still shows the conversation** → This is the intended design. The user can continue chatting in the input bar while the frame stays on the last navigated page.
