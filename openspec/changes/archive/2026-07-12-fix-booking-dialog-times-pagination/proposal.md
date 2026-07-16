## Why

The customer agent's booking dialog has two visual bugs that prevent users from completing bookings: time labels on slot buttons are invisible in dark mode (CSS variable mismatch), and the slot picker dumps all available slots at once with no pagination, making it unwieldy for resources with many time slots.

## What Changes

- Fix CSS variable names and add explicit `color` to slot buttons so times are visible in both light and dark themes
- Add client-side DOM pagination to the slot picker: show a configurable number of slots per page with "← Zurück" / "Weiter →" navigation
- The agent receives only the selected slot — it never knows about pagination

## Capabilities

### New Capabilities

- `booking-dialog-pagination`: Client-side pagination controls for the slot picker in the customer chat stream

### Modified Capabilities

- (none — slot picker UI lives entirely in the clientEntry, no spec-level behavior change)

## Impact

- `app/assets/customer-chat-stream.tsx` — slot button styling (CSS variables, explicit color) and `appendSlotPicker`/`renderSlotButtons` (add page wrapping, prev/next controls)
- No server-side, tool, or data layer changes
- No API contract changes
