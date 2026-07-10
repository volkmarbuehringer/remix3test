## Context

The customer agent (`customerAgent`) flow currently proceeds directly from `search_resources_by_capability` to `find_next_available_slots` without any confirmation step. The customer sees slots for a resource they may not want, creating friction.

An approval pattern already exists in the support agent: tools with `requireApproval: true` trigger a Mastra suspension, the controller flashes data to the session, and the UI renders an approval card with approve/decline forms. The customer chat has none of this infrastructure.

The customer chat route is currently `form('chat')` — a flat GET+POST — and needs to become a nested route to support `approve` and `decline` POST endpoints.

## Goals / Non-Goals

**Goals:**

- Add `confirm_resource` tool to `customerTools` with `requireApproval: true`
- Add approve/decline routes to the chat route tree
- Add approve/decline actions + suspended-handling to the customer chat controller
- Add a neutral-style approval card to the customer chat page UI
- Update `customerAgent` instructions to call `confirm_resource` after resource discovery, loop on decline, and proceed on approval
- Accept `previousResourceIds` as a tool input field so the agent can track which resources have been declined

**Non-Goals:**

- No changes to the slot selection UI (`pendingBooking`/`confirm_booking` flow remains as-is)
- No changes to the booking workflow execution
- No changes to the support agent or its approval flow
- No changes to auth middleware or rate limiting (approve/decline inherit existing auth)

## Decisions

1. **Tool design: `confirm_resource` with `requireApproval: true`, execute is a no-op**
   - The tool's `execute` runs only after approval. It can return the `resourceId` and `resourceName` as confirmation, but the actual side effect (slot lookup) happens in a subsequent tool call.
   - Alternative considered: having `execute` temporarily lock the resource slot. Rejected because it adds complexity with minimal benefit — the customer hasn't chosen a time yet.

2. **Routes: convert `form('chat')` to `route('chat', { index, action, approve, decline })`**
   - Current `form('chat')` is shorthand for `get('/')` + `post('/')`.
   - New structure adds `post('/approve')` and `post('/decline')` without changing existing behavior.
   - The router picks up sub-routes automatically — no change needed in `app/router.ts`.

3. **Controller suspended-handling: mirror the support agent pattern exactly**
   - Check `result.finishReason === 'suspended'` in the `action` action.
   - Flash `toolApproval` to session (runId, toolCallId, threadId, responseText).
   - Redirect to chat page with `pending=true`.
   - The approve action calls `agent.approveToolCallGenerate()`, decline calls `agent.declineToolCallGenerate()`.
   - Rate limiting: approve/decline do not need rate limiting (they're lightweight, session-gated actions).

4. **UI approval card: neutral style, not danger red**
   - The support agent's `cancel_user_account` uses danger-red styling because it's destructive.
   - `confirm_resource` is a confirmation, not a warning. Use the primary action color or a neutral accent.
   - The card shows the resource name and description, with approve/decline buttons.

5. **Agent loop: instructions-driven, no external state**
   - The agent calls `search_resources_by_capability` once, gets a ranked list.
   - For the first candidate: `confirm_resource(resourceId=1, previousResourceIds=[])`.
   - On decline → next candidate: `confirm_resource(resourceId=2, previousResourceIds=[1])`.
   - When all candidates exhausted: inform the customer no suitable resource was found.
   - The agent naturally tracks the list in its conversation context (working memory).

## Risks / Trade-offs

- **Agents may hallucinate the resource list** after multiple declines → Mitigation: the `previousResourceIds` input field gives the agent a structured way to track what's been tried. The list is short (typically 2-5 results from `search_resources_by_capability`).
- **Customer confusion if no decline reason is captured** → Mitigation: the approval card shows the description, and the agent can ask the customer for preferences before calling `confirm_resource` again.
- **Increased round-trips** → Mitigation: approval adds exactly 1 extra redirect per resource presented. For the common case (first resource accepted), it's one extra step. Acceptable for a confirmation UX.
