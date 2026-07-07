## 1. Read-Only Data Tools

- [x] 1.1 Add `get_resource_details` tool — lookup resource by ID or name, returns name/description/timestamps
- [x] 1.2 Add `get_offerings_for_date` tool — returns offering slots for a date, joined with resource names
- [x] 1.3 Add `search_appointments_by_date_range` tool — appointments between start/end date, max 50, max 90-day range
- [x] 1.4 Add `get_user_appointments` tool — all appointments for a user ID, most recent 50
- [x] 1.5 Add `get_appointment_details` tool — full details for one appointment by ID with user/resource names
- [x] 1.6 Add `get_offering_config_for_resource` tool — offering config rules for a resource ID
- [x] 1.7 Add `get_appoint_types` tool — list all appointment type IDs and titles
- [x] 1.8 Add `search_messages` tool — search messages by content or sender ID, max 50
- [x] 1.9 Add `get_admin_stats` tool — aggregate counts: users by role, appointments, resources, messages

## 2. Side-Effect Tools

- [x] 2.1 Add `lookup_holiday` tool — check if a date is a holiday using date-holidays (DE-RP)
- [x] 2.2 Add `generate_pdf_report` tool — generate predefined report PDFs (appointment-list, user-list) using pdfmake
- [x] 2.3 Add `get_location_context` tool — return static location data for Ransbach-Baumbach

## 3. Agent Configuration

- [x] 3.1 Update agent instructions in `support-agent.ts` — document all new tools in the instructions text
- [x] 3.2 Remove the blanket "Do NOT generate, modify, or delete any data" rule from agent instructions

## 4. Tests

- [x] 4.1 Add unit tests for each new tool in `controller.test.ts`
- [x] 4.2 Run `npm t` to verify existing tests still pass
- [x] 4.3 Run `npm run typecheck` to verify no type errors

## 5. Code Review Fixes

- [x] 5.1 Fix pdfmake widths/columns mismatch (5 cells vs 4 widths)
- [x] 5.2 Add row caps and 90-day range limit to `generatePdfReport` queries
- [x] 5.3 Fix `getAdminStats` silent date filter drop on partial/invalid input
- [x] 5.4 Restore refined "no data mutation" guardrail in agent instructions
- [x] 5.5 Fix `searchMessages` INNER JOIN → LEFT JOIN for consistency
- [x] 5.6 Fix `getOfferingConfigForResource` JSON.parse exception safety
- [x] 5.7 Run `npm t` and `npm run typecheck` to verify fixes
