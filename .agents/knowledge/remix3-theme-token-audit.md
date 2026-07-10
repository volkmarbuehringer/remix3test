---
title: 'Remix 3 Theme Token Audit When Changing Colors'
tags: [remix3, theme, css, ui, colors, brand, action]
created: 2026-06-03
status: active
---

## Problem

When changing the `action.primary` color in `theme.tsx` from brand red to
neutral slate, several UI elements still displayed red because they
referenced `brand.light.accent` / `brand.dark.accent` directly instead of
the `action.*` theme tokens.

The Remix 3 theme contract separates **brand colors** (brand identity,
decorative dots, demo box borders) from **action colors** (button tones,
focus rings, status badges). Both must be audited when a color overhaul
is requested.

## Solution

After editing `app/theme.tsx` to change `action.primary.*`:

1. **Grep for all `brand` references** across the entire `app/` directory:

   ```bash
   rg "brand\.light\.accent|brand\.dark\.accent|import.*brand.*from.*theme" app/
   ```

2. **Replace brand references that are functional** (not purely decorative
   identity) with `theme.colors.action.primary.background`:

   ```tsx
   // Before (still red after theme change)
   background: brand.light.accent,
   '[data-theme="dark"] &': { background: brand.dark.accent },

   // After (picks up the new neutral primary)
   background: theme.colors.action.primary.background,
   ```

3. **Verify no unused `brand` imports remain** after replacements.

Files that commonly need this audit:

- `app/ui/admin-nutzer-page.tsx` — `boolBadgeYes` status badges
- `app/actions/auth-login-controller.tsx` — brand dot, demo box accent, register link
- `app/ui/appointtype-panel.tsx` — context menu items, add button border

## Why

The Remix 3 `createTheme` contract exposes two separate color systems:

- `theme.colors.action.*` — for interactive elements (primary/secondary/danger button tones)
- `brand.light.accent` / `brand.dark.accent` — standalone brand palette constants, used as raw CSS values outside the theme contract

Both exist independently. A change to one does NOT propagate to the other.
A full UI color overhaul requires auditing BOTH systems.
