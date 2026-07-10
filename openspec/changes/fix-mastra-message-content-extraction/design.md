## Context

The `messageContentToText()` function in `app/utils/message-content.ts` is used by `recallChatMessages()` to convert stored message content to displayable text. Mastra 1.49.0 stores message content as `{ parts: [{ type: "text", text: "..." }] }`, but `messageContentToText()` only handles format 2 (`{ format: 2, parts: [...] }`) and direct `.text` fields. This causes every message to return `''` as content, which gets filtered out silently, making all conversation history appear missing at `/mastra/chat` and `/admin/chatlog`.

## Goals / Non-Goals

**Goals:**

- Add `parts` array handling to `messageContentToText()` as a third content format handler
- Verify recalled messages render correctly in `/mastra/chat`
- Verify recalled messages render correctly in `/admin/chatlog/fragments/detail/:id`

**Non-Goals:**

- Changing how Mastra stores message content (that's the framework's format)
- Adding new test coverage for `messageContentToText()` (existing tests cover the current format)

## Decisions

### Decision 1: Handle `parts` without requiring `format: 2`

**Chosen:** Add a `parts` branch that activates when `content` is an object with a `parts` array, regardless of whether `format: 2` is set.

**Rationale:** The Mastra Memory stores content as `{ parts: [...] }` without a `format` wrapper. The existing code already handles `format: 2` with `parts` — this change just relaxes the detection to also catch raw `parts` arrays. The text extraction logic (iterate parts, extract `.text` from `type: "text"` parts) is identical.

## Risks / Trade-offs

- **No new risk** — the change is a pure extension of the existing format detection, adding a handler for a format that Mastra emits but the code didn't previously recognize. It cannot break existing format-2 or plain-text handling.
