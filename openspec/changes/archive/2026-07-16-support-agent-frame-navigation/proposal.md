## Why

The support agent currently answers all queries as text in the agent bar, even when the answer could be better served by showing a data page (user grid, appointment list, etc.) in the main viewport. The route agent already demonstrates this pattern — the frame is the primary surface, the agent bar is the conversation layer. This change brings the same capability to the support agent: the frame-as-primary layout, a navigate tool, and the SSE wiring to drive it. Which specific queries map to which routes is explicitly deferred to a later change.

## What Changes

- Support agent page layout: replace the chat-thread frame with a navigatable frame as the primary viewport (matching the route-agent pattern)
- Support agent gains the `routeNavigate` tool (reuse existing tool from route agent)
- The SSE pipe already handles `{ type: 'route' }` tool results — the support agent stream already has `handleNavigate()` — no infra changes needed
- Agent instructions updated to mention navigation capability (but no concrete route mappings yet)
- Default frame state shows a placeholder prompt instead of a chat thread

**No changes to:** route agent, agent-sse.ts pipeStream, backend support tools, admin layout, or frame infrastructure.

## Capabilities

### New Capabilities
- `support-agent-frame-layout`: Frame-as-primary viewport layout for the support agent page, with agent bar + input below
- `support-agent-navigate-tool`: The `routeNavigate` tool wired into the support agent, enabling it to drive frame navigation from SSE events

### Modified Capabilities
- `support-agent-tools`: Toolset is extended to include `routeNavigate`; instructions updated to mention navigation capability

## Impact

- `app/ui/support-agent-page.tsx` — layout change (remove chat-thread frame, add placeholder)
- `app/assets/support-agent-stream.tsx` — may need small adjustments for new default state
- `app/actions/mastra/agents/support-agent.ts` — add routeNavigate to tools, update instructions
- `app/actions/mastra/controller.tsx` — may need to serve a placeholder page for the frame default
- `app/actions/mastra/tools/route-navigate.ts` — reused as-is, no changes
