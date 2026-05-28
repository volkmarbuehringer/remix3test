<!-- Context: frame-navigation/guides | Priority: high | Version: 1.0 | Updated: 2026-03-21 -->

# Sort/Page Preservation Guide

**Core Idea**: URL query params work for GET links, but POST forms require hidden fields to preserve sort/page state across form submissions.

## The Problem

When a user:

1. Sorts a table by "title" (URL: `?sort=title&dir=asc&page=2`)
2. Clicks Edit → POST form submission
3. The form POSTs to `/update?_method=PUT` (no query params)
4. After update, redirect goes to list without sort/page context

## The Solution: Hidden Fields for POST

### Edit Form Pattern

```tsx
// In your form component
<form method="POST" action={editUrl}>
  {/* Hidden fields preserve state */}
  <input type="hidden" name="page" value={page} />
  <input type="hidden" name="sort" value={sort?.column ?? ''} />
  <input type="hidden" name="dir" value={sort?.direction ?? ''} />

  {/* Form fields */}
  <input name="title" value={item.title} />
  <button type="submit">Save</button>
</form>

// Cancel link uses buildBackUrl
<a href={buildBackUrl(listUrl, page, sort)}>Cancel</a>
```

### Controller Reads from formData

```typescript
async function update({ request, url }) {
  let formData = await request.formData()

  // Read from hidden fields, not URL
  let page = formData.get('page')?.toString() ?? '1'
  let sort = formData.get('sort')?.toString() || undefined
  let dir = formData.get('dir')?.toString() || undefined

  // ... process update ...

  // Redirect preserves state
  return redirect(`${listUrl}?page=${page}&sort=${sort}&dir=${dir}`)
}
```

### Delete Form Pattern

```tsx
<form method="POST" action={deleteUrl}>
  <input type="hidden" name="page" value={page} />
  <input type="hidden" name="sort" value={sort?.column ?? ''} />
  <input type="hidden" name="dir" value={sort?.direction ?? ''} />
  <button type="submit" onclick={/* confirm */}>
    Delete
  </button>
</form>
```

## Common Mistakes

### ❌ URL Params After POST

```tsx
// WRONG - query params lost on POST
<form method="POST" action={`/update?page=${page}&sort=${sort}`}>
```

### ❌ Reading from URL in POST Actions

```typescript
// WRONG - URL has no query params after form POST
let page = url.searchParams.get('page') // Always null!
```

### ✅ Hidden Fields + formData

```typescript
// CORRECT - read from formData
let page = formData.get('page')?.toString() ?? '1'
```

## buildCRUDActions Handles This

The `buildCRUDActions` utility in `controller-utils.ts` automatically handles:

- Reading page/sort/dir from formData for update/destroy
- Preserving them in redirect URLs

## Reference

See `concepts/patterns.md` for utilities and types.
