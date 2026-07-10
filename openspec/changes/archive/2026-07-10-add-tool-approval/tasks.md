## Task 1: Add `requireApproval` to `cancel_user_account` tool

**File**: `app/actions/mastra/tools/support-tools.ts`

Add `requireApproval: true` to the `cancelUserAccount` tool definition. No other changes to the tool's execute function.

- [x] Done

## Task 2: Add session flash utilities

**Files**: Not needed — `context.session.flash()` and `.get()` are already available from `remix/middleware/session`. Used directly in the controller.

- [x] Done — using existing session API directly

## Task 3: Update route definitions

**File**: `app/routes.ts`

Replace `form('chat')` with explicit route structure.

- [x] Done

## Task 4: Update shared-agent.ts

**File**: `app/actions/mastra/shared-agent.ts`

- Add `requireToolApproval` option to `CallAgentOptions` type
- Update `callAgentWithTimeout` to pass `requireToolApproval` to `agent.generate()`
- Skip the abort timeout when `requireToolApproval` is true
- Return `finishReason` and `suspendPayload` in the result type

- [x] Done

## Task 5: Update chat controller — action handler

**File**: `app/actions/mastra/controller.tsx`

Modify the `action` handler:
- Pass `requireToolApproval: true` to `callAgentWithTimeout()`
- Check `result.finishReason === 'suspended'`
- If suspended: store flash data, redirect to chat page with `?pending=true`
- If normal completion: same behavior as today (redirect/JSON)

- [x] Done

## Task 6: Add approve/decline handlers

**File**: `app/actions/mastra/controller.tsx`

Add two new action handlers.

- [x] Done

## Task 7: Update chat UI

**File**: `app/ui/admin-mastra-chat-page.tsx`

- Add `pending` prop and approval data to component props
- Read flash data on page render
- Conditionally render approval card when `pending=true` and flash data exists

- [x] Done

## Task 8: Update router wiring

**File**: `app/router.ts`

No changes needed — `router.map(routes.mastra.chat, mastraChat)` handles sub-routes automatically.

- [x] Done

## Task 9: Typecheck and verify

- Run `npm run typecheck` and fix any issues
- Run `npm run lint` and fix any issues
- Run existing chat controller tests to verify no regressions

- [x] Done — typecheck ✓, lint ✓
