<!-- Context: project-intelligence/bookstore/guides | Priority: high | Version: 1.0 -->

# Form Organization Best Practices

## Layout Standards

### Card Container

Wrap forms in a card with consistent max-width:

```tsx
// Complex forms (books)
<div class="card" style={{ maxWidth: '800px' }}>
  <RestfulForm>...</RestfulForm>
</div>

// Simple forms (users, order-items)
<div class="card" style={{ maxWidth: '600px' }}>
  <RestfulForm>...</RestfulForm>
</div>
```

### Section Organization

Group related fields into sections:

```tsx
<FormSection title="Basic Information">
  <FormGrid columns={2}>
    <TextInput name="title" label="Title" required />
    <TextInput name="author" label="Author" required />
  </FormGrid>
</FormSection>

<FormSection title="Description">
  <TextareaInput 
    name="description" 
    label="Description"
    maxLength={2000}
  />
</FormSection>
```

## Grid Patterns

### Two-Column Grid

Use for pairs of related short fields:

```tsx
<FormGrid columns={2}>
  <TextInput name="isbn" label="ISBN" />
  <NumberInput name="year" label="Year" min={1900} max={2030} />
</FormGrid>
```

### Single Column

Use for forms with mostly long fields:

```tsx
<FormSection title="User Information">
  <TextInput name="name" label="Name" required />
  <TextInput name="email" label="Email" type="email" required />
  <SelectInput name="role" label="Role" options={[...]} />
</FormSection>
```

## Section Guidelines

| Complexity | Sections | Example |
|------------|----------|---------|
| Simple (1-3 fields) | 1 section | User edit form |
| Medium (4-8 fields) | 2-3 sections | Order item edit |
| Complex (9+ fields) | 4+ sections | Book edit form |

## Field Ordering

1. **Required fields first** within each section
2. **Logical grouping** - related fields together
3. **Frequency of use** - most-used fields at top
4. **Progressive disclosure** - simple → complex

## Accessibility

- All inputs have associated labels
- Required fields marked with `*` indicator
- Error messages linked to fields
- Focus states use ring shadows
- Keyboard navigation supported

## Validation Display

```tsx
<TextInput
  name="email"
  label="Email"
  type="email"
  required
  error={errors?.email}  // Shows red border + message
  helperText="We'll never share your email"  // Shows as hint
/>
```

## Preserving State

Preserve pagination/sort when submitting:

```tsx
// Extract query string from backUrl
let formAction = action
if (backUrl) {
  let queryIndex = backUrl.indexOf('?')
  if (queryIndex !== -1) {
    formAction = `${action}${backUrl.slice(queryIndex)}`
  }
}

<RestfulForm action={formAction}>...</RestfulForm>
```

## Codebase References

- Book form (5 sections): `app/controllers/admin/books/form.tsx:64-172`
- User form (1 section): `app/controllers/admin/users/form.tsx:40-67`
- Order items form (1 section): `app/controllers/admin/order-items/form.tsx:68-93`

## Related

- [Form Components](../concepts/form-components.md)
- [SSR Form Patterns](../concepts/ssr-form-patterns.md)
