<!-- Context: project-intelligence/bookstore/examples | Priority: high | Version: 1.0 -->

# Admin Order Item Form Example

## Overview

The order item form demonstrates editing order line items with a mix of read-only display and editable fields. It uses custom styling for read-only fields alongside `NumberInput` components.

## Implementation

```tsx
import { css } from 'remix/ui'
import { RestfulForm } from '../../../ui/restful-form.tsx'
import { Layout } from '../../../ui/layout.tsx'
import {
  NumberInput,
  FormSection,
  FormActions,
} from '../../../ui/form/index.ts'

interface OrderItemData {
  order_id: number
  book_id: number
  title: string
  unit_price: number
  quantity: number
}

export interface AdminOrderItemFormPageProps {
  title: string
  action: string
  cancelHref: string
  submitLabel: string
  orderItem?: OrderItemData
}

export function AdminOrderItemFormPage() {
  return ({ action, orderItem, cancelHref, submitLabel, title }: AdminOrderItemFormPageProps) => (
    <Layout>
      <h1>{title}</h1>
      
      <div class="card" style={{ maxWidth: '600px' }}>
        <RestfulForm method="PUT" action={action}>
          {/* Hidden fields for composite primary key */}
          <input type="hidden" name="order_id" value={orderItem?.order_id} />
          <input type="hidden" name="book_id" value={orderItem?.book_id} />

          <FormSection title="Order Item Details">
            {/* Read-only display field */}
            <div style={readonlyGroupStyles}>
              <label style={readonlyLabelStyles}>Book Title</label>
              <p style={readonlyValueStyles}>{orderItem?.title ?? '-'}</p>
            </div>

            {/* Editable quantity field */}
            <NumberInput
              name="quantity"
              label="Quantity"
              value={orderItem?.quantity ?? 1}
              required
              min={1}
              step={1}
            />

            {/* Editable price field */}
            <NumberInput
              name="unit_price"
              label="Unit Price"
              value={orderItem?.unit_price ?? 0}
              required
              min={0}
              step={0.01}
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

// Custom styles for read-only display
const readonlyGroupStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--spacing-xs)',
})

const readonlyLabelStyles = css({
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-primary)',
})

const readonlyValueStyles = css({
  fontSize: 'var(--font-size-base)',
  color: 'var(--color-text-muted)',
  padding: 'var(--spacing-sm) var(--spacing-md)',
  backgroundColor: 'var(--color-background-muted)',
  borderRadius: 'var(--radius-default)',
  border: '1px solid var(--color-border)',
  margin: 0,
})
```

## Key Patterns

### Hidden Form Fields

Store primary key data in hidden inputs:

```tsx
<input type="hidden" name="order_id" value={orderItem?.order_id} />
<input type="hidden" name="book_id" value={orderItem?.book_id} />
```

### Read-Only Display

Custom styled display for non-editable data:

```tsx
<div class="readonly-field">
  <label>Book Title</label>
  <p class="readonly-value">{orderItem?.title}</p>
</div>
```

Styles:
- Muted background (`--color-background-muted`)
- Border to match inputs
- Same padding as inputs for alignment

### Number Inputs with Constraints

```tsx
{/* Quantity must be at least 1 */}
<NumberInput
  name="quantity"
  label="Quantity"
  min={1}
  step={1}
/>

{/* Price can be 0+ with cents */}
<NumberInput
  name="unit_price"
  label="Unit Price"
  min={0}
  step={0.01}
/>
```

## Layout Choices

| Decision | Rationale |
|----------|-----------|
| Single section | Only 3 fields total |
| 600px max-width | Simple, focused form |
| Read-only display | Title is for reference only |
| Hidden inputs | Preserve composite key |

## Component Usage

| Component | Purpose |
|-----------|---------|
| Custom read-only div | Display book title |
| NumberInput (quantity) | Editable quantity |
| NumberInput (unit_price) | Editable price |
| FormSection | Group all fields |
| FormActions | Submit + Cancel |

## Codebase Reference

- Full implementation: `app/controllers/admin/order-items/form.tsx:29-101`
- NumberInput component: `app/ui/form/number-input.tsx`

## Related

- [Form Components](../concepts/form-components.md)
- [Book Form Example](./admin-book-form.md)
- [User Form Example](./admin-user-form.md)
