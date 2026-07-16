## Context

The support agent is a Mastra agent used by admin operators to query users, appointments, resources, and system data. It currently runs on `agent.generate()` with a synchronous request/response cycle: POST to `/mastra/chat` → blocks until complete → returns JSON or redirects to the chat page with query params.

Three other agents in the codebase already use streaming:

- **route-agent**: Direct pipe — `agent.stream()` → `ReadableStream` → SSE, proven in production
- **test-agent**: Two-phase — POST stores stream, GET `/stream/:runId` reads it via EventSource
- **customer-agent**: Same two-phase pattern as test-agent

The route-agent's direct-pipe pattern is the simplest and best-proven approach. This design adapts it for the support agent, which has unique complexity: admin context injection (`runWithAdminId`), a `requireApproval: true` tool (`cancelUserAccount`), and a different UI layout (chat history in a frame, agent bar below).

## Goals / Non-Goals

**Goals:**

- Replace `agent.generate()` with `agent.stream()` with direct-pipe SSE
- Inline tool approvals via SSE `suspension` events (no page redirects)
- Add `ask_user` tool support for disambiguation
- Frame-based UI with agent bar (matching route-agent UX pattern)
- Client-side `clientEntry` component consuming SSE events
- Preserve `runWithAdminId` async-storage injection for tool execution context
- Per-user rate limiting, audit logging, validation (keep existing)

**Non-Goals:**

- Route navigation tools for the support agent (frame navigation is passive — agent tool results can opt-in to `event: navigate`, but no dedicated navigation tools are added)
- Removing the `MastraChatPage` component entirely (it still renders initial chat history on GET)
- Supporting JSON API consumers of the old endpoint (breaking change accepted per proposal)
- Migrating the test-agent or customer-agent to direct-pipe (out of scope)

## Decisions

### D1: Direct-pipe SSE (route-agent style) over two-phase

| Criterion          | Direct-pipe       | Two-phase                          |
| ------------------ | ----------------- | ---------------------------------- |
| Connection count   | 1 POST            | 2 (POST + GET/EventSource)         |
| Stream store       | None              | `stream-store.ts` with 5min TTL    |
| Reconnection       | None needed       | EventSource handles auto-reconnect |
| Complexity         | Lower             | Higher                             |
| Proven in codebase | Yes (route-agent) | Yes (test-agent, customer-agent)   |

The support agent's chat interactions are discrete queries, not long-lived sessions that benefit from reconnection. Direct-pipe is simpler and already proven.

### D2: Frame layout over page-reload layout

The current support agent page reloads on every message (POST → redirect → GET). Frame layout means:

- Chat history renders inside `<Frame name="support-content">`
- Agent bar and input bar live outside the frame (unaffected by frame reloads)
- On `event: complete`, the frame reloads to show updated chat history
- Optional: a second frame (`admin-content`) for agent-driven page display via `event: navigate`

This is the exact layout structure of the route-agent page, minus the multi-frame switching (initially).

### D3: Agent bar renders streaming text (not chat bubbles)

Streaming text, questions, and approval buttons all render in the agent bar below the frame — matching the route-agent pattern exactly. The frame above shows the server-rendered chat history from `recallChatMessages()`. On `complete`, the frame reloads and the bar resets.

### D4: SSE event contract (subset of route-agent)

| SSE Event     | Route Agent | Support Agent | Notes                                                                 |
| ------------- | ----------- | ------------- | --------------------------------------------------------------------- |
| `start`       | Yes         | Yes           | Same shape: `{ runId, threadId }`                                     |
| `message`     | Yes         | Yes           | Same shape: `{ text }`                                                |
| `suspension`  | Yes         | Yes           | Same shape: `{ toolCallId, toolName, args }`                          |
| `question`    | Yes         | Yes           | Same shape: `{ runId, toolCallId, question, options, selectionMode }` |
| `navigate`    | Yes         | **Optional**  | Only emitted if a tool result has `type: "route"`                     |
| `complete`    | Yes         | Yes           | Same shape: `{}`                                                      |
| `agent-error` | Yes         | Yes           | Same shape: `{ error }`                                               |
| `tool-error`  | Yes         | Yes           | Same shape                                                            |
| `tool-result` | Yes         | Yes           | Same shape                                                            |

The `navigate` event is structurally the same but only included if a tool returns a route result. No dedicated navigation tools are added; if a support tool happens to return addressable page data, the pipe can emit `navigate`.

### D5: `/toolDecision` replaces approve/decline split

Current: two endpoints (`/approve`, `/decline`) with session-flash.
New: one endpoint (`/toolDecision`) with `?decision=approve|decline`, matching route-agent's `/toolDecision`.

The route agent's `toolDecision` handler returns a new SSE stream from `approveToolCallGenerate()` or `declineToolCallGenerate()`. The support agent reuses this exact pattern. Only difference: the handler wraps calls in `runWithAdminId()` for the admin identity context.

### D6: `runWithAdminId` wraps `agent.stream()` not `agent.generate()`

Current code:

```ts
let result = await runWithAdminId(user.id, () =>
  callAgentWithTimeout({ agent, message, threadId, userId, maxSteps, timeoutMs }),
)
```

New code — the `runWithAdminId` wraps the `agent.stream()` call, just as the route agent currently doesn't need it but the support agent does for its tools:

```ts
let output = await runWithAdminId(user.id, () =>
  agent.stream(message, { memory: { thread: threadId, resource: String(user.id) } }),
)
```

The async storage persists across tool execution boundaries within the same agent call, so `cancelUserAccount`'s `requireAdminId()` continues to work.

### D7: `ask_user` tool added to support agent

A new `askUser` tool with `requireApproval: false` (it suspends naturally via `tool-call-suspended` chunk). The agent instructions guide usage for ambiguous queries — e.g., multiple users matching a name, overlapping date ranges, etc.

The SSE pipe already handles `tool-call-suspended` → `event: question`. The client already has question rendering (radio buttons, checkboxes, free-text) from the route-agent stream component. The answer flow (POST `/answer` → `resumeStream` → new SSE stream) is identical.

## Risks / Trade-offs

| Risk                                                                                                                                                   | Mitigation                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cancel-user approval flow**: `cancelUserAccount` is intentionally scary; inline buttons in the agent bar may feel too casual                         | The suspension SSE event carries `{ toolName: "cancel_user_account", args: { targetUserId } }`. The client can render a more prominent red warning card instead of the generic inline buttons when `toolName === "cancel_user_account"`. The route-agent stream component already supports conditional rendering based on event data. |
| **Frame reload loses agent bar state**: If the agent navigates to a slow page, the `complete` → frame reload may happen before the navigation finishes | The client waits for both: on `complete`, reload the frame. On `navigate`, set frame src and wait for frame load event before allowing new input.                                                                                                                                                                                     |
| **Rate limiter becomes per-IP**: Route agent uses per-IP rate limiting; support agent currently uses per-user                                          | Keep per-user rate limiting (it's session-based). The limiter implementation already supports `perUser: true`.                                                                                                                                                                                                                        |
| **Breaking change for JSON consumers**: Old `wantsJson` callers will get SSE bytes instead of JSON                                                     | The proposal marks this as **BREAKING**. If a consumer exists, it needs updating. If none exists, no impact.                                                                                                                                                                                                                          |
| **`agent.stream()` timeout**: `generate()` had a manual 60s timeout via AbortController. The stream pattern doesn't have an obvious equivalent.        | Pass `abortSignal` to `agent.stream()` options — the same AbortController pattern works. Pipe the signal through `pipeStream()` to close the SSE response cleanly.                                                                                                                                                                    |
