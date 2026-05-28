## Context

Admin offerings are currently created one-at-a-time via a sidebar form at `/admin/offerings`. Setting up a recurring weekly schedule (e.g., Mon–Fri 09:00–17:00) requires 5+ form submissions per week. The `offering_configs` table adds a per-resource weekly pattern that can generate a full week of offerings in one click, skipping public holidays automatically.

The existing `appointoffering` table remains the source of truth for availability — the config is a batch input tool, not a replacement. Manual CRUD continues working.

## Goals / Non-Goals

**Goals:**
- Per-resource config storing weekly time ranges as JSONB
- One-click generation of a full ISO week's offerings from config
- Automatic holiday skipping using existing `date-holidays` (DE, rp)
- Preview showing number of offerings to be created
- Structured config editing UI (day checkboxes + time inputs)
- "Add Week" button in the offerings grid toolbar, opening a sidebar form

**Non-Goals:**
- Auto-generation on schedule (no cron job, no future auto-fill)
- Recurrence rules beyond the current `offering_configs` model (no seasonal configs, no exceptions list)
- Removal or replacement of existing single-offering CRUD
- Changes to `listOfferingsByWeek` or `isSlotBookable`

## Decisions

### Table structure: `offering_configs`

```sql
CREATE TABLE IF NOT EXISTS offering_configs (
  id SERIAL PRIMARY KEY,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  rules JSONB NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE (resource_id)
)
```

One row per resource. The `UNIQUE (resource_id)` constraint enforces one config per resource.

### JSONB format

```json
{
  "monday":    [540, 1020],
  "wednesday": [540, 1200]
}
```

- Keys are lowercase English day names (`monday`–`sunday`)
- Values are `[startMin, endMin]` in minutes from midnight (matching existing `start_min`/`end_min` convention)
- A day with no entry = no offerings generated for that weekday

### Generation algorithm

```
generateWeek(resourceId, year, week):
  1. Load config for resourceId
  2. Compute Monday 00:00 UTC of the ISO week
  3. For each day 0–6 (Mon–Sun):
     a. Get day name → lookup in config.rules
     b. If no rule → skip
     c. If hd.isHoliday(day) → skip (record as skipped for preview)
     d. Check if offering already exists for this day + resource + during range
     e. INSERT into appointoffering
  4. Return { created: N, skipped: M, errors: [...] }
```

### Conflict strategy

If an offering already exists for the same resource+day+during range, skip it. This prevents duplicate rows from repeated "Add Week" clicks. An existing offering with a DIFFERENT time range is NOT touched — it stays (manual edits preserved). The generation only creates new rows for time ranges that don't exist yet.

### Config editing UI

A structured form (not raw JSON textarea):
- Resource dropdown (select which resource to configure)
- 7 rows of day checkboxes with start/end time dropdowns
- Save button

The config form is accessible via the offerings page, shown when `?config=<resourceId>` is set in the URL.

### "Add Week" form

Sidebar panel triggered by "Add Week" button in the toolbar:
- Resource dropdown
- Year dropdown (e.g., 2026–2030)
- Week dropdown (ISO week numbers with date range display, e.g., "KW 23 — 1. Jun – 7. Jun")
- Preview section showing generated days (with holiday skip indicators)
- "Erstellen" button

### API routes

```
POST /admin/offerings/week       → generateWeek action
POST /admin/offerings/config     → saveConfig action
GET  /admin/offerings/config/:id → getConfig action (for form pre-fill)
```

New URL params:
- `?config=<resourceId>` → opens config editing panel
- `?addweek=true` → opens week batch creation panel

## Risks / Trade-offs

- **Stale config after resource deletion**: Handled by `ON DELETE CASCADE` on `resource_id` FK
- **Duplicate offerings across repeated generations**: Mitigated by checking existing rows before insert
- **Config not covering all days**: That's by design — partial week configs are valid (e.g., only Mon+Wed)
- **Timezone edge cases**: ISO weeks are UTC-based, matching existing seed data convention
