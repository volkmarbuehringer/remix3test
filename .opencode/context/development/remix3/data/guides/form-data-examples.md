<!-- Context: development/remix3/guides/form-data-examples | Priority: medium | Version: 1.0 | Updated: 2026-04-11 -->

# Form Data Examples

Working examples of form data handling patterns.

## Complete Example

```typescript
// checkout/controller.tsx
const shippingSchema = f.object({
  street: f.field(s.string()),
  city: f.field(s.string()),
})

export default {
  actions: {
    index() { return render(<CheckoutForm />) },
    
    async action({ get }) {
      let formData = get(FormData)
      let address = s.parse(shippingSchema, formData)
      // Process order...
      return redirect(routes.checkout.confirmation.href({ orderId }))
    },
  },
}
```

## Common Patterns

### File Uploads
```typescript
async action({ get }) {
  let formData = get(FormData)
  let file = formData.get('avatar') as File
}
```

### Multiple Values
```typescript
async action({ get }) {
  let formData = get(FormData)
  let tags = formData.getAll('tags')  // Multiple checkboxes
}
```

### With Authentication
```typescript
async action({ get }) {
  let formData = get(FormData)
  let session = get(Session)
  let user = session.get('user')
}
```

## Codebase References

- `bookstore/app/router.ts` - formData middleware setup
- `bookstore/app/controllers/checkout/controller.tsx` - Full example

## Related

- `guides/form-data-handling.md` - Core patterns
- `errors/body-unusable.md` - Troubleshooting
