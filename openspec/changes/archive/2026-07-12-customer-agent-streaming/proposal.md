## Why

The customer agent currently uses a blocking `agent.generate()` call with full-page redirects for every interaction, session flash for approvals and booking state, and a separate booking form outside the agent loop. This creates a sluggish UX with page reloads between each step. Streaming the agent output with SSE gives real-time feedback, inline approvals, and keeps the customer in a single conversational flow.

## What Changes

- Convert the customer chat controller from `agent.generate()` to `agent.stream()` with SSE
- Add a `/chat/stream/:runId` SSE endpoint (mirrors test agent pattern)
- Replace the session-based booking form with agent-owned booking via `trigger_booking_workflow`
- Integrate `askUserTool` for resource selection, slot-fallback decisions, and post-booking questions
- Add a clientEntry `CustomerChatStream` component that renders SSE events inline
- Remove `confirm_resource` tool's `requireApproval` — replaced by `askUserTool` choices
- Eliminate all session-based transient state (`pendingBooking`, `bookingResult`, `postBookingDecision`, `toolApproval`)
- Support multi-resource, multi-booking conversational loops (no dead-end when a resource has no slots)

## Capabilities

### New Capabilities

- `customer-chat-streaming`: SSE-based streaming for the customer agent, including real-time text deltas, tool call visibility, inline approval cards, and structured questions via askUserTool
- `ask-user-tool-integration`: Integration of `askUserTool` from `@mastra/core/tools` into the customer agent for structured resource selection, slot-fallback decisions, and post-booking flow

### Modified Capabilities

- `sse-infrastructure`: Extend the existing SSE stream store and route pattern from the test agent to the chat route

## Impact

- **app/actions/chat/controller.tsx**: Replace action handler with stream-based flow, add stream route
- **app/actions/chat/controller.test.ts**: Rewrite tests for streaming flow
- **app/routes.ts**: Add `/chat/stream/:runId` route
- **app/actions/mastra/agents/customer-agent.ts**: Add `askUserTool`, remove `confirm_resource.requireApproval`
- **app/actions/mastra/tools/customer-tools.ts**: Update `confirm_resource` to no longer require system approval
- **app/ui/customer-chat-page.tsx**: Stripped down to static shell, streaming handled by clientEntry
- **app/assets/customer-chat-stream.tsx**: New clientEntry component for SSE consumption
- **Removed**: `pendingBooking` session state, `bookingResult` session state, `postBookingDecision` session state, `toolApproval` session flash
