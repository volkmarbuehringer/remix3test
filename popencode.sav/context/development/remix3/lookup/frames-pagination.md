<!-- Context: remix3/lookup/frames-pagination | Priority: high | Version: 1.0 | Updated: 2026-04-24 -->

# Lookup: Frame-Based Pagination with Client Entries

**Core Concept**: Combine server-side pagination with client-side frame navigation. The fragment endpoint handles page data via URL query params, while a `clientEntry` component provides interactive pagination buttons that reload the frame without full page navigation.

**Key Points**:
- Fragment endpoints parse `?page` query param for server-side pagination with `limit`/`offset`
- `clientEntry` components inside frames can access `handle.frame.src` to modify and reload
- Frame must have a `name` attribute for targeting from client entries
- State (cart, etc.) persists because parent page doesn't re-render
- Client entry first arg MUST be `import.meta.url`, not hardcoded path string

**Quick Example**:
```tsx
// app/assets/pagination.tsx
import { clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'

type PaginationProps = {
  currentPage: number
  totalPages: number
}

export const Pagination = clientEntry(import.meta.url, function Pagination(handle: Handle<PaginationProps>) {
  return () => {
    let { currentPage, totalPages } = handle.props
    let goToPage = (page: number) => {
      let url = new URL(handle.frame.src, window.location.href)
      url.searchParams.set('page', String(page))
      handle.frame.src = url.toString()
      handle.frame.reload()
    }
    return (
      <div>
        <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
          Previous
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>
          Next
        </button>
      </div>
    )
  }
})

// Fragment controller
async books1Grid({ get, url }) {
  let page = parseInt(url.searchParams.get('page') ?? '1', 10)
  let pageSize = 6
  let offset = (page - 1) * pageSize
  let total = await db.count(books)
  let books = await db.findMany(books, { orderBy: ['id', 'asc'], limit: pageSize, offset })
  return renderFragment(<div>
    <Pagination currentPage={page} totalPages={Math.ceil(total / pageSize)} />
    <div class="grid">{books.map(b => <h3>{b.title}</h3>)}</div>
  </div>)
}

// Page with frame
<Frame name="books1-grid" src={routes.fragments.books1Grid.href() + '?page=1'} fallback={<p>Loading...</p>} />
```

**Key Files**:
- `bookstore/app/controllers/fragments/controller.tsx` - fragment with pagination logic
- `bookstore/app/assets/pagination.tsx` - Pagination client entry
- `bookstore/app/controllers/books1/index-page.tsx` - Frame page
- `bookstore/app/assets/refresh-button.tsx` - RefreshButton client entry (template)

**Reference**: `packages/component/docs/frames.md`, `packages/component/docs/hydration.md`

**Related**: `guides/pagination-frames.md`, `lookup/hydration-frames-navigation.md`