## Context

The `supportAgent` in `app/actions/mastra/agents/support-agent.ts` uses tools from `app/actions/mastra/tools/support-tools.ts`. Each tool is a `createTool({...})` with an `inputSchema` (zod v4) and an `execute` function. Tools share the `pool` from `app/data/connection.ts` for database access.

The existing tool pattern is consistent:

```
createTool({
  id: 'snake_case_id',
  description: 'Human-readable description of what the tool does and returns.',
  inputSchema: z.object({ params... }),
  execute: async ({ params }) => {
    let client = await pool.connect()
    try { ... } finally { client.release() }
  },
})
```

New tools will follow the same pattern. No new packages needed — `date-holidays` and `pdfmake` (via `app/utils/pdf-utils.ts`) are already in the dependency tree.

## Goals / Non-Goals

**Goals:**

- Add 9 read-only data tools covering all key system tables (resources, offerings, offering configs, appointment types, messages, admin stats)
- Add `lookup_holiday` tool using date-holidays with DE-RP locale
- Add `generate_pdf_report` tool wrapping the existing pdfmake utility
- Add `get_location_context` tool returning Ransbach-Baumbach as default location
- Update agent instructions to document all new tools
- Keep every existing tool and its behavior intact

**Non-Goals:**

- No write/mutation tools (no INSERT/UPDATE/DELETE)
- No new routes, controllers, or UI
- No changes to the Mastra instance setup, storage, memory, or scorers
- No streaming chat

## Decisions

### Decision 1: Inline tools in support-tools.ts (not separate files)

**Chosen:** Add all new tools to the existing `support-tools.ts` file alongside existing tools.

**Rationale:** They all follow the same pattern, share the same pool import, and are always loaded together. Splitting into separate files adds imports and exports without benefit. If the tool count grows beyond ~20, we can split by domain later.

### Decision 2: `get_location_context` returns static data as a tool (not instructions)

**Chosen:** A zero-parameter tool that returns `{ city: "Ransbach-Baumbach", country: "Germany", region: "Rhineland-Palatinate", timezone: "Europe/Berlin" }`.

**Rationale:** Instructions risk being ignored or overridden by the model. A tool is explicit, callable on demand, and returns structured data the model can reference. The agent can call it when it needs location context for weather, timezone, or holiday queries.

### Decision 3: `lookup_holiday` reuses existing date-holidays instance pattern

**Chosen:** Create a new `Holidays('DE', 'RP')` instance inside the tool's execute function (not shared module-level).

**Rationale:** The date-holidays constructor is lightweight and stateless. A local instance avoids coupling to the existing one in `offering-configs.ts` and keeps the tool self-contained.

### Decision 4: `generate_pdf_report` returns a base64-encoded PDF string

**Chosen:** Accept a document definition object, call `generatePdfBuffer()`, and return `{ filename, data: <base64>, size: <bytes> }`.

**Rationale:** The agent can't return binary data directly. Base64 lets the response include the full PDF content, displayable or downloadable from the chat UI if needed.

## Risks / Trade-offs

| Risk                                                 | Mitigation                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tool descriptions too vague → model picks wrong tool | Write specific, testable descriptions. Each tool description includes example queries that should trigger it.                                                |
| LLM timeout with large result sets                   | All read tools use `LIMIT` (default 20-50). The `search_appointments_by_date_range` tool requires both `startDate` and `endDate` to prevent unbounded scans. |
| `generate_pdf_report` could generate expensive PDFs  | Accept only a small set of predefined report types (appointment list, user list) rather than arbitrary document definitions.                                 |
| Tool count grows unwieldy                            | Current count: 5. After change: ~14. Still manageable in one file. Revisit at ~20.                                                                           |
