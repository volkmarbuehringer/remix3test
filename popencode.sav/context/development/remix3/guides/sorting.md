# Guide: Sorting

**Core Idea**: Column sorting with URL state for shareable/bookmarkable pages.

## Key Points

- **URL state**: Sort in `?sort=column&dir=asc`
- **Default**: Resource-specific (courses: `created_at desc`, calendar: `start_time asc`)
- **Toggle**: Same column toggles direction, new column starts at `asc`
- **Preserve**: All links must preserve sort params

## Quick Example

```typescript
// Parse from URL
let sort = url.searchParams.get('sort') ?? 'created_at'
let dir = url.searchParams.get('dir') ?? 'desc'

// Toggle logic
const newDir = sort === column && dir === 'asc' ? 'desc' : 'asc'

// Links preserve state
<a href={`?page=${page}&sort=${column}&dir=${dir}`}>
```

## Controller

```typescript
async index({ db, url }) {
  let sort = parseSort(url)
  let items = await db.findMany(books, { orderBy: [[sort.column, sort.direction]] })
  return { items, sort }
}
```

**Reference**: `.opencode/context/development/remix3/guides/sorting.md`