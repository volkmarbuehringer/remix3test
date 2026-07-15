## 1. Offering Config Controller — Agent Mode

- [x] 1.1 Add `X-Agent-Thread` detection at the top of the `create` action, mirroring `resources/controller.tsx:189-224`
- [x] 1.2 In agent branch: parse schema, return `{ status: "validation_error", issues, threadId }` on failure
- [x] 1.3 In agent branch: validate resource_id (exists, not duplicate, has rules), return `{ status: "validation_error", issues: [{ message: "..." }], threadId }` on custom validation failures
- [x] 1.4 In agent branch: create the offering config row, log admin action, return `{ status: "created", data: { id, resource_id, rules }, threadId }` on success

## 2. Integration Test

- [x] 2.1 Add test case in `app/actions/verwaltung/offering-configs.test.ts`: create a resource via controller POST, extract its ID
- [x] 2.2 Create an offering config via agent-mode POST (`X-Agent-Thread` header) with the resource ID
- [x] 2.3 Assert JSON response has `status: "created"` with the correct `resource_id`
- [x] 2.4 Verify both records exist in the database
- [x] 2.5 Add test case for agent-mode validation error (e.g., missing resource_id)

## 3. Route Agent Instructions

- [x] 3.1 Update `route-agent.ts` instructions: add chaining pattern after resource creation to navigate to offering config form with prefilled `resource_id`
