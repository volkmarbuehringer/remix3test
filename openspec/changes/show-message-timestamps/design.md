## Context

Each `ChatMessage` already carries a `timestamp: number` field (Unix ms, set by `Date.now()` in the controller when the message is appended). The admin chatlog pages display it:

```tsx
// admin-chatlog-page.tsx:167
{msg.timestamp && <span>{new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>}
```

The user-facing `chat-page.tsx` and `agent-page.tsx` have the full message data but never render the timestamp.

## Goals / Non-Goals

**Goals:**
- Add a `HH:mm` timestamp (German locale) to each message in `chat-page.tsx`
- Add a `HH:mm` timestamp (German locale) to each message in `agent-page.tsx`
- Keep existing meta badges (elapsed, tokens, toolCalls) intact
- Match the admin page styling — muted text, small font, placed after the role label

**Non-Goals:**
- Changing the `ChatMessage` data model or how timestamps are stored
- Adding date display (time-only, consistent with admin pages)
- Creating a shared timestamp utility (inline formatting keeps the change small)
- Adding timestamps to admin pages (already done)

## Decisions

1. **Inline formatting** — use `toLocaleString('de-DE')` to show full date and time in German format (e.g. `10.6.2026, 14:23:45`). No new utility function needed.

2. **Placement** — append the timestamp after the role label, before the elapsed/tokens badges, separated with ` · ` (middle dot) for visual clarity:
   ```
   Du · 10.6.2026, 14:23:45
   Assistent · 10.6.2026, 14:23:45  2.1s  342 tokens
   ```

3. **Styling** — reuse the existing `messageLabelStyle` (`fontSize: theme.fontSize.xxs, opacity: 0.7`) for the timestamp span, same as the role label. No new CSS variable needed.

4. **Conditional guard** — wrap in `{msg.timestamp && (...)}` to handle old messages that may lack a timestamp field (legacy data).

## Risks / Trade-offs

- **Old data**: Messages from before the timestamp field was added to ChatMessage won't show a timestamp. The `&&` guard handles this silently.
- **Consistency**: The chat page uses `messageMetaStyle` at the bottom of the bubble; the agent page puts it at the top. Both are correct for their layout — timestamps follow the same placement pattern as the role label in each.
