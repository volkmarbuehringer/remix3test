<!-- Context: project-intelligence/bookstore/concepts | Priority: high | Version: 1.0 -->

# Form Component Library

## Overview

The form component library (`app/ui/form/`) provides reusable, SSR-compatible form components built on Remix 3 patterns. All components follow consistent styling using CSS design tokens and support progressive enhancement.

## Component Architecture

```
app/ui/form/
├── index.ts              # Public exports
├── field-wrapper.tsx     # Base field styling (label, error, helper)
├── text-input.tsx        # Text/email/password inputs
├── textarea-input.tsx    # Multi-line text with character count
├── number-input.tsx      # Numeric inputs with min/max/step
├── select-input.tsx      # Dropdown with SSR-compatible selection
├── file-input.tsx        # File upload with image preview
├── form-section.tsx      # Fieldset grouping with title
├── form-grid.tsx         # Multi-column layout
└── form-actions.tsx      # Submit/cancel buttons
```

## Input Components

| Component | Props | Use Case |
|-----------|-------|----------|
| `TextInput` | `name, label, type?, value?, placeholder?, required?, error?, helperText?, autoComplete?` | Single-line text, email, passwords |
| `TextareaInput` | `name, label, value?, rows?, maxLength?, placeholder?` | Multi-line descriptions |
| `NumberInput` | `name, label, value?, min?, max?, step?` | Prices, quantities, years |
| `SelectInput` | `name, label, value?, options[], placeholder?` | Role selection, status filters |
| `FileInput` | `name, label, accept?, currentImage?` | Image uploads with preview |

## Layout Components

| Component | Props | Use Case |
|-----------|-------|----------|
| `FormSection` | `title, description?, children` | Group related fields |
| `FormGrid` | `children, columns?` | Side-by-side fields (2/3/4 cols) |
| `FormActions` | `submitLabel?, cancelHref?, loading?` | Submit/cancel buttons |

## SSR Compatibility

All components follow Remix 3 SSR patterns:

**Select uses `selected` on options:**
```tsx
// ✅ Correct for SSR
<SelectInput
  name="role"
  label="Role"
  value={user.role}
  options={[
    { value: 'customer', label: 'Customer' },
    { value: 'admin', label: 'Admin' },
  ]}
/>
```

**Textarea uses children for value:**
```tsx
// ✅ Correct for SSR
<TextareaInput
  name="description"
  label="Description"
  value={book?.description}
  maxLength={2000}
/>
```

## Codebase References

- Library: `app/ui/form/index.ts`
- Book form: `app/controllers/admin/books/form.tsx:64-172`
- User form: `app/controllers/admin/users/form.tsx:40-67`
- Order item form: `app/controllers/admin/order-items/form.tsx:68-93`

## Related

- [Form Organization Guide](../guides/form-organization.md)
- [Admin Book Form Example](../examples/admin-book-form.md)
- [SSR Form Patterns](./ssr-form-patterns.md)
