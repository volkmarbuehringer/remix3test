## 1. Create the `generate_action_report` tool

- [x] 1.1 Import `generatePdfBuffer` from `app/utils/pdf-utils.ts` in `app/actions/mastra/agents/workflow-agent.ts`
- [x] 1.2 Define `generateActionReport` tool with `createTool` — accept `actionType` param ("cancel"|"lock"|"unlock"), target user, admin, deletion info, and consistency check results
- [x] 1.3 Build the pdfmake document definition with action-specific title, admin details, target user details, action summary, consistency check results, and generated timestamp
- [x] 1.4 Return `{ filename, data: base64, size, reportType }` with action-specific values

## 2. Wire the tool into the workflow agent

- [x] 2.1 Add the tool to the `tools` object in the `workflowAgent` `Agent` constructor
- [x] 2.2 Add the tool to the `workflowAgentTools` export object
- [x] 2.3a Update the agent instructions to describe the new tool with all action types
- [x] 2.3b Add Step 9 to the cancel protocol: after consistency checks, call `generate_action_report` with actionType="cancel"
- [x] 2.3c Add Step 7 to the lock protocol: after consistency checks, call `generate_action_report` with actionType="lock"
- [x] 2.3d Add Step 7 to the unlock protocol: after consistency checks, call `generate_action_report` with actionType="unlock"

## 3. Validate

- [x] 3.1 Run `npm run typecheck` to confirm no type errors
- [x] 3.2 Run `npm test` to confirm existing tests still pass
