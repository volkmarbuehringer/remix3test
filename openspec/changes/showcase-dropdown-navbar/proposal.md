## Why

The top navbar's Showcase section (Overview, Button, Form, Theme Tokens) currently renders as four separate links in the nav bar. As more showcase pages are added, this list will grow and crowd the navbar, especially on narrower viewports. Collapsing these into a single dropdown menu labeled "Showcase" keeps the navbar compact while preserving access to all showcase pages.

## What Changes

- Replace the inline Showcase links in the navbar with a single "Showcase" button that opens a dropdown menu on click
- The dropdown lists all showcase items (Overview, Button, Form, Theme Tokens) as clickable links
- The dropdown is positioned below the "Showcase" button in the nav bar
- The existing Pages section (Home, AI, Admin) remains unchanged
- The existing nav data structure (`NAV_SECTIONS` in `nav.ts`) is preserved — only the rendering changes

## Capabilities

### New Capabilities
- `showcase-dropdown`: Dropdown menu for the Showcase section in the top navigation bar

### Modified Capabilities
- (none — this changes rendering only, not behavioral requirements of existing specs)

## Impact

- `app/ui/layout.tsx` — the Showcase section rendering changes from inline links to a dropdown with toggle behavior and menu panel
- `app/ui/nav.ts` — unchanged (data structure preserved)
- No new dependencies
- No breaking changes
