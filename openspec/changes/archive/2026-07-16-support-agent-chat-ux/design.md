## Context

The `SupportAgentPage` (app/ui/support-agent-page.tsx) wraps a Frame + agent-bar + input form. All agent communication flows through `SupportAgentStream` (app/assets/support-agent-stream.tsx), a clientEntry that connects to the Mastra agent SSE endpoint. Currently `setBarText()` overwrites a single DOM text node — there's no message accumulation. The input is a single-line `<input type="text">`.

A separate `MastraChatPage` (app/ui/admin-mastra-chat-page.tsx) already implements chat-bubble rendering with recalled messages for the frame-embedded view, providing reusable bubble styles.

## Goals / Non-Goals

**Goals:**
- Accumulate user messages and agent responses as DOM elements in a scrollable container
- Input changed to `<textarea rows="3">` with Enter-to-submit, Shift+Enter for newline
- Agent questions (with radio/checkbox options) render inline in the message stream
- Tool suspension approvals render inline with approve/decline buttons
- Transient status lines become brief message elements
- Replace `#agent-bar` with `#chat-messages` container

**Non-Goals:**
- No changes to the SSE event protocol or backend agent logic
- No changes to the Frame or admin panel
- No mobile layout changes
- No message persistence beyond the current page session (thread recall via existing mechanism)

## Decisions

1. **Inline rendering for questions/suspensions vs separate bar** — Render questions and tool approvals as interactive elements inside agent message bubbles in the chat stream. This keeps the conversation linear and avoids the multi-role confusion of the current agent-bar. Questions render their radio/checkbox options in the bubble; clicking "Bestätigen" appends the user's choice as a user message and resumes the stream.

2. **Message container placement** — Insert `#chat-messages` between the Frame and the input area (frame flex:1, chat flex:0 1 auto with max-height ~40vh, input fixed). This mirrors standard messaging app layout (content → history → input) and keeps the chat visually connected to the input affordance.

3. **DOM-based rendering (not React state)** — The `SupportAgentStream` clientEntry operates outside of the Remix UI tree on raw DOM elements. Following the existing pattern, message elements are created with `document.createElement` and appended to `#chat-messages`. No component re-rendering needed.

4. **Stream-to-message mapping** — Each conversation turn produces at most 2 message elements: one user, one agent. The agent element is created empty on stream start and updated in-place during `message` SSE events. On `question` or `suspension`, interactive controls are appended to the agent element. On `complete`, the element is finalized.

5. **Enter to submit** — The textarea gets a `keydown` listener. Enter without Shift submits the form, Shift+Enter inserts a newline. This matches the existing Enter-to-submit behavior while allowing multi-line input.

6. **Bubble style reuse** — The user/agent bubble CSS from `MastraChatPage` (userBubbleStyle, assistantBubbleStyle) is extracted to a shared module or duplicated in the clientEntry, since clientEntries can't import Remix `css()` tagged templates directly (they run in a different context). Inline styles via `element.style.*` are the reliable path for clientEntry DOM manipulation.

## Risks / Trade-offs

- [Scroll jitter] Auto-scroll to bottom during streaming could fight manual scroll-up attempts. → Only auto-scroll when user is near the bottom (within ~50px threshold).
- [Question rendering complexity] Rendering radio/checkbox option lists as DOM elements inside message bubbles is more code than the current bar replacement. → Worth it for coherent UX; the pattern is already proven in `showQuestion()`.
- [Agent-bar removal breaks unknowns] Any code referencing `#agent-bar` or external scripts that depend on it will silently fail. → Only referenced within `SupportAgentStream` itself; safe to remove.
- [Thread recall] Currently the page doesn't recall past messages on load. Without this, chat history starts empty each time. → Optional enhancement; can use existing `recallChatMessages` in the controller on initial render and embed the messages in the page for the clientEntry to pick up.
