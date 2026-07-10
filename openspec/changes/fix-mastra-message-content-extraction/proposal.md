## Why

Mastra 1.49.0 stores message content in `{ parts: [{ type: "text", text: "..." }] }` format, but `messageContentToText()` in `app/utils/message-content.ts` only handles format 2 (`{ format: 2, parts: [...] }`) and direct `.text` fields. Every recalled message gets `''` as content and is filtered out by `recallChatMessages()`, making conversation history disappear silently at `/mastra/chat` and `/admin/chatlog`.

## What Changes

- Fix `messageContentToText()` to handle Mastra's `{ parts: [...] }` format (no `format: 2` wrapper)
- Verify that `recallChatMessages` returns content correctly after the fix
- Verify that `/admin/chatlog` fragments render message content

## Capabilities

### New Capabilities

- `mastra-message-content-extraction`: Reliable text extraction from Mastra message content formats, including the current `{ parts: [...] }` format, the legacy `{ format: 2, parts: [...] }` format, and plain text.

### Modified Capabilities

- _(none — no spec-level requirement changes)_

## Impact

- **Modified file**: `app/utils/message-content.ts` — add `parts` array handling to `messageContentToText()`
- **No database changes** — data is already stored correctly, just not displayed
- **No API changes** — the fix is entirely in the text extraction utility
