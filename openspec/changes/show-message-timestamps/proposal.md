## Why

The user-facing chat and agent pages (`/ai/chat` and `/ai/agent`) display messages but show **no timestamp** — only the role label ("Du" / "Assistent"), optional elapsed time, and optional token count. The admin chatlog view already shows timestamps, but the primary chat/agent interfaces don't.

This makes it hard to tell when a conversation happened, which message came when, or how old the conversation is — especially when revisiting past conversations.

```
Current chat page:                    What it should show:
┌──────────────────────┐             ┌──────────────────────┐
│ Du                    │             │ Du  ·  14:23         │
│ ┌──────────────────┐ │             │ ┌──────────────────┐ │
│ │ Hello            │ │             │ │ Hello            │ │
│ └──────────────────┘ │             │ └──────────────────┘ │
│                      │             │                      │
│ Assistent  500ms     │             │ Assistent  ·  14:23  │
│ ┌──────────────────┐ │             │ ┌──────────────────┐ │
│ │ Hi there!        │ │             │ │ Hi there!        │ │
│ └──────────────────┘ │             │ └──────────────────┘ │
└──────────────────────┘             └──────────────────────┘
```

## What Changes

- Add a `msg.timestamp` display to each message bubble's meta row in `chat-page.tsx`
- Add a `msg.timestamp` display to each message bubble's meta row in `agent-page.tsx`
- Format: German locale (`de-DE`), showing time only (`HH:mm`) for today, date+time for older messages
- Consistent with the existing admin chatlog timestamp style

## Impact

- `app/ui/chat-page.tsx` — add ~5 lines to the message meta section
- `app/ui/agent-page.tsx` — add ~5 lines to the message meta section
