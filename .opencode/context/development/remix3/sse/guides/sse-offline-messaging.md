<!-- Context: development/remix3/guides/sse-offline-messaging | Priority: medium | Version: 1.0 | Updated: 2026-04-11 -->

# SSE Offline Messaging

Messages to offline recipients stored in SQLite and delivered on reconnect.

## Database Schema

```typescript
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    encrypted INTEGER DEFAULT 0,
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT
  )
`)
```

## Store Messages for Offline Users

```typescript
// When sending a direct message to an offline user
if (!recipientIsOnline) {
  saveMessage(senderId, recipientId, messageText, encrypted)
  return Response.json({ status: 'stored', recipient: recipient })
}
```

## Deliver Offline Messages on Connect

```typescript
// In SSE stream start callback
let storedMessages = getMessages(userId, 100)
storedMessages.forEach((msg) => {
  let data = JSON.stringify({
    from: senderName,
    message: msg.content,
    encrypted: msg.encrypted === 1,
    msgId: String(msg.id),
    isOfflineMessage: true,
  })
  controller.enqueue(new TextEncoder().encode(`event: offline\ndata: ${data}\n\n`))
})
```

## Client-Controlled Deletion

Messages deleted after client confirms successful decryption:

```typescript
// POST /messages/ack?ids=1,2,3
router.post('ackMessages', (context) => {
  let ids = context.url.searchParams.get('ids')?.split(',') || []
  ids.forEach((id) => deleteMessage(parseInt(id)))
  return Response.json({ deleted: ids.length })
})
```

## Related

- `sse-implementation.md` - Core SSE implementation
- `guides/rate-limiting.md` - Rate limiting
