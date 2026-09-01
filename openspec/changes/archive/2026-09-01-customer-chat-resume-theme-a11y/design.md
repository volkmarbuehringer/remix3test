## Context

The customer `/chat` route persists every turn to Mastra memory under `resource = String(user.id)`, but the `index` route renders an empty conversation on load (see `specs/customer-chat/spec.md` — the requirement this change reverses). The streaming client (`customer-chat-stream.tsx`) owns the thread id in a module variable, so a refresh loses the conversation from the view. Separately, this stream is the only agent UI still using hardcoded hex; the support-agent stream (`support-agent-stream.tsx`) already uses theme tokens and is the reference.

See `proposal.md` for the motivation; this document covers the how.

## Goals / Non-Goals

**Goals**
- Resume the most recent conversation for the authenticated user on `GET /chat` (Tier A).
- Add a "Neue Unterhaltung" control that starts a fresh conversation.
- Make the customer chat theme-token-driven and accessible (live region, focus management, keyboard nav) and surface a visible busy state + Cancel.
- Make the resume work without a schema change.

**Non-Goals**
- A conversation picker / list of past threads (Tier B).
- Rehydrating a *suspended* tool approval or answer gate after reload (Phase 3 — the `support_agent_pending_gates` + `reconnect` pattern is deferred).
- Reconstructing tool cards, reasoning `<details>`, or approval UI from history on resume — resume shows the reconstructed text transcript only.

## Decisions

### D1: Derive the latest thread from memory; no schema change
Resolve the user's latest thread via `listThreads({ filter: { resourceId: String(user.id) }, page: 0, perPage: 1, orderBy: { field: 'updatedAt', direction: 'DESC' } })` and recall with `recallChatMessages(agent, threadId, String(user.id))` (already exists). The `mastra-memory` wrapper gains a resource-scoped variant and its `MemoryHandle.listThreads` type gains the `filter` field.

- **Why:** Confirmed the Memory API supports `filter.resourceId`; the threads table stores `resourceId`; the customer stream writes `resource: String(user.id)`. No migration.
- **Alternative (rejected for now):** a durable pointer row/column (as `chat_runs` / `support_agent_pending_gates` do). Rejected because Tier A doesn't need deterministic thread selection, and a migration adds risk. Revisit if Tier B or Phase 3 lands.

### D2: "Neue Unterhaltung" reloads `/chat?new=1`
The control reloads the page in a fresh state; the `index` route skips resurrection when `new=1` and renders empty. Because `currentThreadId` is then null, the next message (sent without a thread id) creates a new thread server-side, which becomes the new latest.

- **Why:** No durable state to clear; correct for the common path.
- **Alternative (rejected for now):** a durable "active thread" pointer that "Neu" clears. Deferred; noted as the fix for the reload-reverts quirk below.

### D3: Hand off the thread id via the SSR container
`customer-chat-page.tsx` renders `data-thread-id` on `#chat-messages` (server-rendered history bubbles plus the attribute); `CustomerChatStream` reads it on mount into `currentThreadId`.

- **Why:** Simple, SSR-native, and keeps the client from needing a bootstrap request.
- **Alternative:** emit a synthetic `start` event or a JSON script block; not needed given an existing DOM hook.

### D4: Resume reconstructs the text transcript only
SSR renders `recallChatMessages` output (user/assistant text bubbles) and the client continues streaming into the same container. Tool calls, reasoning, approval/question cards, and slot pickers are not reconstructed from history.

- **Why:** History is stored as message text; rehydrating interactive gates is Phase 3. This keeps the resume path minimal.
- **Limitation:** a thread that ended suspended resumes as a plain transcript; the gate is not re-surfaced.

### D5: Align the customer stream with the support-agent stream
Replace every hex literal with theme tokens (`action.primary.*`, `action.danger.*`, `warning.*`, `surface.lvl0/1`, `border.default`, `focus.ring`, `text.primary`), add `role="log"`/`aria-live="polite"` to the conversation container, add focus management and keyboard operation, and wrap the existing `abortStream()` in a visible Cancel control plus a thinking indicator during an in-flight stream.

## Risks / Trade-offs

- [Resume targets the latest thread, but a user could have a newer stale thread] → Acceptable for Tier A; `?new=1` lets the customer escape. A durable pointer (deferred) would be deterministic.
- ["Neu" then reload-without-sending reverts to the previous thread] → Accepted MVP quirk; the durable-pointer alternative resolves it if it proves confusing.
- [SSR transcript lacks tool/reasoning/approval context on resume] → Documented limitation; Phase 3 addresses gate re-hydration.
- [SSR history and client-streamed bubbles coexist] → The client's `beginStream()` resets its per-stream pointers and appends a fresh assistant bubble, so SSR bubbles are not clobbered; verify with a browser test.
- [Recall needs a test seam] → The mock agent has no real memory; the controller test must exercise a "no history" path (and, if a resumed-thread path is added, an injected recall) to keep `GET /chat` assertions deterministic.

## Migration Plan

No schema change; deploy the application and the feature is live for existing users. Rollback: revert the `index` action's resume logic to the empty render (the spec delta is only replayed into the main spec on sync/archive, not on deploy).

## Open Questions

None blocking. Whether to reconstruct tool/reasoning UI on resume (rather than text only) is deferred to Phase 3 and does not change these specs, the approach, or the task breakdown.
