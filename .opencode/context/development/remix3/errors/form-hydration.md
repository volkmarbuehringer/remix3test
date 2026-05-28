<!-- Context: development/remix3/errors/form-hydration | Priority: high | Version: 1.2 | Updated: 2026-04-08 -->

# Error: Form Field Issues

Common issues with form fields in Remix curried component pattern.

## Empty Fields After Hydration

**Symptom**: Edit form shows empty values despite item having data.

**Cause**: Used `defaultValue` instead of `value` for edit forms.

**Fix**: Use `value` (controlled) for edit forms:

```tsx
// ❌ Wrong - empty after hydration
<input name="title" defaultValue={item.title} />

// ✅ Correct - value persists through hydration
<input name="title" value={item.title ?? ''} />
```

## Textarea Always Empty

**Symptom**: Textarea fields show empty even with data from database.

**Cause**: Used `value` prop on `<textarea>` element - Remix SSR doesn't support this like React does.

**Why It Happens**:
- In Remix 3 SSR, HTML is generated server-side before JavaScript runs
- The `value` prop on `<textarea>` is not properly handled during server rendering
- The browser receives empty textarea content regardless of the prop value
- This causes hydration mismatches and empty fields in edit forms

**Fix**: Use children for textarea content:

```tsx
// ❌ Wrong - textarea ignores value prop in Remix SSR
<textarea name="description" value={item.description} />

// ✅ Correct - use children for content
<textarea name="description">
  {item.description}
</textarea>
```

**Component Reference**: `bookstore/app/ui/form/textarea-input.tsx` uses this pattern with `{value}` as children.

In reusable components, use `{children ?? value}` to support both patterns.

## Date Field Required Validation Fails

**Symptom**: "Field cannot be empty" validation error on optional date fields.

**Cause**: Passed `value=""` (empty string) for optional fields - triggers required validation.

**Fix**: Only set value when defined:

```tsx
// ❌ Wrong - empty string triggers required
<Input name="end_date" type="date" value="" />

// ✅ Correct - don't pass value at all
<Input name="end_date" type="date" />

// Or in component
{...(value !== undefined ? { value } : {})}
```

## DateTime-Local Issues

**Symptom**: Date fields always show empty or have time zone problems.

**Cause**: Using `type="datetime-local"` with time component complications.

**Fix**: Use `type="date"` instead:

```tsx
// ❌ Problematic
<Input name="start_time" type="datetime-local" />

// ✅ Better - date only
<Input name="start_date" type="date" />
```

## Partial Update Validation Error

**Symptom**: `DataTableValidationError: Invalid value for column "slug"`

**Cause**: Update action validated all schema fields, but modal only sends 4 fields.

**Fix**: Create separate quick edit schema and detect partial updates:

```typescript
// Quick edit schema - only validates sent fields
let quickEditSchema = f.object({
  title: textField,
  genre: textField,
  price: priceField,
  inStock: inStockField,
})

// Detect quick edit vs full update
let isQuickEdit = formData.has('title') && !formData.has('author')

if (isQuickEdit) {
  let { title, genre, price, inStock } = s.parse(quickEditSchema, formData)
  await db.update(books, book.id, { title, genre, price: parseFloat(price), in_stock: inStock })
} else {
  // Full update with all fields
}
```

## Reference

- guides/form-patterns.md (controlled inputs)
- demos/bookstore/app/controllers/admin/books/controller.tsx
