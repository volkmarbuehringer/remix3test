---
id: frames-books1-pagination
title: Frame-based Pagination — /books1 Route
category: project-intelligence/frames
type: guide
version: 1.0.0
author: opencode
tags: [frame, pagination, server-side, books1]
description: Documents the /books1 route implementation using Frame-based server-side pagination with client-side navigation.
codebase: bookstore
dependencies: []
---

# Frame-based Pagination — /books1 Route

> **Tip**: This is the **simpler pattern** compared to [nested-frames.md](./nested-frames.md). Use this for straightforward pagination without nested Frames.

## Overview

The `/books1` route demonstrates **Frame-based server-side pagination** with client-side navigation. It renders a simple book grid with titles using offset-based pagination.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  /books1                    Page Route                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Frame (name="books1-grid")                         │   │
│  │  src: /fragments/books1-grid?page=1              │   │
│  │  fallback: <p>Loading books...</p>              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  /fragments/books1-grid         Fragment Handler             │
│  Server-side:                                         │
│  - Reads page from URL searchParams                      │
│  - Uses db.findMany with limit/offset                  │
│  - Renders Pagination + BookGrid                      │
└─────────────────────────────────────────────────────────────┘
```

## Route Configuration

**File:** `bookstore/app/routes.ts`

```typescript
books1: '/books1',
fragments: route('fragments', {
  books1Grid: get('/books1-grid'),
}),
```

**File:** `bookstore/app/router.ts`

```typescript
router.get(routes.books1, books1)
router.map(routes.fragments, fragmentsController)
```

## Route Handler

**File:** `bookstore/app/controllers/books1/controller.tsx`

```typescript
export const books1: BuildAction<'GET', typeof routes.books1> = {
  async handler() {
    return render(<IndexPage />)
  },
}
```

## Index Page with Frame

**File:** `bookstore/app/controllers/books1/index-page.tsx`

```typescript
export function IndexPage() {
  return () => (
    <Layout title="Books (v1)">
      <h1>Books</h1>
      <Frame
        name="books1-grid"
        src={routes.fragments.books1Grid.href() + '?page=1'}
        fallback={<p>Loading books...</p>}
      />
    </Layout>
  )
}
```

**Key Points:**
- `Frame` renders `/fragments/books1-grid?page=1` server-side
- Fallback shows "Loading books..." while Frame loads (non-blocking)
- Frame name enables hydration and reuse

## Fragment Handler (Server-side)

**File:** `bookstore/app/controllers/fragments/controller.tsx`

```typescript
async books1Grid({ get, url }) {
  let db = get(Database)

  // Parse page from URL
  let pageParam = url.searchParams.get('page')
  let page = pageParam ? parseInt(pageParam, 10) : 1
  if (isNaN(page) || page < 1) page = 1

  // Pagination config
  let pageSize = 6
  let offset = (page - 1) * pageSize

  // Get total count for pagination bounds
  let total = await db.count(books)
  let totalPages = Math.max(1, Math.ceil(total / pageSize))
  page = Math.min(page, totalPages)

  // Offset-based fetch with limit/offset
  let allBooks = await db.findMany(books, {
    orderBy: ['id', 'asc'],
    limit: pageSize,
    offset,
  })

  let cart = getCurrentCart()

  return renderFragment(
    <div>
      <Pagination currentPage={page} totalPages={totalPages} />
      <div class="grid">
        {allBooks.map((book) => {
          let inCart = cart.items.some((item) => item.bookId === book.id)
          return <BookCard book={book} inCart={inCart} />
        })}
      </div>
    </div>,
  )
},
```

**Key Points:**
- **Offset-based pagination:** `offset = (page - 1) * pageSize`
- Uses `db.findMany()` with `limit` and `offset` options
- Clamps page to valid range: `Math.min(page, totalPages)`
- Returns both Pagination component and book grid

## Pagination Component (Client Entry)

**File:** `bookstore/app/assets/pagination.tsx`

```typescript
export const Pagination = clientEntry(
  import.meta.url,
  function Pagination(handle: Handle) {
    return ({ currentPage, totalPages }: Props) => {
      let isFirstPage = currentPage <= 1
      let isLastPage = currentPage >= totalPages

      let goToPage = (page: number) => {
        let url = new URL(handle.frame.src, window.location.href)
        url.searchParams.set('page', String(page))
        handle.frame.src = url.toString()
        handle.frame.reload()
      }

      return (
        <div>
          <button disabled={isFirstPage} onClick={() => goToPage(currentPage - 1)}>
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button disabled={isLastPage} onClick={() => goToPage(currentPage + 1)}>
            Next
          </button>
        </div>
      )
    }
  },
)
```

**Key Points:**
- **Client entry** via `clientEntry()` - hydrates on client
- Uses `handle.frame.reload()` to refresh Frame content
- Updates Frame `src` URL with new page param
- Buttons disabled at first/last page with opacity styling

## Flow Summary

| Step | What Happens |
|------|--------------|
| 1 | User visits `/books1` |
| 2 | Server renders IndexPage with Frame (shows fallback) |
| 3 | Frame loads `/fragments/books1-grid?page=1` server-side |
| 4 | Fragment queries db.findMany(books, {limit:6, offset:0}) |
| 5 | Fragment returns Pagination + BookGrid |
| 6 | User clicks "Next" - client updates Frame src and reloads |
| 7 | Frame loads page 2, server renders with offset=6 |

## Related Files

| File | Purpose |
|------|---------|
| `bookstore/app/routes.ts` | Route definitions |
| `bookstore/app/router.ts` | Router mapping |
| `bookstore/app/controllers/books1/controller.tsx` | /books1 handler |
| `bookstore/app/controllers/books1/index-page.tsx` | IndexPage with Frame |
| `bookstore/app/controllers/fragments/controller.tsx` | books1Grid fragment |
| `bookstore/app/assets/pagination.tsx` | Client entry Pagination |
| `bookstore/app/assets/refresh-button.tsx` | Not currently used |

## See Also

<!-- Removed broken refs to frame-navigation/concepts/frame.md and lookup/pagination-patterns.md (don't exist) -->
- [guides/client-entry-in-paginated-lists.md](./guides/client-entry-in-paginated-lists.md) - Correct pattern for interactive elements in paginated lists
- [errors/stale-props-after-pagination.md](./errors/stale-props-after-pagination.md) - Stale prop bug details