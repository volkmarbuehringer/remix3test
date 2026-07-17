## 1. Page Layout (`app/ui/support-agent-page.tsx`)

- [x] 1.1 Replace `#agent-bar` div with a `#chat-messages` div (scrollable, min-height ~4.5rem, max-height ~40vh, overflow-y auto)
- [x] 1.2 Replace `<input type="text">` with `<textarea rows="3">` with `resize: none` and matching input styles
- [x] 1.3 Add `rows` attribute and `onkeydown` (or prepare for clientEntry to handle Enter/Shift+Enter)
- [x] 1.4 Remove `agentBarStyle` and add `chatMessagesStyle` and `textareaStyle` CSS definitions

## 2. Stream Handler Core (`app/assets/support-agent-stream.tsx`)

- [x] 2.1 Add `appendUserMessage(text)` — creates a user-styled message element in `#chat-messages`
- [x] 2.2 Add `appendAgentMessage(text?)` — creates an empty agent-styled message element, returns reference for streaming updates
- [x] 2.3 Add `updateLastAgentMessage(text)` — updates the last agent message element's text content during streaming
- [x] 2.4 Replace `setBarText()` calls with appropriate append/update functions throughout
- [x] 2.5 Implement auto-scroll-to-bottom on new messages (with 50px threshold to preserve manual scroll-up)

## 3. Inline Question Rendering

- [x] 3.1 Refactor `showQuestion()` to render inside the current agent message bubble instead of replacing `#agent-bar` content
- [x] 3.2 Render radio/checkbox options as interactive elements inside the agent bubble
- [x] 3.3 On "Bestätigen" click: append user's selection as a user message element, resume stream
- [x] 3.4 Refactor prompt-based questions (no options) to show a clickable prompt inside the bubble

## 4. Inline Suspension Rendering

- [x] 4.1 Refactor `showSuspension()` to render approve/decline buttons inside the current agent message bubble
- [x] 4.2 On approve/decline: append decision as a user message element, resume stream
- [x] 4.3 Remove `hideQuestion()` or simplify to clear only inline interactive elements

## 5. Textarea Input Handling

- [x] 5.1 Add `keydown` listener on the textarea: Enter (no Shift) submits form, Shift+Enter inserts newline
- [x] 5.2 Update `handleFormSubmit` to reference textarea value (same as input.value, but verify)
- [x] 5.3 Clear textarea after successful submit

## 6. Form Submit + Stream Lifecycle Updates

- [x] 6.1 In `handleFormSubmit`: call `appendUserMessage(message)` before clearing input and starting stream
- [x] 6.2 In `startStream`: on `start` SSE event, call `appendAgentMessage()` to create the placeholder element
- [x] 6.3 In `startStream`: on `message` SSE event, call `updateLastAgentMessage()` instead of `setBarText()`
- [x] 6.4 In `startStream`: on `question` SSE event, render question inside the current agent bubble (not separate bar)
- [x] 6.5 Update `handleAnswer` and `handleToolDecision` to append user response as a message element
- [x] 6.6 Remove `setBarText` calls for transient status — render as brief message elements instead

## 7. Cleanup

- [x] 7.1 Remove `agentBarStyle` CSS and `#agent-bar` references from `support-agent-page.tsx`
- [x] 7.2 Remove `agentBarStyle` CSS from `support-agent-stream.tsx` if any inline styles remain
- [x] 7.3 Verify no other code references `#agent-bar` (grep repo) — remaining references are in `route-agent-stream.tsx`/`route-agent-page.tsx` (separate component, not in scope)
- [x] 7.4 Run typecheck: `npm run typecheck`
- [x] 7.5 Run tests: `npm test` — all server tests pass; browser test infra unavailable (pre-existing)
