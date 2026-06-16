# Design — Import migration

## Strategy

Mechanical import path replacements with no runtime behavior changes.

## Categories

### 1. Button (29 files)

```
- import { Button } from 'remix/ui/button'
+ import { Button } from 'remix/components/button'
```

Pure string replacement across all files. `Button` API is identical.

### 2. Breadcrumbs (1 file: `app/ui/breadcrumbs.tsx`)

```
- import { Breadcrumbs } from 'remix/ui/breadcrumbs'
- import type { BreadcrumbItem } from 'remix/ui/breadcrumbs'
+ import { Breadcrumbs } from 'remix/components/breadcrumbs'
+ import type { BreadcrumbItem } from 'remix/components/breadcrumbs'
```

This file re-exports both, so consumers are transparently updated.

### 3. Menu (7 files)

Each file has a **dual import** pattern:

```tsx
import * as menu from 'remix/ui/menu'                          // primitives — keep
import { MenuItem, MenuList, onMenuSelect } from 'remix/ui/menu'  // styled — move
```

Split into:
```tsx
import * as menu from 'remix/ui/menu'                              // unchanged
import { MenuItem, MenuList, onMenuSelect } from 'remix/components/menu'  // new path
```

`onMenuSelect` is re-exported from both paths (primitive → component), so no further changes needed.

### 4. `on('click')` type errors in `lists-client.tsx`

`Button` renders an `HTMLButtonElement`, but the mix system infers its generic element type as `Element` (not `HTMLButtonElement`). The upstream `on()` mixin tightened its event type parameter.

**Fix**: likely a type annotation or explicit `<HTMLButtonElement>` generic on `on()`. Verify against upstream type definition.
