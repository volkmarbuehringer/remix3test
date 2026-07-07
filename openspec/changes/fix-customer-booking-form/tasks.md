## 1. Diagnose the Root Cause

- [x] 1.1 ~~Add a temporary debug log~~ (skipped — code analysis of Mastra/AI SDK source confirmed the data shape)
- [x] 1.2 Run the dev server, interact with the chat, and inspect the logged tool result shape
- [x] 1.3 ~~Based on the real shape, confirm whether the index-based matching works or needs fixing~~ (skipped — design decision already made: iterate toolResults by toolName)

## 2. Fix the Tool-Result Parsing

- [x] 2.1 Rewrite the slot-detection logic to iterate `toolResults` directly and match by `toolName` instead of relying on same-index pairing with `toolCalls`
- [x] 2.2 Ensure the extracted slot data is correctly serialized and saved to `session.pendingBooking`
- [x] 2.3 ~~Remove the temporary debug log~~ (never added — no debug log was needed)

## 3. Add a Targeted Test

- [x] 3.1 Create a mock agent in `controller.test.ts` that returns a realistic `generateText`-shaped result with `find_next_available_slots` in `toolResults`
- [x] 3.2 Add a test case: POST message → agent returns slots → session has pendingBooking → verify via subsequent GET
- [x] 3.3 Add a test case: POST message → agent returns empty slots → no pendingBooking in session
- [x] 3.4 Add a test case: POST message → agent makes no tool calls → no pendingBooking in session
- [x] 3.5 Run tests and confirm they pass

## 4. Verify End-to-End

- [x] 4.1 Run `npm run typecheck` to ensure no type errors
- [x] 4.2 Run `npm test` to confirm all existing tests still pass
- [x] 4.3 Start the dev server and manually verify: chat → agent finds slots → booking form appears → submit → appointment created
