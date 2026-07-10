## Why

The MastraChatPage has two UI problems: (1) after sending a message, the page doesn't auto-scroll to show new messages, and (2) the form takes too much vertical space while the conversation area gets cramped, with unused space below the form.

## What Changes

- Add auto-scroll behavior: after page load (or after POST redirect), scroll `#chat-messages` to the bottom
- Compact the form layout: reduce padding, shrink the textarea, remove unnecessary visual weight so the conversation area gets proportionally more space
- Remove unused space below the form

## Capabilities

### New Capabilities

- `mastra-chat-ui`: Chat page UI layout and auto-scroll behavior

### Modified Capabilities

- _(none)_

## Impact

- **Modified file**: `app/ui/admin-mastra-chat-page.tsx` — CSS and layout changes, add scroll-on-load behavior
