<!-- Context: project-intelligence/admin-routes/shared-components | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# Admin Shared Components

**Purpose**: Reusable components extracted from admin index pages. Import from `app/ui/`.

---

## AdminPageHeader

Renders a page title and description using admin-specific typography tokens.

**Source**: `bookstore/app/ui/admin-page-header.tsx`

```typescript
import { AdminPageHeader } from '../../ui/admin-page-header.tsx'

<AdminPageHeader
  title="Manage Books"
  description="View and manage books in your inventory."
/>
```

**Props**:

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Page heading (h1) |
| `description` | `string` | Subtitle paragraph |

---

## AdminFilterForm

Search input + dropdown filter with preserved sort state. Submits via GET to `baseUrl`.

**Source**: `bookstore/app/ui/admin-filter-form.tsx`

```typescript
import { AdminFilterForm } from '../../ui/admin-filter-form.tsx'

<AdminFilterForm
  baseUrl={baseUrl}
  sortColumn={sort.column ?? 'id'}
  sortDirection={sort.direction}
  filters={filters}
  searchPlaceholder="Search title or author..."
  searchAriaLabel="Search books"
  filterName="genre"
  filterAriaLabel="Filter by genre"
  filterOptions={[
    { value: 'Fiction', label: 'Fiction' },
    { value: 'Non-Fiction', label: 'Non-Fiction' },
  ]}
/>
```

**Props**:

| Prop | Type | Description |
|------|------|-------------|
| `baseUrl` | `string` | Form action URL |
| `sortColumn` | `string \| null` | Current sort column (for hidden input) |
| `sortDirection` | `string` | Current sort direction |
| `filters` | `FilterState` | Current filter values |
| `searchPlaceholder` | `string` | Placeholder text for search input |
| `searchAriaLabel` | `string` | Accessibility label for search input |
| `filterName` | `string` | Name attribute for select element |
| `filterAriaLabel` | `string` | Accessibility label for select |
| `filterOptions` | `Array<{value, label}>` | Options for dropdown filter |

---

## AdminTableCard

Wrapper for data tables that provides item count, zebra-striped table, empty state, and pagination.

**Source**: `bookstore/app/ui/admin-table-card.tsx`

```typescript
import { AdminTableCard } from '../../ui/admin-table-card.tsx'

<AdminTableCard
  page={page}
  totalPages={totalPages}
  total={total}
  sort={sort}
  filters={filters}
  baseUrl={baseUrl}
  itemName="books"
>
  <thead>
    <tr>
      <SortableTH {...sortProps} column="id" label="ID" />
      <SortableTH {...sortProps} column="title" label="Title" />
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>{/* rows */}</tbody>
</AdminTableCard>
```

**Props**:

| Prop | Type | Description |
|------|------|-------------|
| `children` | `RemixNode` | Table content (`<thead>` + `<tbody>`) |
| `page` | `number` | Current page number |
| `totalPages` | `number` | Total number of pages |
| `total` | `number` | Total item count |
| `sort` | `SortState` | Current sort state |
| `filters` | `FilterState` | Current filter state |
| `baseUrl` | `string` | Base URL for pagination links |
| `itemName` | `string` | Noun for count text and empty state |

---

## Badge

Semantic status badge with color-coded variants.

**Source**: `bookstore/app/ui/badge.tsx`

```typescript
import { Badge } from '../../ui/badge.tsx'

<Badge variant="info">admin</Badge>
<Badge variant="success">active</Badge>
<Badge variant="warning">pending</Badge>
<Badge variant="danger">banned</Badge>
```

**Props**:

| Prop | Type | Description |
|------|------|-------------|
| `variant` | `'info' \| 'success' \| 'warning' \| 'danger'` | Color scheme |
| `children` | `string` | Badge text |

---

## SortableTH

Table header cell with sort toggle links. Preserves filters when sorting.

**Source**: `bookstore/app/ui/table.tsx`

```typescript
import { SortableTH } from '../../ui/table.tsx'

<SortableTH
  column="name"
  label="Name"
  sort={sort}
  filters={filters}
  baseUrl={baseUrl}
  width="150px"
/>
```

---

## Related

- **Styling**: `styling-guide.md`
- **Migration**: `migration-checklist.md`
- **Tokens**: `bookstore/app/ui/tokens.ts`
- **Utils**: `bookstore/app/controllers/admin/utils.ts`
