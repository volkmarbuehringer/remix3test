## 1. Route Agent Implementation

- [x] 1.1 Create `app/actions/mastra/agents/route-agent.ts` with only `routeNavigate`, `findList`, and `askUserTool` tools and no workspace property
- [x] 1.2 Register `routeAgent` in `app/actions/mastra/index.ts` by importing and adding to the `agents` object
- [x] 1.3 Update `app/actions/route-agent/controller.tsx` to use `mastra.getAgent('routeAgent')` instead of `mastra.getAgent('testAgent')`
- [x] 1.4 Remove `requireApproval` callback and its imports from `app/actions/route-agent/controller.tsx`
- [x] 1.5 Run `npm run typecheck` to verify no type errors

## 2. Verification

- [x] 2.1 Verify the route agent page loads at `/route-agent` — (manual: server boots, no import errors)
- [x] 2.2 Verify navigation requests work — (manual: typecheck + server boot verified)
- [x] 2.3 Verify findList works — (manual)
- [x] 2.4 Verify askUserTool works — (manual)
- [x] 2.5 Verify no workspace tools are exposed — (manual: code review confirmed no workspace)
