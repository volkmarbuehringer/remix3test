## Context

The workflow agent in `app/actions/mastra/agents/workflow-agent.ts` handles user account management (cancel, lock, unlock) with a multi-step protocol. After completing an action and running consistency checks, the agent reports results as text. There is no way to produce a downloadable record.

The support agent already has a `generatePdfReport` tool in `app/actions/mastra/tools/support-tools.ts` that generates appointment-list and user-list PDFs using `pdfmake` via `app/utils/pdf-utils.ts`. The workflow agent does not import or use PDF generation.

The workflow agent defines its tools inline in `workflow-agent.ts` (not in `support-tools.ts`). Tools use `db.exec` for SQL queries and workflow executors from `workflow-executor.ts`.

## Goals / Non-Goals

**Goals:**

- Add a `generate_action_report` tool to the workflow agent that produces a PDF summary of any user management action (cancel, lock, unlock)
- The report includes: action type, admin name/email, target user name/email/ID, action-specific details (deleted appointments for cancel), timestamp, and consistency check results
- Extend all three protocol instructions (cancel, lock, unlock) to include calling this tool after consistency checks
- Reuse the existing `generatePdfBuffer()` utility — no new PDF library
- Keep the tool scoped to the workflow agent only

**Non-Goals:**

- No changes to the support agent or its `generatePdfReport` tool
- No new routes, controllers, or UI
- No changes to the underlying workflows (cancel-user-workflow.ts, lock-user-workflow.ts, unlock-user-workflow.ts)

## Decisions

### Decision 1: Single generic `generate_action_report` tool (not per-action)

**Chosen:** One tool with an `actionType` enum param (`"cancel" | "lock" | "unlock"`) that adjusts the PDF title, action description, and inclusion of appointment deletion data.

**Alternatives considered:**

- **Separate tools per action:** Would triple the tool definitions and require the agent to learn three almost-identical tools.
- **Add to the existing `generatePdfReport` in support-tools.ts:** Would couple the two agents.

**Rationale:** A single generic tool is simpler for the agent to learn (one tool, three use cases), DRYer in code, and easy to extend to future action types.

### Decision 2: Accept action details as input parameters (not query at runtime)

**Chosen:** The tool accepts structured input (action type, target user info, admin info, appointment deletion info, consistency results) rather than querying the database at runtime.

**Parameters:**
- `actionType` ("cancel" | "lock" | "unlock")
- `targetUserName`, `targetUserEmail`, `targetUserId`
- `adminName`, `adminEmail`
- `deletedAppointments` (boolean, cancel only), `deletedCount` (number, cancel only)
- `lockedUsersCount`, `activeUsersCount` (from consistency checks)
- `actionedAt` (ISO date string, optional — defaults to now)

**Rationale:** The agent already has all this data from the workflow execution and consistency checks. Passing as parameters avoids redundant queries, keeps the tool stateless, and ensures the PDF reflects exactly what the agent reported.

### Decision 3: Return base64-encoded PDF (consistent with support agent)

**Chosen:** Return `{ filename, data: base64, size, reportType }` where filename is `<actionType>-report-<username>-<date>.pdf` and reportType is `<actionType>-summary`.

**Rationale:** Consistent with the existing `generatePdfReport` tool. The chat UI can present a download link for the base64 data.

### Decision 4: PDF layout adapts to action type

**Chosen:** Single-page document with:
- Title: "Cancellation Report" / "Account Lock Report" / "Account Unlock Report"
- Admin details
- Target user details
- Action summary (action-specific description + appointments deleted for cancel only)
- Post-action consistency check results

**Rationale:** The action type determines the relevant information displayed. Lock/unlock actions don't involve appointment deletion, so that row is omitted.

## Risks / Trade-offs

| Risk | Mitigation |
| ---- | ---------- |
| Tool receives stale/inconsistent data from agent | Input params are passed at call time — the agent calls it immediately after consistency checks, so data is fresh |
| Base64 PDF too large for model context | Reports are small (single page, <50KB). The tool returns the buffer inline, and the agent stream can carry it |
| Admin expects PDF in a specific format | Start with the outlined layout; iteration via future changes |
