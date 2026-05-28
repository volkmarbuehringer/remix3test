<!-- Context: development/remix3/guides/grid-links | Priority: medium | Version: 1.0 | Updated: 2026-03-22 -->

# Links in Grids

Creating clickable links in data grids that navigate to related resources.

## Pattern

Use `routes.{resource}.show.href({ id })` to create links:

```typescript
<td data-label="Order ID">
  <a href={routes.orders.show.href({ orderId: item.order_id })}>
    #{item.order_id}
  </a>
</td>
```

## Showing Related Data via Joins

Use belongsTo relationships and nested `with` clauses:

```typescript
// schema.ts
export const userForOrder = belongsTo(orders, users)

// Controller
let items = await db.findMany(orderItems, {
  with: { user: userForOrder },
})
```

Display with null check:

```tsx
{
  item.order?.user ? (
    <a href={routes.users.show.href({ userId: item.order.user.id })}>{item.order.user.name}</a>
  ) : (
    '-'
  )
}
```

## Grid Stability (Prevent Column Jumping)

### Fixed Table Layout

```tsx
<table style={{ tableLayout: 'fixed', width: '100%' }}>
  <thead>
    <tr>
      <th style={{ width: '20%' }}>Name</th>
      <th style={{ width: '30%' }}>Email</th>
      <th style={{ width: '15%' }}>Actions</th>
    </tr>
  </thead>
</table>
```

### Truncate Long Content

```tsx
<td
  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
  title={item.name}
>
  {item.name}
</td>
```

## Key Points

- Always link to related resources for navigation
- Use belongsTo relationships for efficient joins
- Fixed table layout prevents column jumping
- Truncate long content with ellipsis but show full value in title attribute
