<!-- Context: frame-navigation/errors | Priority: medium | Version: 1.0 | Updated: 2026-03-21 -->

# Sorting Bug Fixes

Bugs encountered during sorting implementation and their fixes.

## buildBackUrl URL Encoding Vulnerability

**Bug**: Using string concatenation could cause URL parsing issues.

### ❌ Wrong

```typescript
return baseUrl + '?page=' + page + '&sort=' + sort.column
// Problem: special characters in sort column break URL
```

### ✅ Fixed

```typescript
let params = new URLSearchParams()
if (page !== '1') params.set('page', page)
if (sort?.column) {
  params.set('sort', sort.column)
  params.set('dir', sort.direction)
}
return baseUrl + (params.toString() ? '?' + params.toString() : '')
```

**File**: `app/lib/admin-utils.ts` - `buildBackUrl`

## Sort Object Construction Bug

**Bug**: Passing entire sort object instead of its properties to error handlers.

### ❌ Wrong

```typescript
handleDeleteError(error, url, page, msg, sort, dir)
// If sort = { column: 'title', direction: 'asc' }
// Error handler received sort as object, not string
```

### ✅ Fixed

```typescript
handleDeleteError(
  error,
  url,
  page,
  msg,
  sort?.column ?? null, // Pass column separately
  sort?.direction ?? null, // Pass direction separately
)
```

**File**: `app/lib/controller-utils.ts` - `destroy` action

## handleDeleteError Missing Parameters

**Bug**: Original signature didn't accept sort/dir parameters.

### ❌ Original

```typescript
function handleDeleteError(error, listUrl, page, customMessage?)
```

### ✅ Fixed

```typescript
function handleDeleteError(
  error,
  listUrl,
  page = '1',
  customMessage?,
  sort?: string | null,
  dir?: string | null,
)
```

**File**: `app/lib/admin-utils.ts` - `handleDeleteError`

## Reference

- `guides/sort-page-preservation.md` - Correct usage patterns
- `lookup/sorting-utilities.md` - Utility functions
