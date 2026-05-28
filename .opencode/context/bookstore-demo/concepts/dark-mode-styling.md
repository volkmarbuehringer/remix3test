<!-- Context: bookstore-demo/concepts/dark-mode-styling | Priority: high | Version: 1.0 | Updated: 2026-04-28 -->

# Concept: Bookstore Dark Mode Styling Conventions

**Core Idea**: The bookstore `app.css` uses `var(--rmx-*)` theme contract CSS variables instead of hardcoded hex colors. Each UI element maps to a specific surface level for consistent light/dark appearance.

---

## Surface Level Mapping

| Element | CSS Variable | Light Value | Dark Value |
|---------|-------------|-------------|------------|
| Header | `var(--rmx-surface-lvl3)` | `#e2e8f0` (gray200) | `#475569` (gray600) |
| Footer | `var(--rmx-surface-lvl3)` | `#e2e8f0` | `#475569` |
| Body background | `var(--rmx-surface-lvl1)` | `#f8fafc` (gray50) | `#1e293b` (gray800) |
| Cards | `var(--rmx-surface-lvl0)` | `#ffffff` (white) | `#0f172a` (gray900) |
| Table body | `var(--rmx-surface-lvl0)` | `#ffffff` | `#0f172a` |
| Table header (`<th>`) | `var(--rmx-surface-lvl1)` | `#f8fafc` | `#1e293b` |
| Form inputs | `var(--rmx-surface-lvl0)` | `#ffffff` | `#0f172a` |
| Alerts/badges | `var(--rmx-surface-lvl2)` | `#f1f5f9` (gray100) | `#334155` (gray700) |
| Book card images | `var(--rmx-surface-lvl2)` | `#f1f5f9` | `#334155` |
| Nav hover background | `var(--rmx-surface-lvl2)` | `#f1f5f9` | `#334155` |

**Why lvl3 for header/footer**: In light mode gives visible gray bar distinct from body (`#f8fafc`); in dark mode `#475569` is dark enough not to be "too bright" (lvl2 = `#334155` was previously complained about as too bright).

---

## Key CSS Patterns

```css
/* Body */
body {
  background: var(--rmx-surface-lvl1);
  color: var(--rmx-color-text-primary);
  font-family: var(--rmx-font-family-sans);
}

/* Header/Footer */
header, footer {
  background: var(--rmx-surface-lvl3);
  color: var(--rmx-color-text-primary);
}

/* Card */
.card {
  background: var(--rmx-surface-lvl0);
  border: 1px solid var(--rmx-color-border-default);
  box-shadow: var(--rmx-shadow-sm);
}

/* Table zebra striping (from admin styles.ts) */
& tbody tr:nth-child(even) { background-color: var(--rmx-surface-lvl0); }
& tbody tr:nth-child(odd)  { background-color: var(--rmx-surface-lvl1); }

/* Input focus */
.form-group input:focus {
  border-color: var(--rmx-color-action-primary-background);
  box-shadow: 0 0 0 3px var(--rmx-color-focus-ring);
}
```

---

## 📂 Codebase References

**Implementation**:
- `bookstore/public/app.css` — Global styles using all surface levels and color variables
- `bookstore/app/assets/app.css` — Same styles (asset entry point)
- `bookstore/app/controllers/admin/styles.ts` — Admin-specific mixins using theme variables
- `bookstore/app/ui/theme.tsx` — Light/dark surface + color value definitions

**Related**:
- `../../development/remix3/lookup/theme-contract-variables.md` — All CSS variable names
- `../../development/remix3/guides/design-system.md` — Design system overview
