## 1. Stream Store

- [x] 1.1 Create `app/utils/stream-store.ts` with typed `Map<string, MastraModelOutput>`, `get`/`set`/`delete` exports, and TTL cleanup via `setTimeout`
- [x] 1.2 Write unit tests for store lifecycle (set, get, delete, TTL expiry)

## 2. Tools

- [x] 2.1 Create `app/actions/mastra/tools/test-tools.ts` with `list_test_files` tool using `fs.readdir` (names only, no content) and path-traversal guard
- [x] 2.2 Add `read_test_file` tool using `fs.readFile` with path-traversal guard

## 3. Agent

- [x] 3.1 Create `app/actions/mastra/agents/test-agent.ts` with instructions, model config (matching `support-agent.ts`), and tools from step 2
- [x] 3.2 Register `testAgent` in `app/actions/mastra/index.ts`

## 4. Route + Controller

- [x] 4.1 Add `testAgent` route definition to `app/routes.ts` (index, action, stream, approve, decline)
- [x] 4.2 Create `app/actions/test-agent/controller.tsx` with `index` (GET render), `action` (POST validate + stream + store), `stream` (GET SSE pipe), `approve` and `decline` actions (resume + store new output)
- [x] 4.3 Wire `testAgent` controller to `app/router.ts` via `router.map()`

## 5. UI

- [x] 5.1 Create `app/ui/test-agent-page.tsx` with message list area, streaming form, and `clientEntry` that manages the full lifecycle (fetch POST → EventSource → token DOM append → approval card → approve/decline POST → new EventSource)
- [x] 5.2 Add `clientEntry` component with `on` mixin handlers for submit, approval buttons, and SSE event processing

## 6. Integration

- [x] 6.1 Write controller integration test for GET /testagent, POST message, and SSE stream endpoint
- [x] 6.2 Verify `list_test_files` streams without suspension (tool unit test)
- [x] 6.3 Verify `read_test_file` produces suspension → approval → continuation flow (tested via requireToolApproval config)
- [x] 6.4 Verify path-traversal guard rejects `../`
