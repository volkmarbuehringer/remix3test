<!-- Context: bookstore-demo/concepts | Priority: high | Version: 1.2 | Updated: 2026-04-12 -->

# JSONB Database Patterns

**Core Idea**: SQLite JSONB columns store structured data efficiently with SQL patterns for appending and querying. Use raw SQL with `||` operator for array concatenation, and `::text` cast for searching inside JSON.

---

## Key Points

- **Column type**: `jsonb NOT NULL DEFAULT '[]'::jsonb`
- **Append to array**: `UPDATE table SET column = column || ${jsonString}::jsonb`
- **JSON returns as object**: Not string—handle both cases when reading
- **String IDs with `generateId()`**: Use TEXT, generate IDs with 'ai' library
- **Timestamps**: Use BIGINT for JavaScript Date.now() compatibility
- **Timing data**: Store elapsed time in message JSON with `elapsed` field (optional)
- **Searching**: Use `conversation::text` cast to search inside JSON

---

## Quick Example

```ts
// Migration - TEXT id with generateId() from 'ai'
await schema.plan(`
  CREATE TABLE chatlog (
    id TEXT PRIMARY KEY,
    conversation jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
  )
`)

// Create conversation with string ID
import { generateId } from 'ai'
let id = generateId()

await db.exec(sql`
  INSERT INTO chatlog (id, conversation, created_at, updated_at)
  VALUES (${id}, '[]', ${now}, ${now})
`)

// Append to JSONB array
await db.exec(sql`
  UPDATE chatlog
  SET conversation = conversation || ${messageJson}::jsonb
  WHERE id = ${id}
`)

// Read - handle both object and string
let conv = row.conversation
if (typeof conv === 'string') {
  convArray = JSON.parse(conv)
} else if (Array.isArray(conv)) {
  convArray = conv
}
```

---

## Common Errors Fixed

- **Empty array validation error**: Use raw SQL instead of schema API
- **JSON.parse on JSONB**: Column returns as object, not string—handle both cases
- **Doubled messages**: Save once with complete exchange, not separate user/assistant

---

## Codebase References

- `bookstore/db/migrations/20260412000000_create_chatlog_table.ts` - Migration with TEXT id
- `bookstore/app/lib/chatlog.ts` - Service with JSONB append + generateId()

---

## Related

- [chat-log-pattern.md](chat-log-pattern.md) - Client-side chat pattern
- [chat-conversation-tracking.md](chat-conversation-tracking.md) - Server-side conversation tracking
- `../development/remix3/guides/postgresql-migration.md` - PostgreSQL migration patterns