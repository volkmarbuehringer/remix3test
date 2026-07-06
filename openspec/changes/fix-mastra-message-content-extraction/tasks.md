## 1. Fix messageContentToText

- [x] 1.1 Add `parts` array handling to `messageContentToText()` in `app/utils/message-content.ts` — detect object with `parts: [...]` (without requiring `format: 2`), extract `text` from `type: "text"` parts, join with newlines

## 2. Verify

- [x] 2.1 Run `npm run typecheck` — no errors
- [x] 2.2 Run `npm run lint` — no errors
- [ ] 2.3 Manual verification: navigate to `/mastra/chat?threadId=<existing-id>` and confirm messages render
- [ ] 2.4 Manual verification: navigate to `/admin/chatlog` and confirm detail fragments show message content
