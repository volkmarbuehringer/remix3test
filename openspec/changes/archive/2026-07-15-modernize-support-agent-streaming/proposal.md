## Why

The support agent currently uses `agent.generate()` which blocks the HTTP response until the entire LLM call completes (including all tool calls). This creates a poor UX: the admin sees a loading spinner for 10-30s with no feedback, tool approvals require a full page redirect cycle, and the agent cannot ask clarifying questions mid-conversation. The existing route-agent proves that direct-pipe SSE streaming with the Mastra `agent.stream()` API yields a dramatically better experience with the same backend complexity.

## What Changes

- Replace `agent.generate()` with `agent.stream()` for all support-agent conversations, piping `fullStream` directly into an SSE `ReadableStream` response
- Replace the session-flash + redirect tool approval flow with inline SSE `suspension` events and a `/toolDecision` endpoint
- Add `ask_user` tool support — the agent can ask clarifying questions via `event: question` SSE events, answered via `/answer`
- Convert the chat page layout to use `<Frame>` elements with the agent bar pattern (matching route-agent page)
- Add a `clientEntry` streaming component that consumes SSE events and renders in the agent bar
- Add frame navigation as an optional capability — agent tool results can optionally trigger `event: navigate` to show admin pages in a second frame
- Remove the `wantsJson()` dual-mode response path — **BREAKING**: the POST endpoint always returns SSE, no longer supports `Accept: application/json`
- Add `ask_user` tool to the support agent's toolset for disambiguation

## Capabilities

### New Capabilities

- `support-agent-streaming`: Real-time SSE streaming for support agent conversations — text deltas, inline tool approvals, and ask_user questions delivered over a single POST connection
- `support-agent-frame-ux`: Frame-based chat UI with agent bar, inline approval buttons, and optional frame navigation for agent-driven admin page display
- `support-agent-ask-user`: Clarifying question tool that lets the support agent ask the admin for disambiguation mid-conversation

### Modified Capabilities

- (none — this is a new reimplementation of the existing chat UI, no existing specs change)

## Impact

- `app/actions/mastra/controller.tsx` — rewrite `action` handler to stream; replace `approve`/`decline` handlers with `toolDecision`/`answer`; remove `wantsJson` branching
- `app/actions/mastra/shared-agent.ts` — remove `callAgentWithTimeout()`, update `TestAgent` type to include `stream()`, `resumeStream()`
- `app/actions/mastra/agents/support-agent.ts` — add `askUserTool` to the toolset
- `app/ui/admin-mastra-chat-page.tsx` — replace with Frame-based page + agent bar layout
- `app/assets/support-agent-stream.tsx` — **NEW** clientEntry streaming component (analogous to `route-agent-stream.tsx`)
- `app/routes.ts` — add `/toolDecision` and `/answer` POST routes to the support agent route map
- `app/router.ts` — add explicit controller mapping for new support agent routes
- Removes: session-flash tool approval pattern, `wantsJson()` code path, `callAgentWithTimeout()` helper
