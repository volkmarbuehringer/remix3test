<!-- Context: project-intelligence/bookstore/examples | Priority: high | Version: 1.0 -->

# Admin Book Form Example

## Overview

The book form demonstrates a complex multi-section form using the full component library. It organizes 10+ fields across 5 logical sections with a mix of input types.

## Full Implementation

```tsx
import { css } from 'remix/ui'
import type { Book } from '../../../data/schema.ts'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { Layout } from '../../../ui/layout.tsx'
import {
  TextInput,
  TextareaInput,
  NumberInput,
  SelectInput,
  FileInput,
  FormSection,
  FormGrid,
  FormActions,
} from '../../../ui/form/index.ts'

export function AdminBookFormPage() {
  return ({ book, cancelHref, submitLabel, action }: AdminBookFormPageProps) => (
    <Layout>
      <h1>{title}</h1>
      <div class="card" style={{ maxWidth: '800px' }}>
        <RestfulForm method={method} action={action} encType="multipart/form-data">
          
          {/* Section 1: Basic Information */}
          <FormSection title="Basic Information">
            <FormGrid columns={2}>
              <TextInput
                name="title"
                label="Title"
                value={book?.title}
                required
                placeholder="Enter book title"
              />
              <TextInput
                name="author"
                label="Author"
                value={book?.author}
                required
                placeholder="Enter author name"
              />
            </FormGrid>
            <TextInput
              name="slug"
              label="Slug"
              value={book?.slug}
              required
              helperText="URL-friendly name (e.g., my-book-title)"
            />
          </FormSection>

          {/* Section 2: Description */}
          <FormSection title="Description">
            <TextareaInput
              name="description"
              label="Description"
              value={book?.description}
              required
              rows={5}
              maxLength={2000}
              placeholder="Enter book description..."
            />
          </FormSection>

          {/* Section 3: Pricing & Inventory */}
          <FormSection title="Pricing & Inventory">
            <FormGrid columns={2}>
              <NumberInput
                name="price"
                label="Price"
                value={book?.price}
                required
                min={0}
                step={0.01}
                placeholder="0.00"
              />
              <TextInput
                name="genre"
                label="Genre"
                value={book?.genre}
                required
                placeholder="e.g., Fiction, Science"
              />
            </FormGrid>
            <FormGrid columns={2}>
              <SelectInput
                name="inStock"
                label="In Stock"
                value={book?.in_stock ? 'true' : 'false'}
                required
                options={[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ]}
              />
            </FormGrid>
          </FormSection>

          {/* Section 4: Publication Details */}
          <FormSection title="Publication Details">
            <FormGrid columns={2}>
              <TextInput
                name="isbn"
                label="ISBN"
                value={book?.isbn}
                required
                placeholder="978-0-00-000000-0"
              />
              <NumberInput
                name="publishedYear"
                label="Published Year"
                value={book?.published_year ?? 2024}
                required
                min={1900}
                max={2030}
                step={1}
              />
            </FormGrid>
          </FormSection>

          {/* Section 5: Cover Image */}
          <FormSection title="Cover Image">
            <FileInput
              name="cover"
              label="Book Cover"
              accept="image/*"
              helperText="Optional. Upload a cover image for this book."
              currentImage={book?.cover_url}
              currentImageAlt={book?.title}
            />
          </FormSection>

          {/* Actions */}
          <FormActions submitLabel={submitLabel} cancelHref={cancelHref} />
        </RestfulForm>
      </div>
    </Layout>
  )
}
```

## Key Patterns Demonstrated

| Pattern | Implementation |
|---------|---------------|
| Multi-section layout | 5 `FormSection` components |
| Side-by-side fields | `FormGrid columns={2}` for pairs |
| Boolean select | `SelectInput` with true/false options |
| File upload | `FileInput` with preview support |
| Character count | `TextareaInput` with `maxLength={2000}` |
| Currency input | `NumberInput` with `step={0.01}` |

## Component Usage Count

| Component | Count | Locations |
|-----------|-------|-----------|
| TextInput | 4 | Title, Author, Slug, Genre, ISBN |
| NumberInput | 2 | Price, Published Year |
| SelectInput | 1 | In Stock (boolean) |
| TextareaInput | 1 | Description |
| FileInput | 1 | Cover Image |
| FormSection | 5 | All groupings |
| FormGrid | 3 | Basic Info, Pricing, Publication |

## Codebase Reference

- Full implementation: `app/controllers/admin/books/form.tsx:28-177`
- Component library: `app/ui/form/index.ts`

## Related

- [Form Components](../concepts/form-components.md)
- [Form Organization](../guides/form-organization.md)
- [User Form Example](./admin-user-form.md)
