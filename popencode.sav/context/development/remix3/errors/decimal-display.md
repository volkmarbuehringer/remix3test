# Error: Decimal Display Shows Invalid Number Format

**Symptom**: Price/total displays as `"99.9900"` instead of formatted currency `"99.99"`

**Cause**: `c.decimal(10, 2)` column returns a **string** from the database, not a JavaScript number.

## Example

```typescript
// Database: orders.total is c.decimal(10, 2)
// ❌ Wrong - shows raw string from DB
<td>{order.total}</td>
// Renders: "99.9900" or "99.99" (string)

// ✅ Correct - convert to number first
<td>{Number(order.total).toFixed(2)}</td>
// Renders: "99.99" (formatted number)
```

## Full Example in Order Row

```tsx
function OrderRow({ order }) {
  return (
    <tr>
      <td>#{order.id}</td>
      <td>${Number(order.total).toFixed(2)}</td>  {/* "99.99" */}
      <td>{order.status}</td>
      <td>{new Date(order.created_at).toLocaleDateString()}</td>
    </tr>
  )
}
```

## Why This Happens

- PostgreSQL DECIMAL/NUMERIC returns as string to preserve precision
- Data table adapter preserves this behavior
- `Number()` converts to numeric, then `.toFixed(2)` formats with 2 decimal places

## Calculation Example

```typescript
// Calculate order total
let orderTotal = order.items.reduce((sum, item) => {
  return sum + Number(item.price) * item.quantity
}, 0)

// Display
<p>Total: ${orderTotal.toFixed(2)}</p>
```

## Related

- `guides/data-table-schema.md` - Column types (c.decimal returns string)
- `lookup/responsive-tables.md` - Table formatting