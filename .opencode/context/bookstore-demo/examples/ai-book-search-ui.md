<!-- Context: bookstore-demo/examples | Priority: high | Version: 1.0 | Updated: 2026-04-10 -->

# Example: AI Book Search Implementation

**Purpose**: Demonstrate complete AI-powered book search with card UI.

---

## Controller Pattern
```typescript
// bookstore/app/controllers/aisearch/controller.tsx
export default {
  actions: {
    async index() { return render(<AISearchPage />) },
    async action({ get }) {
      let formData = get(FormData)
      let parseResult = s.parse(messageSchema, formData)
      if (!parseResult.message) return render(<AISearchResponsePage error="Please enter a search query" />)
      if (parseResult.message.length > 500) return render(<AISearchResponsePage error="Query too long (max 500)" />)
      try {
        let result = await searchBooksAI(parseResult.message, db)
        return render(<AISearchResponsePage books={result.results} />)
      } catch (e) {
        console.error('[AISearch] error:', e)
        return render(<AISearchResponsePage error="An unexpected error occurred. Please try again." />)
      }
    },
  },
}
```

---
## Page Component
```typescript
// bookstore/app/controllers/aisearch/page.tsx
export function AISearchPage() {
  return (
    <div>
      <h1>AI Book Search</h1>
      <form method="post">
        <input name="message" placeholder="What are you looking for?" />
        <button type="submit">Search</button>
      </form>
    </div>
  )
}

export function AISearchResponsePage({ books, error }: Props) {
  if (error) return <div class="error">{error}</div>
  return (
    <div>{books.map((book) => <BookSearchCard key={book.id} book={book} />)}</div>
  )
}
```

---
## Card Component
```typescript
// bookstore/app/ui/book-search-card.tsx
export function BookSearchCard({ book }: { book: BookSearchResult }) {
  return (
    <div class="book-card">
      <img src={book.cover_url} alt={book.title} />
      <div class="book-card-body">
        <h3>{book.title}</h3>
        <p class="author">by {book.author}</p>
        <p class="genre">{book.genre}</p>
        <p class="price">${book.price.toFixed(2)}</p>
        <p class="reason">{book.reason}</p>
      </div>
    </div>
  )
}
---

## Related

- concepts/ai-book-search.md
- guides/ai-retry-patterns.md
- errors/aisearch-errors.md
