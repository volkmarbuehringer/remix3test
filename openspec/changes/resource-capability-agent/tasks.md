## 1. Database & Schema

- [x] 1.1 Add migration in `app/data/migrate.ts`: `ALTER TABLE resources ADD COLUMN IF NOT EXISTS capabilities TEXT DEFAULT ''`. Enable `pg_trgm` extension if not already enabled. Add GIN trigram index on `resources.capabilities`.
- [x] 1.2 Update `app/data/schema.ts`: add `capabilities: c.text()` to the resources table definition and update the `Resource` type.

## 2. Admin UI: Capabilities Textarea

- [x] 2.1 In `app/ui/admin-resources-page.tsx`, add a new `<textarea>` (4 rows) labeled "Capabilities" in both the create and edit panels, below the existing description field. Include error display and form value preservation.
- [x] 2.2 In `app/actions/verwaltung/resources/controller.tsx`, extend `RESOURCE_FORM_KEYS` to include `'capabilities'`. Extend `resourceSaveSchema` to include a `capabilities` field (`s.defaulted(s.string(), '')`). Update the CRUD handlers (`create`, `update`) to read/write `capabilities` alongside name and description.

## 3. Customer Agent: Tools

- [x] 3.1 Create `app/actions/mastra/tools/customer-tools.ts` with a `searchResourcesByCapability` tool that accepts a free-text query string and returns resources whose `capabilities` match via ILIKE. Returns id, name, description, and capabilities.

## 4. Customer Agent: Agent Definition

- [x] 4.1 Create `app/actions/mastra/agents/customer-agent.ts` with a new `Agent` instance. Instructions: responds in German, uses `searchResourcesByCapability` tool, read-only, recommends best resource or says none found, refuses booking requests.
- [x] 4.2 Register `customerAgent` in the Mastra orchestrator at `app/actions/mastra/index.ts` alongside `supportAgent`.

## 5. Customer Chat Route

- [x] 5.1 Add a new top-level route in `app/routes.ts`: `chat: form('chat')`.
- [x] 5.2 Create `app/actions/chat/controller.tsx`: GET renders customer chat UI, POST calls `customerAgent.generate()`, middleware is `requireAuth()` (not admin). Separate rate limiter for customer (3s window).
- [x] 5.3 Create `app/ui/customer-chat-page.tsx` — simplified chat UI without admin sidebar.

## 6. Testing

- [x] 6.1 Add tests for `customer-tools`: `searchResourcesByCapability` returns matching resources, empty for no match, edge cases.
- [x] 6.2 Add tests for chat controller: GET requires auth, POST success, rate limiting, thread continuation.
- [x] 6.3 Update resources controller tests to cover the new `capabilities` field.

## 7. Future (Post-Change)

- [ ] 7.1 (Future) Create a Mastra Workflow that composes capability matching with appointment booking.
