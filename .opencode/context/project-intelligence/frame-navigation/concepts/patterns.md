<!-- Context: frame-navigation/concepts | Priority: high | Version: 1.3 | Updated: 2026-03-21 -->

# Frame Navigation Patterns

Split controller architecture with sortable data grids and sort/page preservation.

## Split Controller Pattern

Controllers split into modular files with shared layout renderer via `buildCRUDActions`:

```
app/admin/
├── controller.tsx              # Registers renderLayout
├── notifications-controller.tsx # Uses buildCRUDActions
├── courses-controller.tsx     # Uses buildCRUDActions
└── users-controller.tsx      # Manual (only index+show)
```

### buildCRUDActions Actions

| Action        | Purpose                    |
| ------------- | -------------------------- |
| `index`       | List + pagination          |
| `show`        | Detail view                |
| `new/create`  | Create form + POST         |
| `edit/update` | Edit form + PUT            |
| `destroy`     | DELETE with error handling |

**File**: `app/lib/controller-utils.ts`

## Sorting Pattern

Sort state in URL: `?sort=title&dir=asc&page=2`

### SortState Type

```typescript
interface SortState {
  column: string | null
  direction: 'asc' | 'desc'
}
```

### Key Utilities (`app/lib/admin-utils.ts`)

| Function                             | Purpose                   |
| ------------------------------------ | ------------------------- |
| `parseSort(url)`                     | Extract sort/dir from URL |
| `buildSortUrl(base, col, sort)`      | Header click (toggle dir) |
| `buildSortPageUrl(base, page, sort)` | Pagination with sort      |
| `buildBackUrl(base, page, sort)`     | Cancel/back links         |
| `buildEditLinkParams(page, sort)`    | Edit link query string    |

### Memoization

`buildSortUrl` and `buildSortPageUrl` use module-level caches:

```typescript
const sortUrlCache = createMemoCache()
const sortPageUrlCache = createMemoCache()
```

Cache keys include all params to ensure correct results.

### Sort-Preserving Edit Links

```typescript
let params = buildEditLinkParams(currentPage, sort)
// "?page=2&sort=title&dir=asc"
<a href={`/edit?${params}`}>Edit</a>
```

### POST Form Preservation

**Critical**: POST forms need hidden fields since POST drops URL query params:

```html
<form method="POST">
  <input type="hidden" name="page" value="2" />
  <input type="hidden" name="sort" value="title" />
  <input type="hidden" name="dir" value="asc" />
</form>
```

Controller reads from formData: `formData.get('sort')?.toString()`

## Remix Curried Component Pattern

Components use curried factory pattern - see `concepts/remix-curried-components.md` for details on why FormHiddenFields extraction was not possible.

## Error Handlers

| Function                                            | Purpose                  |
| --------------------------------------------------- | ------------------------ |
| `handleValidationError(err, url)`                   | Validation errors        |
| `handleDeleteError(err, url, page, msg, sort, dir)` | FK errors + state        |
| `handleCreateUpdateError(err, url, msg)`            | All create/update errors |
| `toastRedirect(url, msg)`                           | Success with toast       |
| `validateFormData(data, rules)`                     | Form validation          |

## Reference

- `app/lib/admin-utils.ts` - All utilities
- `app/lib/controller-utils.ts` - buildCRUDActions
- `app/admin/admin-table.tsx` - AdminTable, Pagination, ResourceListPage
- `concepts/remix-curried-components.md` - Curried component pattern
- `guides/sort-page-preservation.md` - POST form pattern
- `lookup/sorting-utilities.md` - Function reference
