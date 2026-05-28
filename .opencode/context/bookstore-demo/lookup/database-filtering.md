<!-- Context: bookstore-demo/lookup | Priority: high | Version: 1.0 | Updated: 2026-04-10 -->

# Lookup: Database Filtering Patterns

**Purpose**: Use in-memory filtering when DB queries can't express complex conditions.

---

## When to Use In-Memory Filtering

- **Complex string operations** - `.startsWith()`, `.includes()`
- **Length-based filtering** - description length > 100
- **Multi-field conditions** - combination of fields

---

## Pattern: In-Memory Filtering

### Step 1: Fetch All Relevant Data

```typescript
let allBooks = await db.findMany(books, {
  where: { in_stock: true },
})
```

### Step 2: Apply In-Memory Filters

```typescript
let filteredBooks = allBooks.filter((book) => {
  let descLength = book.description ? book.description.length : 0
  let titleNotTest = !book.title.toLowerCase().startsWith('test')
  return descLength > 100 && titleNotTest
})
```

### Step 3: Log for Debugging

```typescript
console.log(
  '[AI Book Search] Filtered from',
  allBooks.length,
  'to',
  filteredBooks.length,
  'books (description length > 100, title not starting with Test)'
)
```

---

## Common Filters

| Filter | Code |
|--------|------|
| Not starting with | `!book.title.toLowerCase().startsWith('test')` |
| Min length | `(book.description?.length ?? 0) > 100` |
| Min price | `book.price >= 10` |
| In stock | `book.in_stock === true` |
| Genre match | `book.genre === 'fiction'` |

---

## Performance Note

In-memory filtering is fine for datasets < 10,000 records. For larger datasets, consider:

1. **Add indexed columns** - `description_length` computed column
2. **SQLite LIKE/ GLOB** - for prefix matching
3. **Full-text search** - FTS5 extension

---

## Related

- concepts/ai-book-search.md
- guides/ai-retry-patterns.md
- .opencode/context/development/remix3/data/guides/data-table-queries.md