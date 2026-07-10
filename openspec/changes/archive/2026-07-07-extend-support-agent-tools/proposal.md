## Why

The support agent currently answers admin questions about users and appointments, but its tool set is limited to 5 read-only DB queries + weather. Admins frequently need data from other system tables (resources, offerings, offering configs, appointment types, messages), aggregate statistics, PDF reports, and holiday-aware scheduling context. Adding these tools in one batch makes the agent a genuinely useful admin assistant instead of a narrow query bot.

## What Changes

- Add 9 new read-only data lookup tools covering resources, offerings, offering configs, appointment types, messages, admin stats, and richer appointment queries
- Add `lookup_holiday` tool using the existing `date-holidays` dependency (DE-RP locale)
- Add `generate_pdf_report` tool using the existing `pdfmake` utility
- Add `get_location_context` tool that tells the agent the default location (Ransbach-Baumbach, DE) for weather and timezone queries
- Update agent instructions to include the new tools and remove the blanket "Do NOT generate, modify, or delete any data" rule (still no mutation tools — read-only is preserved)
- No UI changes, no new routes, no new controllers

## Capabilities

### New Capabilities

- `support-agent-tools`: The full tool set available to the support agent, covering read queries on all system tables, holiday lookup, PDF generation, and location context

### Modified Capabilities

- _(none)_

## Impact

- **Modified files**: `app/actions/mastra/tools/support-tools.ts` (add ~12 new tools), `app/actions/mastra/agents/support-agent.ts` (update instructions)
- **No new dependencies**: All new tools reuse existing packages (pg pool, date-holidays, pdfmake) or built-in APIs (fetch, Intl)
- **No new routes or UI**: Agent entry point stays at `POST /mastra/chat`
