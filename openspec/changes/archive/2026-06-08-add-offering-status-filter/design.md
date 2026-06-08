## Context

The offerings admin page at `/verwaltung/offerings` shows a table of `appointoffering` rows with search, period filtering, sorting, and pagination. The filter bar uses the same `<form method="GET" rmx-target={frames.adminContent}>` pattern as appointments. The `GridState`, URL helpers (`buildSortUrl`, `buildPaginationUrl`, `buildCreateUrl`, `buildEditUrl`, `buildCancelUrl`), and `GridStateHiddenInputs` already support the `status` parameter from the previous appointments implementation — no changes needed to those shared utilities.

## Goals / Non-Goals

**Goals:**
- Add a button group to the offerings filter bar with "Ausstehend" (pending) and "Abgelaufen" (expired) options
- Default to pending when no `status` param is present (show offerings with `ao.day >= now`)
- When expired is selected, show offerings with `ao.day < now`
- Preserve `status` across pagination, sorting, period filtering, search, grid state, and all redirects
- Match the exact same UI pattern as the appointments status toggle

**Non-Goals:**
- No changes to shared utilities (`grid-state.ts`, URL helpers) — already done
- No database schema changes
- No changes to other admin pages

## Decisions

1. **Replicate the appointments status toggle pattern exactly**
   - Same anchor-link button group style (primary/secondary tones, merged borders)
   - Placed between the period buttons and the action row (below the filter bar)
   - Same URL param handling: `status=pending` (or absent) / `status=expired`
   - This keeps UI consistent across verwaltung pages and reuses established patterns

2. **SQL filtering using `ao.day` column**
   - `status=pending` → `WHERE ao.day >= NOW()` (epoch ms comparison)
   - `status=expired` → `WHERE ao.day < NOW()`
   - ANDed with existing search and period WHERE clauses
   - The existing SQL builder uses a simple filter+period pattern without a `hasWhere` helper; I'll follow the existing `if (filter) ... else if (period) ...` style, adding a third `if (status)` block that checks whether WHERE has already been introduced

3. **Default to pending when no status param is provided**
   - Same as appointments: when `status` is unset, default to pending

## Risks / Trade-offs

- [Risk] The `status` filter interacts with `period` and `search` — all three are ANDed together, which is valid SQL. A user who searches while on "expired" mode sees expired results matching their search within the selected period.
- [Trade-off] Reusing the exact same button group markup as appointments means duplicating the `buildPeriodUrl`-style URL construction inline. A shared component could reduce duplication, but the existing codebase doesn't abstract these toggle groups and the pattern is only used in two places.
