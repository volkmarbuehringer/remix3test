## Context

The route-agent client entry (`route-agent-stream.tsx`) receives `question` SSE events with fully-structured `options` (label + description) and `selectionMode` (`single_select` or `multi_select`). However, `showQuestion()` ignores the options — it calls `window.prompt(data.question)` which accepts arbitrary text. The options and descriptions are present in `data` but never rendered.

The server-side pipeline (controller `filterAndForward` → SSE `question` event) already delivers the full payload from Mastra's `askUserTool`. The `handleAnswer()` flow for the answer endpoint is also correct — it sends the label string back to the agent via `POST /answer`.

The gap is exclusively in the client-side rendering of `showQuestion` and the `#agent-bar` DOM container.

## Goals / Non-Goals

**Goals:**
- `showQuestion` renders `data.options` as interactive radio buttons (single_select) or checkboxes (multi_select)
- Each option shows its `label` and optional `description`
- User confirms selection with a button; the selected label(s) are sent to `handleAnswer`
- The question card is styled to fit within the agent bar area with clean spacing
- Agent instructions updated to demonstrate the pattern with a MIME-type question before navigating to `/uploads`
- CSS additions are scoped to `route-agent-page.tsx` styles (no new CSS files)

**Non-Goals:**
- No changes to the SSE protocol, controller, or server-side streaming
- No changes to `handleAnswer` or the `POST /answer` endpoint
- No changes to other agents (test-agent, support-agent, customer-agent) — only route-agent
- No new external dependencies
- No changes to the frame navigation flow

## Decisions

**1. Inline question card inside `#agent-bar` rather than a separate overlay/modal**

Chosen over a modal or separate panel because:
- The bar is already the agent's output area for messages, tool results, and questions
- A modal would block interaction with the frame content unnecessarily
- The existing `showQuestion` already modifies the bar's content (`setBarText`, click handler) — extending this pattern is consistent
- A separate panel below the bar would require layout changes to `route-agent-page.tsx`

**2. Pure innerHTML construction rather than clientEntry component**

Chosen over creating a separate clientEntry component because:
- `showQuestion` lives inside the existing `clientEntry`, which owns the stream lifecycle
- A separate component would need to communicate back to the stream handler for the answer flow
- The question card is ephemeral — shown when a question arrives, destroyed when answered
- Minimal state: one selected value + one click handler

**3. Confirm button rather than auto-submit on radio selection**

Chosen because:
- `single_select` with auto-submit could be accidentally triggered
- The confirm button pattern works for both `single_select` and `multi_select` uniformly
- Matches user expectation: select an option, then confirm

**4. Only route-agent gets the new question UI pattern**

Chosen because:
- The route-agent is the primary user-facing agent; test-agent and support-agent are internal
- The structured question UI is identical per SSE protocol — other agents can adopt later
- Scoping reduces risk and review surface

## Risks / Trade-offs

- [Risk] innerHTML with user-supplied option labels could be XSS vector → [Mitigation] Option labels come from Mastra `askUserTool` invocation, which is developer-authored (not user-supplied). The `question` field is also agent-authored. No user input reaches the innerHTML without first traveling through the agent's LLM — but escape with `textContent` assignment for safety anyway.
- [Risk] The bar currently has a fixed `maxHeight: 3rem` which would clip the question card → [Mitigation] The question card needs `maxHeight` removed or increased. The bar container already has `overflowY: auto` — the card will scroll if it exceeds available space.
- [Risk] Rapid back-to-back questions could cause visual flickering → [Mitigation] The stream cancels on each new question, and `showQuestion` replaces the entire bar content atomically.
