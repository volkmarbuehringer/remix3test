<!-- Context: project-intelligence/admin-routes/migration-checklist | Priority: medium | Version: 1.0 | Updated: 2026-04-25 -->

# Admin Route Migration Checklist

**Purpose**: Convert an existing admin index page to use shared components and styling standards.

---

## Step 1: Replace Inline Styles with Shared Components

Remove hardcoded page structure and replace with:

```typescript
import { AdminPageHeader } from '../../ui/admin-page-header.tsx'
import { AdminFilterForm } from '../../ui/admin-filter-form.tsx'
import { AdminTableCard } from '../../ui/admin-table-card.tsx'
```

**Before**:
```tsx
<h1>Manage Books</h1>
<p>View and manage books...</p>
<form method="GET">...</form>
<div class="card">
  <table>...</table>
</div>
```

**After**:
```tsx
<AdminPageHeader title="Manage Books" description="..." />
<AdminFilterForm ... />
<AdminTableCard ...>
  <table>...</table>
</AdminTableCard>
```

---

## Step 2: Remove Class-Based Styling

Search and remove all `class="..."` or `className="..."` attributes:

| Remove | Replace With |
|--------|--------------|
| `class="card"` | `<AdminTableCard>` wrapper or `t.cardBase` mixin |
| `class="btn*"` | `t.buttonBase` + variant mixins |
| `class="badge*"` | `<Badge variant="...">` component |
| `class="actions"` | `s.thActionsStyle` or `s.actionButtonStyle` |

---

## Step 3: Tokenize Hardcoded Colors

Replace literal color values with tokens from `app/ui/tokens.ts`:

| Hardcoded | Token |
|-----------|-------|
| `#FF385C` | `t.colors.adminAccent` |
| `#e62e4d` | `t.colors.adminAccentHover` |
| `rgba(255,56,92,0.1)` | `t.colors.adminAccentLight` |
| `#f8fafc` | `t.colors.gray50` |
| `#ffffff` | `t.colors.white` |

---

## Step 4: Add Zebra Striping

Ensure the table uses the shared `tableStyle` mixin:

```typescript
import * as s from '../styles.ts'

<table mix={s.tableStyle}>
```

This applies automatic alternating row colors. No per-row classes needed.

---

## Step 5: Use Admin Accent for Focus States

Update input/select focus styles to use admin tokens:

```typescript
'&:focus': {
  outline: 'none',
  borderColor: t.colors.adminAccent,
  boxShadow: `0 0 0 3px ${t.colors.adminAccentLight}`,
}
```

---

## Step 6: Add Badge Component for Status Columns

Replace inline status styling with `<Badge>`:

```typescript
import { Badge } from '../../ui/badge.tsx'

<td>
  {user.role === 'admin'
    ? <Badge variant="info">{user.role}</Badge>
    : user.role}
</td>
```

---

## Step 7: Validate

Run the standard validation commands after all changes:

```bash
pnpm run typecheck
pnpm run lint
```

---

## Reference Migrations

Completed migrations in the codebase:

| Route | File |
|-------|------|
| `/admin/books` | `bookstore/app/controllers/admin/books/index-page.tsx` |
| `/admin/users` | `bookstore/app/controllers/admin/users/index-page.tsx` |
| `/admin/orders` | `bookstore/app/controllers/admin/orders/index-page.tsx` |

---

## Related

- **Shared Components**: `shared-components.md`
- **Styling Guide**: `styling-guide.md`
- **Code Quality**: `../../core/standards/concepts/code-quality.md`
