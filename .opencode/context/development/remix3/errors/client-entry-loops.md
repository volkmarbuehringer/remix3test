<!-- Context: development/remix3/errors/client-entry-loops | Priority: high | Version: 1.0 | Updated: 2026-03-26 -->

# Error: handle.update() Infinite Loop

**Symptom**: Console shows `Error: handle.update() infinite loop detected` repeatedly.

**Cause**: Module-level state initialized or modified inside render function causes re-render cycle.

## Common Triggers

### 1. State init in render

```typescript
❌ WRONG
return () => {
  let { title } = handle.props
  if (value !== title) { value = title }  // Causes loop!
  // ...
}

✅ FIXED
let initialized = false
return () => {
  let { title } = handle.props
  if (!initialized && title) { value = title; initialized = true }
  // ...
}
```

### 2. Per-row clientEntry in lists

```typescript
❌ WRONG
// Each row gets own clientEntry — state conflicts!
{books.map(book => <BookTitleEdit bookId={book.id} />)}

✅ FIXED
// Single clientEntry for entire grid
<AdminBooksGrid books={books} />
```

### 3. handle.update() after frame reload

```typescript
❌ WRONG
if (res.ok) {
  handle.frame.reload()
  handle.update()  // Unnecessary + causes loop
}

✅ FIXED
if (res.ok) {
  handle.frame.reload()
  // No handle.update() needed
}
```

## Quick Fix Checklist

- [ ] State initialized with guard: `if (value === '' && title)`
- [ ] No state changes in render (only in event handlers)
- [ ] Single `clientEntry` for lists, not per-row
- [ ] No `handle.update()` after `handle.frame.reload()`

## Reference

- Pattern: `examples/editable-fields.md`
