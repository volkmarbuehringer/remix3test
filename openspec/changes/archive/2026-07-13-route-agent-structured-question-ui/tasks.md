## 1. Client-Side Structured Question UI

- [x] 1.1 Replace `prompt()` call in `showQuestion` with innerHTML construction of radio buttons (single_select) or checkboxes (multi_select) from `data.options`
- [x] 1.2 Add confirm button below options that reads the selected value(s) and calls `handleAnswer`
- [x] 1.3 Add multi_select handling: render checkboxes, gather checked values as JSON array, set `selectionMode` on FormData
- [x] 1.4 Add fallback to text input when `options` is null or empty
- [x] 1.5 Escape `label` and `description` values using `textContent` before inserting into innerHTML

## 2. Question Card Styling

- [x] 2.1 Add CSS for question card layout: option rows, labels, descriptions, confirm button
- [x] 2.2 Adjust `#agent-bar` `maxHeight` constraint to accommodate the question card without clipping
- [x] 2.3 Ensure radio/checkbox inputs use visible native styling or custom-styled labels

## 3. Agent Instruction Update

- [x] 3.1 Add navigation rule to agent instructions in `app/actions/mastra/agents/route-agent.ts`: before `/uploads`, ask MIME type via `askUserTool`; after answer, if "PDF" call navigate('/uploads') else text response
- [x] 3.2 Fix: instruction was framed as conditional guard ("ONLY navigate if...") but agent needed procedural trigger ("if PDF → call navigate immediately")
- [x] 3.3 Fix: rate limiter default maxAttempts=1 blocked answer POST within 10s window; changed to perKey with maxAttempts=5
- [x] 3.4 Fix: handleAnswer read pendingQuestion.runId AFTER hideQuestion() nulled it — saved reference before hide
