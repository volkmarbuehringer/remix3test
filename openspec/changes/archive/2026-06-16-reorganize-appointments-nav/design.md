## Context

The nav data is defined in `app/ui/nav.ts` with two exports:
- `NAV_SECTIONS` — desktop nav items (one section, flat list of links)
- `MOBILE_ITEMS` — mobile drawer items (action-oriented, with auth guards and CTA styling)

Currently "Termine" in the desktop nav points to `/appointment` (the old grid booking page), while the mobile nav has "Neuer Termin" pointing to `/appointments/new` (the new booking wizard) as a CTA. The old `/appointment` route has no mobile nav entry, and the new wizard has no desktop nav entry.

No route, controller, or handler changes are needed — only nav data and tests.

## Goals / Non-Goals

**Goals:**
- Change the "Termine" desktop nav link from `/appointment` to `/appointments/new`
- Add "TermineUI" nav entry pointing to `/appointment` in desktop nav only
- Keep "Neuer Termin" CTA in mobile drawer unchanged; no mobile TermineUI entry
- Update nav tests to match new structure

**Non-Goals:**
- No route definition changes in `app/routes.ts`
- No controller or handler changes
- No UI component changes outside nav data
- No permission or auth logic changes

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Label for old route | "TermineUI" | Distinct from "Termine" to avoid confusion; `UI` suffix signals it's the older grid UI |
| "TermineUI" in mobile drawer | Not included | Keeps mobile drawer focused on primary actions; old grid is desktop-only |
| "TermineUI" auth requirement | Not applicable (desktop only) | Desktop nav has no auth filtering; publicly accessible |
| `NAV_SECTIONS` structure | Flat list in one section (unchanged) | No structural nav change, just swapping one href and adding one item |

## Risks / Trade-offs

- **Short-term label confusion**: Users accustomed to "Termine" → old grid may need a moment to adjust. Mitigation: "TermineUI" is clearly a secondary entry.
- **Test brittleness**: Tests assert exact labels and hrefs; they must be updated atomically with the nav data to avoid CI failures.
