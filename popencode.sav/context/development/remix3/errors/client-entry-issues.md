# Error: clientEntry Grid Component Issues

**Problem**: React components cannot be used with Remix's clientEntry pattern.

## Symptom

```
Cannot find module 'remix/ui'
Property 'mix' does not exist on type 'ButtonProps'
Property 'style' does not exist on type 'ButtonProps'
```

## Cause

The `clientEntry` pattern creates client-side JavaScript for inline editing. React components:

1. Cannot resolve `remix/ui` imports from different packages
2. Use a two-phase render pattern incompatible with clientEntry
3. Don't support `mix` prop (Remix's styling mixin)

## Solution

**Use CSS classes instead of React components** within clientEntry grids:

```tsx
// ❌ Wrong: React component
import { Button } from 'app/components/ui/button.tsx'
<Button variant="primary">Save</Button>

// ✅ Correct: CSS class
<button class="btn">Save</button>
```

## Grid Components Affected

- `admin-books-grid.tsx` - Inline book editing
- `admin-users-grid.tsx` - Inline user editing

## Related

- remix3/concepts/css-class-mapping.md
- remix3/guides/design-system-implementation.md
