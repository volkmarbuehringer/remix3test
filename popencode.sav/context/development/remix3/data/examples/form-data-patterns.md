# Example: Form Data Patterns

**Core Idea**: Correct patterns for form data handling in Remix 3.

## Form Route

```typescript
import { form } from 'remix/routes'

export let routes = route({
  contact: form('contact'),
})
```

## Controller

```typescript
export default {
  async action({ request }) {
    let formData = await request.formData()
    let data = Object.fromEntries(formData)
    // Validate and process
  },
  content() {
    return <ContactForm />
  },
}
```

## Form Component

```tsx
<form method="POST" action={routes.contact.href()}>
  <input name="email" type="email" required />
  <textarea name="message" required />
  <button type="submit">Send</button>
</form>
```

**Reference**: `.opencode/context/development/remix3/examples/form-data-patterns.md`