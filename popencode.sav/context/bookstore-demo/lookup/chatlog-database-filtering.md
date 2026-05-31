<!-- Context: bookstore-demo/lookup | Priority: critical | Version: 1.0 | Updated: 2026-04-12 -->

# Database SQL Filtering Patterns

Quick reference for filtering SQLite database queries using SQL.

---

## Key Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| LIKE | Text search | `WHERE text ILIKE '%query%'` |
| JSONB | JSON field | `WHERE conversation::text ILIKE '%...%'` |
| Ordering | Sorting | `ORDER BY created_at DESC` |
| Case-insensitive | Search | `ILIKE` (case-insensitive LIKE) |

---

## Quick Examples

### JSONB Field Search

The `conversation` column is JSONB. Search inside it using `::text` cast:

```sql
SELECT * FROM chatlog 
WHERE conversation::text ILIKE '%search_term%'
ORDER BY created_at DESC
```

### Filtering in TypeScript

```typescript
export async function getAllConversations(filter?: string): Promise<ChatLogRow[]> {
  let result
  if (filter && filter.trim()) {
    result = await db.exec(sql`
      SELECT * FROM chatlog 
      WHERE conversation::text ILIKE '%' || ${filter.trim()} || '%'
      ORDER BY created_at DESC
    `)
  } else {
    result = await db.exec(sql`SELECT * FROM chatlog ORDER BY created_at DESC`)
  }

  let rows = getRows(result)
  return rows.map(rowToChatLogRow)
}
```

### Multiple Filters

```typescript
if (filter && filter.trim()) {
  let searchTerm = filter.trim()
  result = await db.exec(sql`
    SELECT * FROM chatlog 
    WHERE 
      conversation::text ILIKE '%' || ${searchTerm} || '%'
      OR id = ${searchTerm}
    ORDER BY created_at DESC
    LIMIT 100
  `)
}
```

---

## Admin Route Integration

In controller, read filter from URL query parameter:

```typescript
export default {
  actions: {
    async index({ url }: { url: URL }) {
      let filter = url.searchParams.get('filter') ?? undefined
      let conversations = await getAllConversations(filter)

      return render(<ChatLogPage conversations={conversations} filter={filter} />)
    },
  },
}
```

### URL-based filter

```
/admin/chatlog?filter=search+term
```

The filter is passed directly to the database function.

---

## Security Note

**ALWAYS** sanitize filter input:

- Use parameterized queries (shown above with `${variable}`)
- Trim whitespace
- Validate format if needed (e.g., ID format)

Never interpolate user input directly into SQL strings.

---

## Codebase References

- `bookstore/app/lib/chatlog.ts` - getAllConversations with filter (lines 103-117)
- `bookstore/app/controllers/admin/chatlog/controller.tsx` - Filter from URL

---

## BIGINT Timestamp Conversion

PostgreSQL BIGINT columns return strings instead of numbers. Convert in row mapper:

```typescript
function rowToChatLogRow(row: Record<string, unknown>): ChatLogRow {
  let createdAt = row.created_at
  let updatedAt = row.updated_at

  // Convert bigint strings to numbers (epoch ms)
  if (typeof createdAt === 'string') {
    createdAt = Number(createdAt)
  }
  if (typeof updatedAt === 'string') {
    updatedAt = Number(updatedAt)
  }

  return {
    id: row.id as string,
    conversation: parseConversationField(row.conversation),
    created_at: createdAt as number,
    updated_at: updatedAt as number,
  }
}
```

**Codebase reference**: `bookstore/app/lib/chatlog.ts` - `rowToChatLogRow`

**Related**: See `postgresql-migration.md` for general `afterRead` pattern for BIGINT conversion.

---

## Related

- [jsonb-database-patterns.md](../concepts/jsonb-database-patterns.md) - JSONB storage
- [admin-chatlog-routes.md](../guides/admin-chatlog-routes.md) - Admin nested routes
- [chat-conversation-tracking.md](../concepts/chat-conversation-tracking.md) - Full conversation pattern