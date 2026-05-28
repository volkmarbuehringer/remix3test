## Context

The `appointments` table currently has a global exclusion constraint `no_overlapping_seats` that prevents any two appointments from overlapping on the same `date` with the same `during` (int4range). This means only one appointment can exist at any given time slot globally.

There is no concept of a "resource" (room, equipment, staff member). The appointment sidebar has year/week selectors and a grid view, but no resource filtering.

## Goals / Non-Goals

**Goals:**
- Create a `resources` table as a lightweight entity with `id`, `description`, `created_at`, `updated_at`
- Add `resource_id` (NOT NULL FK) to `appointments` — existing data is truncated on startup
- Scope the exclusion constraint to per-resource: `(resource_id WITH =, date WITH =, during WITH &&)` so two appointments for different resources CAN overlap
- Add a resource dropdown in the appointment sidebar to filter the calendar view
- Seed a single resource "resource1"
- Update appointment CRUD to accept/return `resource_id`

**Non-Goals:**
- Full resource CRUD UI (no create/edit/delete of resources in the UI; only seed + dropdown selection)
- Multi-resource assignment per appointment
- Resource availability / booking rules beyond overlap prevention

## Decisions

### Decision: resource_id as NOT NULL FK
**Rationale**: The appointments table will be dropped and recreated (all existing data is truncated). This makes `resource_id` NOT NULL straightforward — no migration of existing rows needed. Every new appointment MUST belong to a resource.

**Alternatives considered**: 
- Nullable FK → unnecessary complexity; no existing data to preserve.
- Not adding resource_id → blocks don't know which resource they belong to.

### Decision: Use `btree_gist` extension for the combined constraint
**Rationale**: PostgreSQL's GiST indexes support btree-included columns via the `btree_gist` extension (already enabled in setup.ts). The new constraint will be:
```sql
CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (
  resource_id WITH =,
  date WITH =,
  during WITH &&
)
```

### Decision: Resource dropdown in sidebar, not the grid header
**Rationale**: The sidebar is where all week navigation lives (year, week pickers). Adding the resource filter there keeps all filtering in one place. The dropdown changes the current selection and reloads the page via URL param like `?resource_id=N`.

### Decision: Filter appointments by resource_id in the list query
**Rationale**: The controller already calls `listAppointmentsByWeek()`. Adding an optional `resource_id` filter to that query (when selected) keeps the data layer simple.

## Risks / Trade-offs

**[Risk] Appointments table is recreated (truncated)** → All existing appointment data is lost on startup. Mitigation: Acceptable per requirements; this is a clean break since the schema changes fundamentally.

**[Action] Drop and recreate appointments table** → Use `DROP TABLE IF EXISTS appointments CASCADE` followed by `CREATE TABLE` with the new schema. The DROP will wipe the old constraint automatically.

**[Trade-off] No resource CRUD in this change** → Resources are initially managed via seed only. Adding a resource management UI can be done later without schema changes.
