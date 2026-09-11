## 1. Derive chatlog sources

- [x] 1.1 Move `tmp/wip-chatlog-source-filter/chatlog-sources.ts` to `app/data/chatlog-sources.ts`, keeping `classifyThreadSourceFor`, `parseSourceFilter`, `countThreadsBySource`, the filter list, and the German labels; verify `npm run typecheck` passes and `grep -r chatlog-sources app` finds the new module (no `tmp/` import remains)
- [x] 1.2 Add `app/data/chatlog-sources.test.ts` covering own-admin => support, other numeric => customer, non-numeric => legacy, unknown filter => all, and count totals; verify the test fails when the classifier's numeric/legacy branch is inverted, then passes

## 2. Extend the memory helpers

- [x] 2.1 Add `ChatThreadSummary` (id, resourceId, createdAt, updatedAt) and return `resourceId` from `listChatThreads` in `app/utils/mastra-memory.ts`; verify typecheck and the existing chatlog tests still pass
- [x] 2.2 Add `messageCount` to `ChatThreadPreview` by reading `total` from the existing bounded preview recall; verify a unit test with a fake memory asserts the count is populated from the same recall call (single recall per thread)
- [x] 2.3 Add `listAllChatThreads(agent, { maxThreads })` doing a bounded paginated sweep of `listThreads` and `getChatThread(agent, threadId)` using `getThreadById`; verify unit tests with a fake memory cover multi-page sweep, the bound, and a missing thread returning null
- [x] 2.4 Add `app/utils/mastra-memory.test.ts` if not present, and verify it fails before the helpers exist and passes after

## 3. Support-agent `?threadId=` entry contract

- [x] 3.1 Add a test-only `__setTestThreadResolver` seam and have the support-agent `index` action parse `threadId` with `validateThreadId`, adopt it only when `classifyThreadSourceFor(thread.resourceId, user.id) === 'support'`, recall the transcript, and degrade to empty on any failure; verify `GET /admin/support-agent?threadId=<owned>` renders `data-thread-id` and messages and that malformed/unknown/foreign ids render empty
- [x] 3.2 Extend `SupportAgentPage` to accept `threadId` and `messages`, server-render the turns, and emit `data-thread-id` only when a thread is selected; verify the server-rendered response contains the prior turns and the attribute
- [x] 3.3 Update `SupportAgentStream` to adopt `data-thread-id` at setup, resolve the thread at submit time (DOM, then valid URL `?threadId=`, then a captured id only when it was created on the current `pathname + search`), and keep the active thread across `complete`; verify the browser tests below
- [x] 3.4 Add browser tests to `app/assets/streams/streams.test.browser.tsx`: resumed `data-thread-id` is posted, a fresh page after an in-app navigation does not post the previous thread, and a page-created thread is reused on the second message; verify each test fails against the unmodified client and passes after the change

## 4. Chatlog source metadata and filter

- [x] 4.1 Add a test-only chatlog fixtures seam and have the chatlog controller sweep/classify threads, build per-source counts, filter by `source`, and paginate the filtered list; verify `GET /admin/chatlog?source=support` shows only support rows and `?source=bogus` shows all
- [x] 4.2 Render the source label, message count, and "Letzte Nachricht" column, and a filter bar (Alle/Support/Kunden/Sonstige) with counts that navigates the current frame; verify the chatlog server tests assert the labels, counts, and active tab
- [x] 4.3 Thread the active `source` through pagination, the transcript frame href, and the delete form/redirect; verify the server tests assert the offset+source survive a delete and a transcript dismiss

## 5. Continue in chat linkage

- [x] 5.1 Add the "Im Chat fortsetzen" control to `ChatlogDetailFragment` for support-source threads only, linking to `/admin/support-agent?threadId=<id>` with `data-rmx-document`; verify the fragment tests assert the link (and `data-rmx-document`) for an own thread and its absence for customer/legacy threads
- [x] 5.2 Verify the fragment controller resolves ownership server-side (never trusts a query param) and omits the control when the thread is not owned; verify the test fails if the ownership check is removed

## 6. Gates and cleanup

- [x] 6.1 Run `npm run typecheck` plainly and read the exit code; fix any errors in touched files
- [x] 6.2 Run `npm run lint` (theme conformance included) and `npx oxfmt` on every touched file (or `npm run format:fix` scoped); verify clean
- [x] 6.3 Run the relevant suites and then `npm test`; verify all pass
- [x] 6.4 Manually verify the flow in a browser on a spare port: open `/admin/chatlog`, open an own support transcript, activate "Im Chat fortsetzen", and confirm `/admin/support-agent?threadId=<id>` renders the transcript and the next mocked turn would post the id; delete any probe script and stop the server
- [x] 6.5 Commit in conventional-commit steps and `git status` shows a clean tree with no files left in `tmp/` from this work

## 7. Review fix — enforce ownership on the write path

- [x] 7.1 Remove the client's `?threadId=` URL fallback so an id the server did not adopt is never posted; verify the browser regression test fails before the change
- [x] 7.2 Re-check thread ownership in the support-agent message action and start a new conversation for an unknown/foreign id; verify the server regression tests fail before the change
- [x] 7.3 Return a generic `agent-error` instead of the raw vendor message; update `design.md` and the `support-agent-conversation` spec
