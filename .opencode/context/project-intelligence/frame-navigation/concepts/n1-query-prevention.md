<!-- Context: frame-navigation/concepts/n1-query-prevention | Priority: critical | Version: 1.0 | Updated: 2026-03-23 -->

# N+1 Query Prevention

Batch query pattern to avoid N+1 when enriching lists with related data.

## Problem

Loop-based queries cause N+1:

```typescript
// BAD: N+1 queries
for (let notif of items) {
  let user = await db.findOne(users, { where: { id: notif.user_id } })
  notif.userEmail = user?.email || '-'
}
```

## Solution

Batch query with `inList`:

```typescript
// GOOD: 2 queries total
let userIds = [...new Set(items.map((n) => n.user_id))]
let userRows = await db.findMany(users, {
  where: inList(users.id, userIds),
})
let userById = new Map(userRows.map((u) => [u.id, u]))
return items.map((notif) => ({
  ...notif,
  userEmail: userById.get(notif.user_id)?.email || '-',
}))
```

## Key Functions

| Step        | Code                                              |
| ----------- | ------------------------------------------------- |
| Collect IDs | `[...new Set(items.map(n => n.user_id))]`         |
| Batch query | `db.findMany(..., { where: inList(field, ids) })` |
| Build map   | `new Map(rows.map(r => [r.id, r]))`               |
| Enrich      | `items.map(item => ({ ...item, ... }))`           |

## Extraction Pattern

For testability, extract enrichment to separate file:

```
app/admin/
├── notifications-controller.tsx  # Uses enrichNotifications
└── notifications-enrich.ts      # Testable function
```

```typescript
// notifications-enrich.ts
export async function enrichNotifications(db: any, items: Notification[]) {
  if (items.length === 0) return []
  let userIds = [...new Set(items.map((n) => n.user_id))]
  let userRows = await db.findMany(users, { where: inList(users.id, userIds) })
  let userById = new Map(userRows.map((u) => [u.id, u]))
  return items.map((notif) => ({
    ...notif,
    userEmail: userById.get(notif.user_id)?.email || '-',
  }))
}
```

## Reference

- `demos/frame-navigation/app/admin/notifications-enrich.ts`
- `demos/frame-navigation/app/admin/notifications-controller.tsx`
