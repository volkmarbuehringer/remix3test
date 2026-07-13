## Why

The route-agent supports `askUserTool` which delivers structured options (labels, descriptions, selection mode) to the client via SSE, but the client-side `showQuestion` discards the options entirely — it falls back to `prompt()` which accepts free text. This forces agents to handle ambiguous or misspelled user input instead of receiving exact labels. Adding structured option rendering enables richer agent-user interactions like MIME-type selection, list-picking, and multi-select confirmation flows.

## What Changes

- Replace `prompt()`-based `showQuestion` in `route-agent-stream.tsx` with radio button / checkbox UI that renders `data.options`
- Update agent instructions in `route-agent.ts` to navigate to `/uploads` only after user confirms PDF via structured question
- Add CSS for the question card (radio buttons, option descriptions, confirm button) to the agent bar

## Capabilities

### New Capabilities
- `structured-question-ui`: The route-agent client entry renders structured question options (radio buttons for single_select, checkboxes for multi_select) instead of a plain text prompt. Options show labels and descriptions. The selected label is sent back to the agent as the answer.

### Modified Capabilities
- `dedicated-route-agent`: Agent instructions extended to require MIME-type confirmation before navigating to `/uploads`, using the structured question pattern.

## Impact

- `app/assets/route-agent-stream.tsx` — `showQuestion()` rewritten to render options; `handleAnswer()` unchanged
- `app/actions/mastra/agents/route-agent.ts` — agent instructions extended with upload-navigation rule
- `app/ui/route-agent-page.tsx` — agent bar styles extended for question card layout (no structural changes)
