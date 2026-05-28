<!-- Context: development/remix3/examples | Priority: medium | Version: 1.1 | Updated: 2026-04-20 -->

# Example: Admin Dashboard Stats

**Purpose**: Admin dashboard with welcome message, stats cards, and quick actions.

**Codebase Reference**: `bookstore/app/controllers/admin/page.tsx`

**Key Points**:
- Stats fetched via `db.count()` and `db.findMany()` in controller
- Revenue calculated by summing order totals
- Use `toLocaleString()` for numbers, `Intl.NumberFormat` for currency
- Quick actions use auto-fit grid for responsive layout
- User from context with fallback to "Admin"

**Quick Example**:
```typescript
// Stats fetching
async function getDashboardStats(get) {
  let [books, users, orders] = await Promise.all([
    db.count(books), db.count(users), db.count(orders)
  ])
  return { totalBooks: books, totalUsers: users, totalOrders: orders }
}

// Stats card component
<div mix={statsGridStyle}>
  <div mix={statCardStyle}>
    <span mix={statIconStyle}>📚</span>
    <div mix={statContentStyle}>
      <span mix={statLabelStyle}>Total Books</span>
      <span mix={statValueStyle}>{stats.totalBooks}</span>
    </div>
  </div>
</div>
```

**Reference**: `bookstore/app/controllers/admin/controller.tsx`, `bookstore/app/controllers/admin/page.tsx`

**Related**: `guides/layout.md`, `guides/breadcrumbs.md`, `examples/zebra-striping.md`