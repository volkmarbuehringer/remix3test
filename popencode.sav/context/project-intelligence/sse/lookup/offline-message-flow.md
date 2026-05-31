<!-- Context: sse/lookup/offline-message-flow | Priority: high | Version: 1.0 | Updated: 2026-03-24 -->

# Offline Message Flow

How messages are stored, delivered, and deleted when recipients are offline.

## Flow Overview

```
User A sends message ─► Recipient B offline?
├─ YES (B offline)
│   └─► Store in SQLite ─► B reconnects ─► Deliver via SSE ─► B decrypts ─► ACK ─► Delete from DB
└─ NO (B online)
    └─► Broadcast directly via SSE
```

## Storage (Sender → Server)

```typescript
// When sending to offline user
if (!recipientIsOnline) {
  saveMessage(senderId, recipientId, messageText, encrypted)
  return Response.json({ status: 'stored', recipient: recipient })
}
```

### Database Schema

```typescript
db.exec(`
  CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    encrypted INTEGER DEFAULT 0,  -- Encryption flag
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT
  )
`)
```

## Delivery (Server → Recipient)

```typescript
// In SSE stream start callback
let storedMessages = getMessages(userId, 100)
storedMessages.forEach((msg) => {
  let data = JSON.stringify({
    from: senderName,
    message: msg.content,
    encrypted: msg.encrypted,
    msgId: String(msg.id), // For acknowledgment
    isOfflineMessage: true,
  })
  controller.enqueue(new TextEncoder().encode(`event: offline\ndata: ${data}\n\n`))
})
```

## Client Processing

```typescript
eventSource.addEventListener('offline', async (e) => {
  let data = JSON.parse(e.data)

  // Decrypt if encrypted and key available
  if (data.encrypted && encryptionKey) {
    data.message = await decrypt(data.message, encryptionKey)
    // Acknowledge successful decryption
    await fetch(`/messages/ack?ids=${data.msgId}`, { method: 'POST' })
  } else if (data.encrypted) {
    data.message = '[encrypted - no key]'
    // DO NOT acknowledge - message stays in DB
  }

  displayMessage(data.message, data.from)
})
```

## Deletion (ACK Endpoint)

```typescript
// POST /messages/ack?ids=1,2,3
router.post('ackMessages', (context) => {
  let ids = context.url.searchParams.get('ids')?.split(',') || []
  ids.forEach((id) => {
    if (deleteMessage(parseInt(id))) {
      deleted++
    }
  })
  return Response.json({ deleted })
})
```

## Key Design Decisions

| Decision                 | Rationale                                 |
| ------------------------ | ----------------------------------------- |
| **Store encrypted**      | Server never sees plaintext               |
| **Client ACK**           | Only delete after successful decryption   |
| **msgId tracking**       | Client confirms which messages to delete  |
| **Persistent until ACK** | Message stays in DB until client confirms |

## Message States

```
┌──────────┐    send     ┌──────────┐    reconnect    ┌──────────┐
│  sender  │────────────►│   DB     │────────────────►│ recipient│
└──────────┘             └──────────┘                 └──────────┘
                              │                             │
                              │                       decrypt + ACK
                              │◄────────────────────────────────┘
                              │           delete
                              ▼
                         ┌──────────┐
                         │  deleted │
                         └──────────┘
```

## Error Handling

| Scenario             | Behavior                                              |
| -------------------- | ----------------------------------------------------- |
| Decrypt fails        | Message stays in DB, user sees error                  |
| No key               | Message stays in DB, user sees "[encrypted - no key]" |
| Network error on ACK | Message stays in DB, redelivered on reconnect         |
| Multiple reconnects  | Same messages delivered again until ACK               |

## 📂 Codebase References

**Router**: `demos/sse/app/router.tsx` (offline delivery)
**Database**: `demos/sse/app/db.ts` (saveMessage, getMessages)
**Client**: `demos/sse/app/assets/message-stream.tsx` (offline handler)

## Related

- `concepts/e2e-encryption.md` - E2E encryption concept
- `errors/sse-encryption-errors.md` - Encryption troubleshooting
