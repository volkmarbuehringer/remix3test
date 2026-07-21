## Why

When the workflow agent performs a user management action (cancel, lock, unlock), the admin receives a text summary via chat, but there is no downloadable record of the action. The support agent already has PDF generation for appointment-list and user-list reports. Adding a report PDF to the workflow agent gives admins a printable, shareable document they can save to case files or forward to stakeholders.

## What Changes

- Add `generate_action_report` tool to the workflow agent that produces a PDF summary of a completed cancel, lock, or unlock action
- The report includes: action type, admin who performed the action, target user info, timestamp, appointment deletion info (for cancel only), and consistency check results
- Extend all three user management protocols (cancel, lock, unlock) to include a PDF generation step at the end (after consistency checks)
- Reuse the existing `generatePdfBuffer()` utility from `app/utils/pdf-utils.ts`
- The tool is available in the workflow agent only, not in other agents

## Capabilities

### New Capabilities

- `workflow-agent-action-report`: PDF action summary report for the workflow agent's cancel, lock, and unlock flows. The agent can generate a downloadable PDF containing the target user's information, the performing admin, the action type, relevant details (deleted appointments for cancel), the timestamp, and post-action consistency check results.

### Modified Capabilities

- _(none)_

## Impact

- **Modified files**: `app/actions/mastra/agents/workflow-agent.ts` — add `generate_action_report` tool, update agent instructions to include PDF step in all three protocols
- **No new dependencies**: Reuses existing `pdfmake` and `app/utils/pdf-utils.ts`
- **No new routes or UI**: The PDF is returned as base64 data in the agent's chat response
