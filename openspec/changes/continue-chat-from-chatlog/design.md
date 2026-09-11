## Context

The chatlog and the two chat surfaces share one Mastra memory store keyed by `mastra_threads.resourceId`. `/admin/chatlog` lists every thread and reads a transcript; `/admin/support-agent` scopes its threads to the admin's user id (`resourceId = String(user.id)`); `/chat` scopes to the customer. See `proposal.md` for motivation.

Two constraints from earlier work shape this design. First, a nested `<Frame>` inside a frame that hydrates from a fetched fragment never registers with the runtime, so a link carrying `data-rmx-target` for the nested transcript frame silently falls back to the top frame (recorded in `.opencode/skills/learned/remix3-frame-cliententry/references/frame-layout-and-testing.md`). Second, an in-app navigation reuses the client entry's form element, so a captured thread id can serve the wrong page — f2c59a5 fixed exactly that for `/chat?new=1` by making the URL outrank the closure.

## Goals / Non-Goals

**Goals:**

- Resume a specific saved support conversation from the chatlog with server-side validated ownership.
- Make the right conversation findable without reading every UUID: derived source, message count, last activity, and a source filter.
- Keep the chatlog a master–detail page and keep customer conversations read-only.

**Non-Goals:**

- No admin takeover of customer threads, no writing an admin turn into a customer conversation, no "reply as customer".
- No auto-resume of the latest support thread on every `/admin/support-agent` load; selection is explicit (`?threadId=`).
- No schema change, no backfill, no stored source/summary column.
- No change to customer `/chat` behaviour.

## Decisions

### Ownership/privacy: admin/support threads only; customer threads read-only

Confirmed with the product owner. A support thread's resource is the admin's own user id, so continuing it writes only into the admin's own conversation. A customer thread's resource is that customer, and Mastra memory is not partitioned per reader: an admin turn written there would appear on the customer's next `/chat` load, which is a privacy surprise the current UI cannot warn about. The chatlog therefore derives a source and only offers "Im Chat fortsetzen" for `support` (resource id equals the current admin's user id). `customer` and `legacy` transcripts stay read-only.

Alternative considered: a "take over" flow with an inline warning and explicit confirmation. Rejected for this change because it needs its own ownership/audit design and a customer-visible behaviour decision; the read-only boundary is the safe default and is documented here so takeover can be a separate change.

### Entry contract: `?threadId=`, validated on the server, degrade to empty

The support-agent index reads `threadId` from the query string, validates its format with `validateThreadId` (the same `[a-zA-Z0-9_-]{1,64}` contract used by the streaming action), then verifies existence and ownership before adopting it. Ownership is checked against the thread's own `resourceId`: the memory layer exposes `getThreadById`, and the thread is adopted only when `classifyThreadSourceFor(thread.resourceId, user.id) === 'support'`. Any malformed, unknown, or foreign id is ignored and the page renders an empty conversation, never an error — this matches the existing pattern where a missing thread is not a failure.

Alternative considered: resolve the thread id against a resource-filtered `listThreads` page. Rejected because that filter needs pagination to prove absence; a direct `getThreadById` plus an explicit `resourceId` comparison is unambiguous.

### Server-rendered transcript

When a thread is adopted, the index recalls its turns and renders them in the chat area before the client hydrates, mirroring `CustomerChatPage`. This avoids an empty chat that looks like a new conversation until the first turn, and it gives the stream client the thread id through the same `data-thread-id` attribute the customer chat already uses.

### Client thread selection: the live page outranks captured state

The support-agent stream adopts the server-rendered `data-thread-id` at setup, but at submit time it resolves the thread from the page on screen, in order: the `data-thread-id` attribute, a format-valid `?threadId=` in the URL, then a value this entry captured only if the stream that produced it ran on the same `pathname + search`. Without the last guard, an in-app navigation to a fresh support page would reuse the entry and post the previous page's thread id; without reusing a page-created thread, every message would start a new conversation. The same reasoning fixes a pre-existing gap: the support-agent `complete` handler currently clears the active thread, which would break multi-turn continuation — it now keeps the thread until the page changes.

Alternative considered: trust the closure, as the code did before f2c59a5. Rejected: the task requires the URL/live page to be authoritative, and captured state is precisely what caused the earlier bug.

### Continue link crosses frames with `data-rmx-document`

The transcript pane is rendered inside the nested `admin-chatlog-detail` frame. A frame-targeted link there cannot reliably reach the support-agent page (nested-frame registration) and a same-section frame navigation would swap frames instead of navigating the app. The continue control is a plain anchor to `/admin/support-agent?threadId=<id>` carrying `data-rmx-document`, which makes the runtime skip frame interception and perform a normal document navigation — the same escape used for cross-section links and downloads. Because that navigation includes the query string in the top-level URL, the admin shell's frame src also carries it, so the frame request re-renders the same selected conversation.

### Source classification derived from `resourceId`, filter via bounded sweep

`mastra_threads.resourceId` is the only owner signal, so classification is derived at request time (`support` = current admin's id, `customer` = other numeric id, `legacy` = non-numeric placeholder). Mastra's `listThreads` supports only an exact `resourceId` filter — no "in list"/"not equals" — so the filter bar's per-source counts and the filtered page are built from a bounded full sweep of `listThreads` pages (bounded above so a runaway store cannot exhaust the request). The sweep is small at the current scale (~300 threads); a sweep failure degrades to the existing empty state.

Alternative considered: one `listThreads` query per known resource. Rejected because it cannot enumerate resources and would issue hundreds of queries to build counts.

### Message count reuses the preview read

The chatlog already issues a bounded `recall` per listed row to build a preview. That response carries the thread's total message count, so the count comes from the same read rather than a second query. The count reflects stored messages and is therefore a metadata signal, not a transcript length.

### Test seams

Outside test env the seams are no-ops, matching `__setTestAgent` / `__setTestResumeResolver`. The support-agent controller gets a thread-resolver seam for the index, and the chatlog controller gets a fixtures seam (thread summaries, previews, and a thread lookup) so source labels, filters, and the continue link can be exercised without a live Mastra store. The memory helpers themselves are tested against a fake agent.

## Risks / Trade-offs

- [A full thread sweep on every chatlog load grows with the store] -> Sweep is bounded; when the bound is reached the list degrades to what was read and the empty-state path handles failure. A future store-level source column would remove the sweep.
- [Another admin's support threads classify as `customer` because classification keys on the current admin's id] -> That is the safe direction (no continue link, no accidental takeover). It can be refined with an admin-id lookup if needed; it does not change this change's boundary.
- [`data-rmx-document` is a full page load, so the chatlog scroll position is lost] -> Acceptable: the admin is intentionally leaving the chatlog for the chat. Frame interception here would tear down or mis-target the admin shell.
- [Removing the `complete`-time thread reset changes existing multi-message behaviour] -> It is the intended fix for continuation and is covered by a browser regression test for both a resumed thread and a page-created thread.
- [Message count comes from stored messages, not the filtered transcript] -> Documented as a metadata signal; the transcript pane keeps its own precise count.

## Migration Plan

No migration. The `?threadId=` parameter is additive; existing support-agent behaviour (no parameter, empty conversation) is unchanged, and the chatlog continues to render every thread. Rollback is a code revert only — no data or schema state is introduced.
