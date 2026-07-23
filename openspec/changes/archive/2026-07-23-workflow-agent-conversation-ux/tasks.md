## 1. Page Template

- [x] 1.1 Replace `<input id="workflow-agent-input">` with `<textarea id="workflow-agent-input">` in `app/ui/workflow-agent-page.tsx`
- [x] 1.2 Add `div#chat-messages` conversation container alongside or replacing `div#agent-bar` in the page template

## 2. Stream Client — Core Conversation UI

- [x] 2.1 Add chat bubble rendering functions (`appendUserMessage`, `appendAgentMessage`, `updateLastAgentMessage`, `replaceAgentMessageContent`) to `workflow-agent-stream.browser.tsx`
- [x] 2.2 Add `scrollToBottom` helper for the chat container
- [x] 2.3 Rewrite `renderBar` / `startStream` `message` event handler to use bubble rendering instead of overwriting `agent-bar`
- [x] 2.4 Rewrite the `complete` event handler to finalize the agent bubble and reset stream state
- [x] 2.5 Add `handleTextareaKeydown` for Enter-to-send / Shift+Enter-newline behavior
- [x] 2.6 Register the textarea keydown listener in the `ref` lifecycle

## 3. Stream Client — Question and Suspension Rendering

- [x] 3.1 Adapt `showQuestion` from the support agent to render radio/checkbox options inside the current agent bubble (use English labels)
- [x] 3.2 Add `showSuspension` that renders approve/decline buttons with semantic coloring (red for destructive tools like cancel, blue for other tools)
- [x] 3.3 Add `handleToolDecision` that posts to `/workflow-agent/tool-decision` and starts a new stream
- [x] 3.4 Wire the `suspension` SSE event to `showSuspension` instead of plain `renderBar`

## 4. Stream Client — Frame Auto-Reload and PDF

- [x] 4.1 On `complete` event, if `didNavigate` is false, reload the active frame using `handle.frames.get()` with `data-active-frame` attribute
- [x] 4.2 Adapt PDF download rendering so the download link appears inside the agent's final message bubble rather than as a standalone bar element

## 5. Stream Client — Error Handling

- [x] 5.1 Add `tool-error` SSE event handler that renders an italic red error message in the conversation
- [x] 5.2 Add `appendStatusMessage` helper for non-bubble status/error text

## 6. Scorer

- [x] 6.1 Create `app/actions/mastra/scorers/workflow-scorers.ts` with a protocol-adherence scorer
- [x] 6.2 Register the scorer on the `workflowAgent` in `workflow-agent.ts` with an appropriate sampling rate

## 7. Tests

- [x] 7.1 Update or add test coverage for the stream client's new SSE event handlers (suspension, tool-error, complete-with-reload)
- [x] 7.2 Verify the scorer integration in the workflow agent test suite

## 8. Polish

- [x] 8.1 Remove the now-unused `agent-bar` div from `workflow-agent-page.tsx` if fully replaced
- [x] 8.2 Run lint and typecheck
