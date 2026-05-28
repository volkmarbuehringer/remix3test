<!-- Context: project-intelligence/newapp/errors/breadcrumb-not-synced | Priority: medium | Version: 1.0 | Updated: 2026-05-26 -->

# Error: Breadcrumb Not Auto-Synced

**Severity**: 🟡 Medium

**File**: `app/ui/breadcrumbs.tsx`

`getBreadcrumbs()` uses hardcoded path → label mappings. Adding a new route requires manually updating the mapping.

**Fix**: Update `app/ui/breadcrumbs.tsx` when adding new routes. See [breadcrumb pattern guide](../guides/breadcrumb-pattern.md).
