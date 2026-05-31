<!-- Context: development/remix3/guides/pagination-bar-rmx-target | Priority: high | Version: 1.0 | Updated: 2026-05-07 -->

# Guide: Pagination Bar with rmx-target Frame Navigation

**Core Idea**: Server-rendered pagination controls that navigate within a named Frame using `rmx-target` attribute, avoiding full page reloads and preserving client-side state.

## Why rmx-target Instead of Nested Frame

The `pagination-frames.md` approach uses a nested `<Frame>` that navigates independently. The `rmx-target` approach instead uses server-rendered `<a>` links with the `rmx-target` attribute, which tells Remix to update a specific named Frame without navigating the parent page.

| Approach | Use Case |
|----------|----------|
| Nested `<Frame>` | Pagination is the frame's own navigation |
| `rmx-target` links | Pagination inside a server-rendered list that targets a parent frame |

## Pattern

```tsx
function PaginationBar({
  page,
  hasMore,
  filter,
  frameTarget = 'admin-content',
}: {
  page: number
  hasMore: boolean
  filter?: string
  frameTarget?: string
}) {
  // Only show when there are multiple pages
  if (page <= 1 && !hasMore) return null

  function pageHref(p: number): string {
    let params = new URLSearchParams({ page: String(p) })
    if (filter) params.set('filter', filter)
    return '?' + params.toString()
  }

  return (
    <nav aria-label="Pagination">
      {/* Previous — disabled state uses <span> instead of <a> */}
      {page > 1 ? (
        <a href={pageHref(page - 1)} rmx-target={frameTarget}>
          ← Previous
        </a>
      ) : (
        <span style={{ opacity: 0.5, pointerEvents: 'none' }}>
          ← Previous
        </span>
      )}

      <span>Page {page}</span>

      {/* Next */}
      {hasMore ? (
        <a href={pageHref(page + 1)} rmx-target={frameTarget}>
          Next →
        </a>
      ) : (
        <span style={{ opacity: 0.5, pointerEvents: 'none' }}>
          Next →
        </span>
      )}
    </nav>
  )
}
```

## Key Techniques

### 1. `rmx-target` Attribute
Add `rmx-target={frameTarget}` to each `<a>` tag. When clicked, Remix intercepts the navigation and updates only the Frame with that `name`, leaving the rest of the page intact.

```tsx
<a href="?page=2" rmx-target="admin-content">Next →</a>
```

### 2. Disabled State with `<span>` (Not `<a>`)
When there's no previous/next page, render a `<span>` instead of an `<a>` tag. This ensures:
- No clickable link (no `href`, no pointer cursor)
- Visual distinction via CSS (opacity, pointer-events)
- No `rmx-target` — the span won't trigger frame navigation

```tsx
// Previous disabled — no href, no rmx-target, just visual
<span style={{ opacity: 0.5, pointerEvents: 'none' }}>
  ← Previous
</span>
```

### 3. Conditional Rendering
Show the pagination bar only when there are pages to navigate:

```tsx
if (page <= 1 && !hasMore) return null
```

### 4. Filter Preservation
When a filter is active, include it in pagination URLs:

```tsx
function pageHref(p: number): string {
  let params = new URLSearchParams({ page: String(p) })
  if (filter) params.set('filter', filter)
  return '?' + params.toString()
}
```

When submitting a new search via a `GET` form, the page naturally resets to 1 (no `page` param). The "Clear filter" link goes to the base URL without any params.

### 5. Accessible Navigation Landmark
Wrap in `<nav aria-label="Pagination">` for screen reader support.

## Controller Integration

```typescript
// Controller returns pagination state
async index({ url }) {
  let page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  let filter = url.searchParams.get('filter') || ''
  let offset = (page - 1) * PAGE_SIZE

  // Fetch PAGE_SIZE + 1 for hasMore detection
  let items = await db.findMany({
    where: filter ? { name: { contains: filter } } : undefined,
    take: PAGE_SIZE + 1,
    skip: offset,
  })

  let hasMore = items.length > PAGE_SIZE
  items = items.slice(0, PAGE_SIZE)

  return { items, page, hasMore, filter }
}
```

## Complete Example

```tsx
// In an admin layout controller
import { Frame } from 'remix/ui'

// Parent page with named frame
function AdminLayout() {
  return (
    <div>
      <aside>{/* sidebar */}</aside>
      <main>
        <Frame name="admin-content" src="/admin/lists" />
      </main>
    </div>
  )
}

// In the /admin/lists controller
function AdminListsPage({ items, page, hasMore, filter }) {
  return (
    <div id="admin-content">
      <h2>Items</h2>
      <table>{/* items */}</table>

      <PaginationBar
        page={page}
        hasMore={hasMore}
        filter={filter}
        frameTarget="admin-content"
      />
    </div>
  )
}
```

## Related

- `guides/pagination.md` — General pagination patterns (offset, page params)
- `guides/pagination-frames.md` — Pagination with nested Frame approach
- `guides/frame-navigation-patterns.md` — Frame detection and rmx-target mechanics
- `guides/manual-fetch-patterns.md` — Alternative: manual fetch for pagination
- `guides/filtering.md` — Combined filter + pagination + sort
- `guides/admin-params-pattern.md` — URL param preservation across admin actions
- `ui/lookup/navigation.md` — `rmx-target` attribute reference
- `errors/frame-programmatic-navigation.md` — rmx-target limitations with programmatic clicks

## Codebase References

- `demos/frame-navigation/` — Frame navigation demo showing rmx-target and named frames
- `my_app/app/actions/admin/lists/controller.tsx` — Admin lists with pagination + rmx-target (my_app)
