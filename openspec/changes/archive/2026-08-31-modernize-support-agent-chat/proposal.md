## Why

The support-agent chat (`/admin/support-agent`) loses work whenever an admin disconnects. A pending tool approval or an `ask_user` suspension is emitted as a one-shot SSE event and is gone after a reload, a tab switch, or a server restart — the controller holds no durable state and the client re-renders nothing on load. On top of that, the chat UI still falls back to the native `window.prompt()` for single-select questions instead of the structured question/result surfaces the rest of the admin agent experience already uses. This change makes the support-agent chat resilient to disconnects and brings its interaction into the structured UI pattern.

## What Changes

- **Persist pending gate state per admin.** When the support agent suspends on a tool approval or an `ask_user`/confirm gate, record the run id, thread id, tool call id, tool name, args, and suspend payload in a durable per-admin index (Postgres), so it survives a reload, a browser change, or a server restart.
- **Reconnect on load.** Add a non-mutating reconnect path: when the support-agent page loads, it checks for an indexed pending gate and re-renders the decision/question so the admin can resume it. A completed, errored, or cancelled run clears the index.
- **Resume from durable state.** Approve/decline and `answer` resolve the suspended run from the durable index when it is not otherwise determinable (e.g. after a server restart). Unauthenticated reconnect is rejected.
- **Structured question card.** Replace the native `window.prompt()` single-select fallback with a rendered question card in the chat area, supporting single-select and multi-select, styled through the theme token system and keyboard accessible.
- **Structured tool-result rendering.** Render tool results (appointments, users, offerings, stats, PDFs) as structured output rather than only raw streamed text, so the panel/chat stays readable.
- **BREAKING (client-only):** the single-select `ask_user` answer is no longer collected via `window.prompt()`; it moves to the rendered question card.
- No change to the support agent's read-only boundary: account mutations stay out of scope and remain the agent-events pipeline's job.

## Capabilities

### New Capabilities
- `support-agent-durable-resume`: durable per-admin pending-gate index, a non-mutating reconnect surface, resurfacing of a suspended tool approval / question on page load, and resume resolved from durable state after a restart (mirrors the `agent-events-reconnect` pattern for the support agent).
- `support-agent-structured-ui`: an in-chat structured question card (single/multi select, replaces `window.prompt()`) and structured rendering of tool results in the support-agent chat.

### Modified Capabilities
<!-- No existing requirement is being relaxed or replaced; both additions are new surfaces. -->

## Impact

- **Affected modules**: `app/actions/support-agent/controller.tsx` (durable index read/write, reconnect action, resume resolution), a new data-access module for the per-admin pending-gate index (alongside `app/data/`), `app/actions/mastra/tools/support-tools.ts` (typed `outputSchema` for structured results), `app/assets/streams/public/support-agent-stream.tsx` (question-card + result rendering, reconnect-on-load), `app/ui/support-agent-page.tsx` (card/result containers), `app/actions/mastra/agents/support-agent.ts` (instruction touch-up only).
- **Router**: `routes.admin.supportAgent` and the `support-agent-panel` frame target are unchanged; the reconnect is a new action/endpoint under the same controller.
- **Dependencies / systems**: Postgres for the durable per-admin index (no new package); no schema migration beyond the new index table. Client stream and frame layout are preserved.
