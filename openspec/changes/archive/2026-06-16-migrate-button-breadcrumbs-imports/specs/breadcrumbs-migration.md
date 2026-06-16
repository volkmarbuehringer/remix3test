# Breadcrumbs import migration

## Files (1 file, 2 imports)

- `app/ui/breadcrumbs.tsx`

## Change

```diff
- import { Breadcrumbs } from 'remix/ui/breadcrumbs'
- import type { BreadcrumbItem } from 'remix/ui/breadcrumbs'
+ import { Breadcrumbs } from 'remix/components/breadcrumbs'
+ import type { BreadcrumbItem } from 'remix/components/breadcrumbs'
```

This is a re-export wrapper — consumers of `app/ui/breadcrumbs.tsx` are not affected.

## Verification

Typecheck passes, breadcrumb rendering unchanged.
