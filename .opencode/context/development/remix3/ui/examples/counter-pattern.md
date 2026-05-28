<!-- Context: development/remix3/examples | Priority: high | Version: 1.0 | Updated: 2026-04-07 -->

# Example: Counter Pattern

**Purpose**: Complete working example of a client-side counter using `clientEntry` with proper two-phase pattern, Frame embedding, setup props, render props, and accessibility.

## Client Component
```tsx
import { clientEntry, on } from 'remix/ui'
import type { Handle } from 'remix/ui'

const moduleUrl = routes.assets.href({ path: 'counter.js#Counter' })
interface CounterProps { title?: string; incrementLabel?: string; decrementLabel?: string }

export const Counter = clientEntry(moduleUrl, (handle: Handle<CounterProps>, initialCount: number = 0) => {
  let count = initialCount
  return () => (
    <div class="card">
      <h1>{handle.props?.title ?? 'Counter'}</h1>
      <p aria-live="polite">Counter value: <span id="counter" role="status">{count}</span></p>
      <div class="flex gap-2">
        <button type="button" class="btn" aria-label={handle.props?.decrementLabel ?? 'Decrement counter'}
          mix={on('click', () => { count--; handle.update() })}>{handle.props?.decrementLabel ?? 'Decrement'}</button>
        <button type="button" class="btn" aria-label={handle.props?.incrementLabel ?? 'Increment counter'}
          mix={on('click', () => { count++; handle.update() })}>{handle.props?.incrementLabel ?? 'Increment'}</button>
      </div>
    </div>
  )
})
```

## Server Route with Frame
```tsx
function TestPage() { return () => (<Layout><Frame src={routes.fragments.counter.href()} fallback={<div style={{ color: '#666' }}>Loading counter...</div>} /></Layout>) }
```

## Fragment Controller with Query Params
```tsx
export default { actions: {
  counter() { let context = getContext(); let url = new URL(context.request.url); let initialCount = parseInt(url.searchParams.get('initialCount') ?? '0', 10); return renderFragment(<Counter initialCount={initialCount} />) },
}}
```

## Key Implementation Details
1. **Setup Params** (2nd param): `initialCount` passed from server at hydration
2. **Render Props** (returned fn): `title`, `incrementLabel`, `decrementLabel` for dynamic content
3. **State**: Use `let` for mutable variables, persist via closure
4. **Updates**: Call `handle.update()` after state changes
5. **Events**: Use `on()` mixin for DOM event handling
6. **Accessibility**: `aria-live="polite"`, `role="status"`, `aria-label` on buttons

## Accessibility Features
| Technique | Purpose |
|-----------|---------|
| `aria-live="polite"` | Announces changes without interrupting |
| `role="status"` | Screen reader accessible status region |
| `aria-label` on buttons | Descriptive labels for button actions |

## Codebase References
**Working Implementation**: `bookstore/app/assets/counter.tsx`, `bookstore/app/controllers/test.tsx`, `bookstore/app/controllers/fragments/controller.tsx`, `bookstore/app/ui/layout.tsx`
**Related**: `concepts/client-component-anatomy.md`, `guides/client-state-management.md`
