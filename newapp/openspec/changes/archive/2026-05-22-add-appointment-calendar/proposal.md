## Why

The app needs a place for users to manage their weekly appointments — a visual calendar where they can see their week at a glance, add time blocks, and organize their schedule. This is one of the most common patterns in productivity apps, and the Timeboxer demo demonstrates a polished implementation that can be adapted.

## What Changes

- Add `appointments` table to the database schema with columns: `id`, `user_id`, `title`, `date`, `start_min`, `end_min`, `created_at`, `updated_at`
- Create a new `/appointment` route accessible to all authenticated users
- Build a sidebar layout with year (2026–2030) and week number dropdowns to navigate weeks
- Implement a weekly grid view showing the 7 days of the selected week with time slots
- Support CRUD on appointments: create (click empty slot), read (grid view), update (drag/resize/inline edit), delete (sidebar button)
- Add "Appointment" link to the main navigation

## Capabilities

### New Capabilities
- `appointment-calendar`: Weekly calendar view with drag-and-drop grid for managing appointments, week navigation via year/week pickers

### Modified Capabilities

<!-- No existing specs are modified. -->

## Impact

- **New table**: `appointments` added to PostgreSQL schema (auto-created on startup)
- **New route**: `/appointment` with auth middleware
- **Route files**: `routes.ts` gets new route entry, `router.ts` gets new controller mapping
- **New files**: controller, page component, UI components (grid, sidebar), data layer
- **Navigation**: `nav.ts` gets a new "Appointment" nav item
- **No new dependencies**: uses existing Remix 3 UI primitives (`clientEntry`, `css`, `theme`, grid layout)
