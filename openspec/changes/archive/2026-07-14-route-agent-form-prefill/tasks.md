## 1. SSE Protocol: Extend navigate event with prefill

- [x] 1.1 Extend `routeNavigate` tool's `execute` to accept optional `data` parameter and include it in the return value as `{ type: 'route', path, data }`
- [x] 1.2 Update `filterAndForward` in route-agent controller to forward `data` from tool result as `prefill` field on the `navigate` SSE event

## 2. Client: Prefill store and Frame injection

- [x] 2.1 Add a `Map<string, Record<string, string>>` prefill store in `entry.tsx` scope, keyed by threadId
- [x] 2.2 Update `handleNavigate` in route-agent-stream to store prefill data when present in navigate event
- [x] 2.3 Update `resolveFrameResponse` in entry.tsx to check prefill store, inject `X-Agent-Prefill` header (base64 JSON), and consume (delete) the entry

## 3. Controller: Read and render prefill values

- [x] 3.1 Add a `readAgentPrefill` utility that decodes the `X-Agent-Prefill` header and returns typed values
- [x] 3.2 Update the resource controller's `index` action to read prefill and merge into `formValues` when rendering create form
- [x] 3.3 Verify validation errors preserve user edits over prefill (existing behavior, no change needed — just confirm)

## 4. Agent: Prefill extraction instructions

- [x] 4.1 Update route agent instructions with rules for extracting resource name from "create a resource called {name}" patterns
- [x] 4.2 Add instruction that agent navigates with `data: { name }` when it has extracted a name

## 5. Test

- [ ] 5.1 Verify end-to-end: agent command "create a resource called {name}" pre-fills the name field in the Frame form
- [ ] 5.2 Verify prefill is one-shot (navigating away and back shows blank form)
- [ ] 5.3 Verify user edits survive validation errors
