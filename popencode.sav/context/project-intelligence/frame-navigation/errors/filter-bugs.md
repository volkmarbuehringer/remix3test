<!-- Context: frame-navigation/errors | Priority: high | Version: 1.0 | Updated: 2026-03-21 -->

# Filter Bug Fixes

Common mistakes with URL-based filtering and their fixes.

## Bug: Predicates Not Combined with `and()`

**Bug**: Passing raw predicate array to `where` causes query failures.

### ❌ Wrong

```typescript
// Returns array, not combined predicate
where: filterPredicates
```

### ✅ Fixed

```typescript
// Combine with and() - returns single predicate
where: filterPredicates.length > 0 ? and(...filterPredicates) : undefined
```

**File**: `app/lib/controller-utils.ts` - `index` action

## Bug: Using `value` Instead of `defaultValue`

**Bug**: Using `value` on controlled inputs causes hydration mismatches.

### ❌ Wrong

```tsx
// Causes hydration issues - value differs from server render
<select name="type" value={filters?.type || ''}>
```

### ✅ Fixed

```tsx
// SSR-safe: defaultValue only sets initial value
<select name="type" defaultValue={filters?.type || ''}>
```

## Bug: Missing `selected` on Options

**Bug**: Select may show wrong option after form submission.

### ❌ Wrong

```tsx
// Option not explicitly selected
<option value="announcement">Announcement</option>
```

### ✅ Fixed

```tsx
// Explicitly mark selected option
<option value="announcement" selected={filters?.type === 'announcement'}>
  Announcement
</option>
```

## Bug: Boolean Filter Handling

**Bug**: Comparing `read` param as string instead of boolean.

### ❌ Wrong

```typescript
// String comparison wrong for boolean column
predicates.push(eq(notifications.read, filters.read))
// If filters.read = "true", query becomes: WHERE read = 'true'
// But SQLite boolean column expects 0 or 1
```

### ✅ Fixed

```typescript
// Explicitly convert to boolean
predicates.push(eq(notifications.read, filters.read === 'true'))
```

## Bug: Missing Filter Preservation in Redirect

**Bug**: Redirect after create/update loses filter state.

### ❌ Wrong

```typescript
// Filter state lost in redirect
return redirect(config.routes.index.href())
```

### ✅ Fixed

```typescript
// Preserve filter params in redirect
let redirectUrl = config.routes.index.href()
if (filters.q) redirectUrl += '&q=' + encodeURIComponent(filters.q)
if (filters.type) redirectUrl += '&type=' + encodeURIComponent(filters.type)
return toastRedirect(redirectUrl, 'Notification created')
```

## Bug: Empty String Check

**Bug**: Using falsy check misses `""` as valid filter value.

### ❌ Wrong

```typescript
if (filters.type) { ... }
// filters.type = "" → falsy → skip
```

### ✅ Fixed

```typescript
if (filters.type !== undefined) { ... }
// filters.type = "" → defined → process
```

## Reference

- `concepts/filtering.md` - Filter pattern overview
- `lookup/filter-utilities.md` - Correct usage
- `guides/filter-implementation.md` - Step-by-step guide
