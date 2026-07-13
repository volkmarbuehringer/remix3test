## 1. Extend findList tool

- [x] 1.1 Add optional `sort`, `limit`, `offset` params to the `findList` tool input schema in `app/actions/mastra/tools/route-find-list.ts`
- [x] 1.2 Update the SQL query in `route-find-list.ts` to handle `sort` (ORDER BY), `limit` (LIMIT + 1 for hasMore), and `offset` (OFFSET)
- [x] 1.3 Add `hasMore` field to the `findList` return value

## 2. Add ids support to lists data layer

- [x] 2.1 Add `getListsByIds(db, ids, userId)` function to `app/data/lists.ts` that returns rows in the given ID order, scoped by user ownership

## 3. Add ids query param to lists controller

- [x] 3.1 Parse the `ids` query param in the `index` action of `app/actions/lists/controller.tsx` — parse comma-separated integers, validate numeric
- [x] 3.2 When `ids` is present, call `getListsByIds` instead of `getAllLists`; ignore `filter`, `offset`, and `limit` params
- [x] 3.3 Render sidebar entries in the same order as the `ids` parameter

## 4. Update route agent behavior

- [x] 4.1 Update agent instructions in `app/actions/mastra/agents/route-agent.ts` to describe the new pattern: `findList` → multi-result navigates to `/lists?ids=...`, single-result navigates to `/lists?load=...`, zero results uses `askUserTool`
- [x] 4.2 Run typecheck and verify no regressions — clean (tsc --noEmit passes)

## 5. Verify

- [ ] 5.1 Manual: send "show me the shopping lists" to route agent → verify sidebar shows only matching lists
- [ ] 5.2 Manual: send "show me the 10 newest lists" to route agent → verify sidebar shows 10 newest
- [ ] 5.3 Manual: click a list in the ids-filtered sidebar → verify sidebar returns to full list set
- [x] 5.4 Run `npm run typecheck` — clean
