## Why

Appointments currently have no concept of a "resource" (e.g., room, equipment, staff member). All appointments share the same overlap constraint globally, making it impossible to schedule multiple appointments at the same time for different resources. Adding a resource table enables per-resource scheduling — each resource gets its own independent schedule with overlap prevention scoped to that resource.

## What Changes

- **New `resources` table** with columns: `id` (SERIAL PK), `description` (TEXT NOT NULL), `created_at` (BIGINT), `updated_at` (BIGINT)
- **Add `resource_id` column** to the `appointments` table (FK → resources, NOT NULL)
- **Update exclusion constraint** on `appointments` to include `resource_id`, so overlap prevention is per-resource rather than global
- **UI resource dropdown** in the appointment sidebar at `/appointment` — allows users to filter the calendar view by resource
- **Seed data**: one initial resource with description "resource1"
- **Appointment CRUD** updated to accept/pass `resource_id` for create and update operations

## Capabilities

### New Capabilities
- `resource-management`: Create, list, and select resources for appointment scheduling. Resources are simple descriptors (rooms, equipment, staff) that scope the overlap constraint. Initially seeded with a single resource.

### Modified Capabilities
- `appointment-calendar`: The exclusion constraint changes from global (`date`, `during`) to per-resource (`resource_id`, `date`, `during`). The appointment sidebar gains a resource dropdown for filtering. The appointments table gains `resource_id` FK column.

## Impact

- **Schema**: New `resources` table, `resource_id` column on `appointments`, modified exclusion constraint, new foreign key
- **Data layer** (`app/data/schema.ts`): New `resources` table definition, `resource_id` added to `appointments` table definition
- **DB init** (`app/data/setup.ts`): New table creation, `appointments` table recreated (truncated) with new constraint, seed data
- **Appointment controller** (`app/actions/appointment-controller.tsx`): Pass `resource_id` through create/update flows, filter list query
- **Appointment data access** (`app/data/appointments.ts`): Accept `resource_id` in input types and queries
- **Appointment sidebar** (`app/ui/appointment-sidebar.tsx`): New resource dropdown for filtering
- **Appointment page** (`app/ui/appointment-page.tsx`): Pass resource data to the page
- **Appointment grid** (`app/ui/appointment-grid.tsx`): Read/write `resource_id` on appointment blocks
