## Why

The appointment booking wizard at `/appointments/new` is currently only accessible via the mobile nav drawer ("Neuer Termin" CTA), while the desktop nav points to the older grid-based booking page at `/appointment`. This creates an inconsistent experience — users on desktop cannot easily reach the newer, standard appointment flow. Making `/appointments/new` the default "Termine" entry and moving the old grid to a secondary label unifies the UX across breakpoints.

## What Changes

- **Desktop nav**: Change "Termine" link from `/appointment` to `/appointments/new` so the new wizard is the default on all screen sizes
- **Mobile nav**: Keep "Neuer Termin" CTA pointing to `/appointments/new` (no change needed)
- **Old booking page**: Add a new nav entry labeled "TermineUI" pointing to `/appointment` (visible on both desktop and mobile, not admin-only)
- Remove the old "Termine" label pointing to `/appointment` from desktop nav
- Update the `MOBILE_ITEMS` array to also include a "TermineUI" entry
- Update nav tests to reflect the new labels and hrefs

## Capabilities

### New Capabilities

- _(none — this is a nav data reorganization, no new capability)_

### Modified Capabilities

- `mobile-nav`: The mobile nav drawer gains a "TermineUI" link to the old grid-based booking page alongside the "Neuer Termin" CTA

## Impact

- `app/ui/nav.ts` — `NAV_SECTIONS` and `MOBILE_ITEMS` data changes
- `app/ui/nav.test.ts` — update test assertions for new labels/hrefs
- No route, controller, or component logic changes — purely nav data + tests
