# Admin Page Duplication Issue

**Status**: Identified | **Priority**: HIGH | **Impact**: -200 lines duplicate

## Problem

Admin list pages (`index.tsx`, `courses-page.tsx`) share 70% identical structure but are implemented separately.

### Shared Structure

```tsx
<div class="page">
  <div class="page-header">
    <h1>{title}</h1>
    <a>+ Create New</a>
  </div>
  {items.length === 0 ? (
    <EmptyState />
  ) : (
    <>
      <Table>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>...</tr>
          ))}
        </tbody>
      </Table>
      <Pagination />
    </>
  )}
</div>
```

### Files Affected

| File               | Lines | Status        |
| ------------------ | ----- | ------------- |
| `index.tsx`        | 316   | ⚠️ Over limit |
| `courses-page.tsx` | 351   | ⚠️ Over limit |
| `users-page.tsx`   | 123   | ✅ OK         |

## Solution

Use `ResourceListPage` component from `admin-table.tsx`:

```tsx
<ResourceListPage
  resourceName="Courses"
  items={courses}
  columns={courseColumns}
  currentPage={currentPage}
  hasMore={hasMore}
  baseUrl={routes.admin.courses.index.href()}
/>
```

## Refactoring Status

- ✅ `ResourceListPage` component exists in `admin-table.tsx`
- ❌ Pages still use inline table + pagination HTML
- ⚠️ `Pagination` component exists but unused

## Reference

`app/admin/admin-table.tsx` - `ResourceListPage`, `Pagination` components

**Note**: Updated to use `hasMore` for cursor-based pagination. See `development/remix3/guides/pagination.md`.
