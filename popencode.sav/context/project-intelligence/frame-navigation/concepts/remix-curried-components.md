<!-- Context: frame-navigation/concepts | Priority: high | Version: 1.3 | Updated: 2026-03-21 -->

# Remix Curried Component Pattern

Components use a curried factory pattern where props pass to the inner render function.

## Pattern

```typescript
// Outer factory function - receives nothing at call time
export function AdminCoursesPage() {
  // Inner render function - receives props when called by framework
  return ({ mode = 'list', course, sort, page }: AdminCoursesPageProps) => JSX
}
```

**Usage**: `<AdminCoursesPage mode="edit" sort={sort} />` passes props to inner function.

## Why This Matters

This pattern means:

1. **Props go to inner function** - Outer factory is called at render time with no arguments
2. **Components are closures** - They capture state from their definition context
3. **Cannot extract sub-components** - A `<FormHiddenFields />` component can't access outer props because they're not in scope

## FormHiddenFields Incompatibility

**Attempted**: Extract a `<FormHiddenFields>` component to reduce repetition:

```typescript
// ❌ This doesn't work with curried components
export function FormHiddenFields() {
  return ({ sort, page }: { sort?: SortState; page?: string }) => (
    <>
      <input type="hidden" name="page" value={page ?? '1'} />
      {sort?.column && <input type="hidden" name="sort" value={sort.column} />}
      {sort?.direction && <input type="hidden" name="dir" value={sort.direction} />}
    </>
  )
}
```

**Problem**: Components using curried pattern can't pass props to child curried components easily. The child component's outer factory runs at definition time, not with the parent.

## Workaround

Keep hidden fields inline in each form:

```tsx
<form method="POST">
  <input type="hidden" name="page" value={page ?? '1'} />
  {sort?.column && <input type="hidden" name="sort" value={sort.column} />}
  {sort?.direction && <input type="hidden" name="dir" value={sort.direction} />}
  {/* rest of form */}
</form>
```

## Reference

- `app/admin/courses-page.tsx` - Full example of curried pattern
- `app/admin/admin-table.tsx` - Table/Pagination curried components
