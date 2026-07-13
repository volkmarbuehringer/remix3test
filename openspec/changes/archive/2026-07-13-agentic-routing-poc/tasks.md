## 1. Navigate Tool

- [x] 1.1 Create `app/actions/mastra/tools/route-navigate.ts` with `createTool({ id: 'navigate', inputSchema: z.object({ path: z.string(), query: z.record(z.string(), z.string()).optional() }), execute: async ({ path, query }) => ({ type: 'route', path: path + qs }) })`
- [x] 1.2 Register `routeNavigate` in testAgent's `tools` object and add navigate to its instructions

## 2. Route + Controller

- [x] 2.1 Add `routeAgent: route('route-agent', { index: get('/'), action: post('/'), stream: get('/stream/:runId'), approve: post('/approve'), decline: post('/decline'), answer: post('/answer') })` to `app/routes.ts`
- [x] 2.2 Create `app/actions/route-agent/controller.tsx` with index (renders page), action (validates, calls testAgent.stream, stores stream, returns runId), stream (forwards SSE events from stored stream), approve/decline/answer (proxy to testAgent)
- [x] 2.3 Wire `router.map(routes.routeAgent, routeAgent)` in `app/router.ts`

## 3. UI Page

- [x] 3.1 Create `app/ui/route-agent-page.tsx` rendering an iframe for content and a persistent input bar at the bottom
- [x] 3.2 Create `app/assets/route-agent-stream.tsx` clientEntry that POSTs to `/route-agent`, opens SSE, catches `tool-result` with `result.type === 'route'`, and navigates the iframe via `document.getElementById('route-agent-frame').src`

## 4. Verify

- [x] 4.1 `npm run typecheck` passes
- [x] 4.2 Manual test: open `/route-agent`, type "show me the lists", verify frame navigates to `/lists` — NOTE: switched from iframe to Remix Frame to avoid X-Frame-Options blocking
- [x] 4.3 Manual test: type "show me list 5" (or similar navigate intent), verify frame navigates to `/lists?load=5`
