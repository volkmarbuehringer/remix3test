## Why

Admins need a compact printable overview of all user accounts with their appointment activity summarized in one line per user. The existing `/verwaltung/pdf` lists every appointment individually, which becomes unwieldy for a bird's-eye view. A per-user summary PDF makes it easy to see at a glance who has how many appointments, total booked time, and activity range.

## What Changes

- **New route** `/verwaltung/users-pdf` — renders a PDF with one row per user account
- Each row shows: user name, email, total appointment count, total booked minutes (HH:MM format), first appointment date, last appointment date
- Admin-only access (same auth as existing PDF route)
- Dashboard card on the Verwaltung home page linking to the new PDF

## Capabilities

### New Capabilities

- `users-pdf-export`: Generate a PDF report listing all user accounts with a per-user appointment summary row. The report is scoped to admin users, uses pdfmake for rendering, and is available as a download endpoint at `/verwaltung/users-pdf`.

### Modified Capabilities

- `verwaltung-dashboard`: The dashboard page gains a new card linking to `/verwaltung/users-pdf` for admin users.

## Impact

- **Routes** (`app/routes.ts`): New `usersPdf` sub-route under `verwaltung`
- **Router** (`app/router.ts`): Import and register the new controller
- **Controller** (`app/actions/verwaltung/users-pdf/controller.tsx`): New PDF endpoint following the same pattern as `verwaltung/pdf/controller.tsx`
- **Dashboard UI** (`app/ui/verwaltung-page.tsx`): New card linking to `/verwaltung/users-pdf`
- **Tests** (`app/actions/verwaltung/users-pdf/controller.test.ts`): PDF download test for admin, 403 for non-admin, redirect for unauthenticated
