<!-- Context: development/remix3/guides | Priority: high | Version: 1.0 | Updated: 2026-04-07 -->

# Guide: Query Params to Fragments

**Purpose**: Passing initial values from URL query parameters to client-side fragment components using `getContext()`.

## Pattern Overview

When embedding client components via `<Frame>`, you may need to pass initial values from the URL (e.g., `?initialCount=10`). Use `getContext()` to access the request and parse query params server-side.

## Implementation

```typescript
// app/controllers/fragments/controller.tsx
import type { Controller } from 'remix/fetch-router'
import { getContext } from 'remix/async-context-middleware'

import { Counter } from '../../assets/counter.tsx'
import { routes } from '../../routes.ts'
import { renderFragment } from '../../utils/render.tsx'

export default {
  actions: {
    counter() {
      // Access request context
      let context = getContext()
      let url = new URL(context.request.url)
      
      // Parse query parameter
      let initialCount = parseInt(url.searchParams.get('initialCount') ?? '0', 10)
      
      // Pass to client component
      return renderFragment(<Counter initialCount={initialCount} />)
    },
  },
} satisfies Controller<typeof routes.fragments>
```

## Usage

| URL | Result |
|-----|--------|
| `/fragments/counter` | `initialCount = 0` (default) |
| `/fragments/counter?initialCount=10` | `initialCount = 10` |
| `/fragments/counter?initialCount=-5` | `initialCount = -5` |

## Frame Usage

```typescript
// In a page component:
<Frame
  src={routes.fragments.counter.href({ initialCount: 10 })}  // URL builder
  fallback={<div>Loading...</div>}
/>
```

Note: The query params are part of the URL built by `routes.fragments.counter.href()` - they become part of the frame's `src` attribute.

## Alternative: Build URL Manually

```typescript
// For complex URL construction
let frameSrc = `/fragments/counter?initialCount=${encodeURIComponent(count)}`
<Frame src={frameSrc} />
```

## Multiple Query Params

```typescript
// Multiple values
let page = parseInt(url.searchParams.get('page') ?? '1', 10)
let limit = parseInt(url.searchParams.get('limit') ?? '10', 10)
let sort = url.searchParams.get('sort') ?? 'name'
```

## Codebase References

**Implementation**:
- `bookstore/app/controllers/fragments/controller.tsx` - Full implementation

**Related**:
- `examples/counter-pattern.md` - Complete counter with query params
- `guides/frame-resolution.md` - Frame SSR details