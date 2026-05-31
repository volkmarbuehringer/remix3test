<!-- Context: project-intelligence/bookstore/examples | Priority: high | Version: 1.0 -->

# Admin User Form Example

## Overview

The user form demonstrates a simple single-section form for editing user accounts. It shows basic usage of `TextInput` and `SelectInput` components.

## Implementation

```tsx
import { css } from 'remix/ui'
import type { User } from '../../../data/schema.ts'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { Layout } from '../../../ui/layout.tsx'
import {
  TextInput,
  SelectInput,
  FormSection,
  FormActions,
} from '../../../ui/form/index.ts'

export interface AdminUserFormPageProps {
  title: string
  action: string
  cancelHref: string
  submitLabel: string
  user: User
}

export function AdminUserFormPage() {
  return ({ action, cancelHref, submitLabel, title, user }: AdminUserFormPageProps) => (
    <Layout>
      <h1>{title}</h1>
      
      <div class="card" style={{ maxWidth: '600px' }}>
        <RestfulForm method="PUT" action={action}>
          <FormSection title="User Information">
            <TextInput
              name="name"
              label="Name"
              value={user.name}
              required
              placeholder="Enter full name"
            />
            <TextInput
              name="email"
              label="Email"
              type="email"
              value={user.email}
              required
              placeholder="Enter email address"
              autoComplete="email"
            />
            <SelectInput
              name="role"
              label="Role"
              value={user.role}
              required
              options={[
                { value: 'customer', label: 'Customer' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </FormSection>

          <FormActions 
            submitLabel={submitLabel} 
            cancelHref={cancelHref} 
            cancelLabel="Cancel" 
          />
        </RestfulForm>
      </div>
    </Layout>
  )
}
```

## Key Patterns

### Email Input

Uses `type="email"` for browser validation and `autoComplete="email"` for user convenience:

```tsx
<TextInput
  name="email"
  label="Email"
  type="email"
  value={user.email}
  required
  autoComplete="email"
/>
```

### Role Selection

Simple dropdown with two predefined options:

```tsx
<SelectInput
  name="role"
  label="Role"
  value={user.role}
  required
  options={[
    { value: 'customer', label: 'Customer' },
    { value: 'admin', label: 'Admin' },
  ]}
/>
```

## Layout Choices

| Decision | Rationale |
|----------|-----------|
| Single section | Only 3 fields, no grouping needed |
| 600px max-width | Simple form, narrower looks better |
| No FormGrid | Fields are full-width, no pairs |

## Component Usage

| Component | Purpose |
|-----------|---------|
| TextInput (name) | Full name field |
| TextInput (email) | Email with validation |
| SelectInput (role) | Role dropdown |
| FormSection | Group all fields |
| FormActions | Submit + Cancel |

## Codebase Reference

- Full implementation: `app/controllers/admin/users/form.tsx:22-75`
- User schema: `app/data/schema.ts`

## Related

- [Form Components](../concepts/form-components.md)
- [Book Form Example](./admin-book-form.md)
- [Order Item Form Example](./admin-order-item-form.md)
