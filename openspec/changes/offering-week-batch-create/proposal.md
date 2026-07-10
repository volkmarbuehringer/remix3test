## Why

Creating offerings manually one day at a time is tedious for recurring weekly schedules. Admins need to set up regular availability patterns (e.g., "Mon–Fri 09:00–17:00") quickly without 22+ individual form submissions per month.

## What Changes

- New `offering_configs` table with JSONB column storing per-resource weekly rules (day name → time range in minutes)
- New data access module `app/data/offering-configs.ts` for CRUD + generation
- New "Add Week" button on the admin offerings grid, opening a sidebar form with resource, year, and week dropdowns
- Backend generation action that reads a resource's config, iterates over each day in the selected ISO week, skips public holidays (DE, rp using `date-holidays`), and inserts `appointoffering` rows
- Config editing form (structured UI with day checkboxes and time inputs) accessible from the offerings page
- Preview showing how many offerings will be created and which days are skipped as holidays
- Manual editing of generated offerings remains fully supported — this is a batch input tool, not a replacement for the existing CRUD

## Capabilities

### New Capabilities

- `offering-configs`: Weekly pattern configuration per resource with JSON storage and structured editing UI
- `offering-week-generator`: One-click generation of a full week of offerings from config, with automatic holiday skipping

### Modified Capabilities

- `appointment-calendar`: No requirement changes — existing offering queries work unchanged

## Impact

- **New table**: `offering_configs` — added to schema and DB setup
- **New module**: `app/data/offering-configs.ts` — config CRUD + week generation
- **Controller changes**: `admin-offerings-controller.tsx` — new `createWeek` action, config editing read/update actions
- **UI changes**: `admin-offerings-page.tsx` — "Add Week" button in toolbar, config edit panel, week batch form panel
- **New dependency**: `date-holidays` (already installed)
