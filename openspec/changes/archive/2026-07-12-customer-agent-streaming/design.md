## Context

The customer agent currently flows through four Remix3 controller actions (index, action, approve, decline) all using the blocking `agent.generate()` pattern. Transient state flows through session flash (`toolApproval`, `pendingBooking`, `bookingResult`, `postBookingDecision`). The test agent already implements the target streaming architecture: `agent.stream()` → in-memory stream store → SSE endpoint → clientEntry EventSource consumer.

## Goals / Non-Goals

**Goals:**
- Replace `agent.generate()` with `agent.stream()` in the customer chat controller
- Add a `/chat/stream/:runId` SSE endpoint following the test agent pattern
- Integrate `askUserTool` for structured resource selection, slot-fallback, and post-booking
- Replace `confirm_resource.requireApproval` with `askUserTool` choices
- Eliminate all session-based transient state
- Support multi-resource, multi-booking loops (no dead-end on no-slots)
- Add a `CustomerChatStream` clientEntry for real-time UI

**Non-Goals:**
- Converting the support agent (separate change)
- Generalizing the stream store or creating a shared SSE abstraction (use existing `app/utils/stream-store.ts`)
- Changing the auth model or thread-id validation
- Changing the underlying tools' business logic (search, slot finding, booking workflow)
- Test agent stream changes (that code is reference, not target)

## Decisions

### 1. Follow test agent streaming pattern, not typed SSE channels

The existing `sse-infrastructure` spec describes a typed `createChannel<EventMap>()` factory for general-purpose pub/sub. The test agent uses a simpler pattern: in-memory Map with TTL + raw ReadableStream from `agent.fullStream`. The customer agent will reuse `app/utils/stream-store.ts` and the same raw SSE event loop. Rationale: the Mastra agent stream emits 18+ event types with dynamic schemas — boxing them into a typed EventMap buys nothing and would fight the API.

### 2. askUserTool replaces confirm_resource.requireApproval

Currently `confirm_resource` has `requireApproval: true` which triggers a system suspend → redirect → approve/decline POST chain. With `askUserTool`, the agent presents a radio-button choice inline via an `ask_user` question card. The user picks, the answer feeds back via `agent.resumeStream()`, and the agent continues. This eliminates the redirect and gives the user a single-surfaced interaction. `cancel_booking` and `cancel_all_appointments` KEEP their `requireApproval: true` — destructive actions warrant a system confirmation button.

### 3. No more separate booking form

The current `confirm_booking` action and its `pendingBooking` session state go away entirely. When the agent finds slots (`tool-result` SSE event), the client renders clickable slot buttons inline. Clicking one sends a chat message ("Buchung Slot X"), the agent calls `trigger_booking_workflow`, and the result streams back. The agent then asks (via `askUserTool`) if the user wants another booking.

### 4. Controller actions consolidate

Current: 4 actions (index, action, approve, decline). Proposed:
- `index` — static page shell (messages loaded via recall + rendered by clientEntry on reconnect)
- `action` — starts or continues a stream via `agent.stream()`, returns JSON `{ runId }`
- `stream` — new SSE endpoint serving the stored stream (mirrors test agent)
- `approve` — `agent.approveToolCallGenerate()` for the two tools that keep `requireApproval`
- `decline` — `agent.declineToolCallGenerate()` for the same
- `answer` — new, `agent.resumeStream()` for `askUserTool` answers (mirrors test agent)

### 5. clientEntry structure

A new `app/assets/customer-chat-stream.tsx` mirrors `app/assets/test-agent-stream.tsx` with German text and customer-specific card rendering (resource cards, slot buttons, appointment lists). No shared base class — the two streams are diverging enough in UI that sharing would add complexity. However, the SSE event type handling loop is nearly identical; if a pattern emerges it can be extracted later.

## Risks / Trade-offs

- **Risk: askUserTool question blocks the stream until answered** → Mitigation: the question card is modal within the chat timeline; the user sees the question immediately and answers. Acceptable UX trade-off vs redirect chain.
- **Risk: cancel_booking + cancel_all_appointments still use requireApproval, creating two UX patterns** → Acceptable. Destructive actions need a system confirmation button (not just agent-mediated text). The customer will see a "Stornieren bestätigen" button for these vs a radio selection for resource choice.
- **Risk: ClientEntry lifecycle — reconnecting after page refresh loses stream state** → Mitigation: the stream store has a 5-minute TTL. On reconnect, the index action loads historical messages via `recallChatMessages` and re-renders them. If the stream is still alive, the client could re-subscribe; if not, the user sends a new message. This matches current behavior.
- **Risk: removing pendingBooking session state means slot data flows through the stream only** → If the user refreshes the page during slot display, slots are lost. This matches the test agent behavior — you lose in-progress streams on refresh. Acceptable; the user can ask the agent again.
