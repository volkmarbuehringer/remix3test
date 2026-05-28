<!-- Context: frame-navigation | Priority: critical | Version: 2.2 | Updated: 2026-03-27 -->

# Frame Navigation Demo

Production-ready LMS admin demo with Remix frame-based navigation and sortable data grids.

> **For generic Remix 3 patterns**: Use `development/remix3/navigation.md` instead.

## Quick Reference

| Feature                | Status                      |
| ---------------------- | --------------------------- |
| Pagination             | ✅ Compact mode             |
| Sort/Page Preservation | ✅ POST + hidden fields     |
| Memoization            | ✅ Cached URL builders      |
| Editable fields        | ✅ Event delegation         |
| Auth middleware        | ✅ requireAuth/requireAdmin |
| N+1 query fix          | ✅ Batch queries            |
| Dark mode              | ✅ CSS variables            |
| Unit tests             | ✅ 140 passing              |

## File Structure

```
frame-navigation/
├── navigation.md              # This file
├── concepts/                  # 7 files
├── guides/                    # 2 files
├── lookup/                    # 5 files
└── errors/                    # 5 files
```

## Key Patterns

### Sort/Page Preservation (POST forms)

```tsx
<form method="POST">
  <input type="hidden" name="page" value={page} />
  <input type="hidden" name="sort" value={sort?.column} />
  <input type="hidden" name="dir" value={sort?.direction} />
</form>
```

### Event Delegation (Avoid Hydration)

```tsx
// Component: data attributes only
;<span class="editable" data-field={field} data-url={url}>
  {value}
</span>

// Client: delegation handler
document.addEventListener('click', (e) => {
  let el = e.target.closest('.editable')
  if (el) showEditor(el)
})
```

### Memoization

```typescript
const sortUrlCache = createMemoCache()
const buildSortUrl = (col, dir) => sortUrlCache.get(col, dir, () => ...)
```

## Loading Strategy

**Generic Remix patterns**: → `development/remix3/navigation.md`

**Frame-navigation work**:

1. `concepts/patterns.md` - Overview
2. `guides/sort-page-preservation.md` - POST pattern
3. `lookup/sorting-utilities.md` - Function reference
4. `errors/sorting-bugs.md` - Known issues

## Demo Location

```
demos/frame-navigation/
```

## Bugs Fixed

- Auth cookie validation (numeric ID check)
- Admin middleware (requireAdmin)
- N+1 queries (batch with `inList`)
- Hydration loops (event delegation)
- Race condition (DB init)

## Related

- `development/remix3/guides/sorting.md` - Generic sorting
- `development/remix3/guides/filtering.md` - Generic filtering
