<!-- Context: frame-navigation/lookup | Priority: high | Version: 1.1 | Updated: 2026-03-21 -->

# Sorting Utilities Reference

Quick reference for `app/lib/admin-utils.ts`.

## Types

```typescript
type SortState = { column: string | null; direction: 'asc' | 'desc' }
```

## URL Building

| Function                                    | Returns  | Use                        |
| ------------------------------------------- | -------- | -------------------------- |
| `buildSortUrl(base, col, sort)`             | `string` | Header click (toggles dir) |
| `buildSortPageUrl(base, page, sort, total)` | `string` | Pagination links           |
| `buildBackUrl(base, page?, sort?)`          | `string` | Cancel/back links          |
| `buildEditLinkParams(page, sort?)`          | `string` | Edit link query            |

### Memoization

`buildSortUrl` and `buildSortPageUrl` use module-level caches:

```typescript
const sortUrlCache = createMemoCache() // Key: baseUrl|col|currentSort.column|currentSort.direction
const sortPageUrlCache = createMemoCache() // Key: baseUrl|page|currentSort.column|currentSort.direction|hasMore
```

**Note**: Use `hasMore` instead of `totalPages` for cursor-based pagination. See `development/remix3/guides/pagination.md`.

Other functions (`buildBackUrl`, `buildEditLinkParams`) are not memoized but are simple URL building.

### Examples

```typescript
// Toggle direction on same column
buildSortUrl('/users', 'name', { column: 'email', dir: 'asc' })
// → "/users?sort=name&dir=asc"

// Sort preserved in pagination
buildSortPageUrl('/users', 3, { column: 'name', dir: 'asc' }, 10)
// → "/users?page=3&sort=name&dir=asc"

// Cancel link
buildBackUrl('/users', '2', { column: 'name', dir: 'asc' })
// → "/users?page=2&sort=name&dir=asc"

// Edit link query
buildEditLinkParams(2, { column: 'name', dir: 'asc' })
// → "page=2&sort=name&dir=asc"
```

## Parsing

| Function           | Returns              |
| ------------------ | -------------------- |
| `parseSort(url)`   | `SortState`          |
| `parsePage(url)`   | `number` (default 1) |
| `parseOffset(url)` | `number` (from page) |

## Error Handlers

| Function                  | Signature                                         |
| ------------------------- | ------------------------------------------------- |
| `handleValidationError`   | `(err, url) => Response?`                         |
| `handleDeleteError`       | `(err, url, page, msg?, sort?, dir?) => Response` |
| `handleCreateUpdateError` | `(err, url, msg?) => Response`                    |
| `toastRedirect`           | `(url, msg) => Response`                          |

## Validation

```typescript
validateFormData(data, {
  required: ['title'],
  minLength: { title: 3 },
  maxLength: { title: 100 },
  pattern: { email: /@/ },
  custom: [{ field: 'name', validate: (v) => (v === 'admin' ? 'Reserved' : null) }],
})
```

## Constants

```typescript
import { PAGE_SIZE } from 'admin-utils' // 20
```

## Reference

- `app/lib/admin-utils.ts` - Full implementation
- `concepts/patterns.md` - Sorting pattern overview
- `guides/sort-page-preservation.md` - POST form pattern
