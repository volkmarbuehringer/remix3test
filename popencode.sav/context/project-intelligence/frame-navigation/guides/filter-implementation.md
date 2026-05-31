<!-- Context: frame-navigation/guides | Priority: high | Version: 1.0 | Updated: 2026-03-21 -->

# Filter Implementation Guide

Step-by-step for adding filters to a split controller.

## Step 1: Define Filter State (admin-utils.ts)

```typescript
export interface FilterState {
  q?: string
  type?: string
  read?: string
  category?: string
  difficulty?: string
}
```

## Step 2: Add parseFilters (admin-utils.ts)

```typescript
export function parseFilters(url: URL): FilterState {
  return {
    q: url.searchParams.get('q') || undefined,
    type: url.searchParams.get('type') || undefined,
    read: url.searchParams.get('read') || undefined,
  }
}
```

## Step 3: Add buildFilterWhere to CRUDConfig

In controller-utils.ts, extend `CRUDConfig`:

```typescript
export interface CRUDConfig {
  // ... existing fields
  parseFilters?: (url: URL) => Record<string, string | undefined>
  buildFilterWhere?: (filters: Record<string, string | undefined>) => unknown[]
}
```

## Step 4: Configure in Controller

```typescript
import { ilike, eq, or } from 'remix/data-table'

export let notificationsActions = {
  actions: buildCRUDActions({
    // ... existing config
    parseFilters: (url: URL) => ({
      q: url.searchParams.get('q') || undefined,
      type: url.searchParams.get('type') || undefined,
      read: url.searchParams.get('read') || undefined,
    }),
    buildFilterWhere: (filters) => {
      let predicates: any[] = []

      if (filters.q) {
        predicates.push(
          or(
            ilike(notifications.title, `%${filters.q}%`),
            ilike(notifications.message, `%${filters.q}%`),
          ),
        )
      }
      if (filters.type) {
        predicates.push(eq(notifications.type, filters.type))
      }
      if (filters.read !== undefined) {
        predicates.push(eq(notifications.read, filters.read === 'true'))
      }

      return predicates
    },
  }),
}
```

## Step 5: Pass Filters to List Page

```typescript
renderListPage: ({
  items,
  currentPage,
  hasMore,  // Use hasMore instead of totalPages
  sort,
  filters, // ← Available from buildCRUDActions
}) => (
  <AdminIndexPage
    mode="list"
    notifications={items}
    filters={filters} // ← Pass to component
    // ...
  />
)
```

## Step 6: Add Filter Form (TSX)

```tsx
<form method="GET" action={routes.admin.notifications.index.href()}>
  <input type="search" name="q" defaultValue={filters?.q} placeholder="Search..." />
  <select name="type" defaultValue={filters?.type || ''}>
    <option value="">All Types</option>
    <option value="announcement">Announcement</option>
    <option value="course">Course</option>
  </select>
  <select name="read" defaultValue={filters?.read || ''}>
    <option value="">All Status</option>
    <option value="true">Read</option>
    <option value="false">Unread</option>
  </select>
  <button type="submit">Filter</button>
  {/* Clear link when filters active */}
  {(filters?.q || filters?.type) && <a href={routes.admin.notifications.index.href()}>Clear</a>}
</form>
```

## Step 7: CSS (public/admin.css)

```css
.filter-section {
  margin-bottom: 1rem;
}
.filter-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}
.filter-search {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-default);
  border-radius: 6px;
}
.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  cursor: pointer;
}
```

## Reference

- `concepts/filtering.md` - Filter pattern overview
- `lookup/filter-utilities.md` - Utility functions
- `errors/filter-bugs.md` - Common mistakes
