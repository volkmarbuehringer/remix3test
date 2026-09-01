## 1. Theme + Accessibility on the customer chat stream

- [x] 1.1 Replace all hardcoded hex color literals in `app/assets/streams/public/customer-chat-stream.tsx` with theme tokens (bubbles, tool cards, approval card, question card, slot picker, reasoning/details, step stats) following the support-agent stream; verify `grep -nE '#[0-9a-fA-F]{3,6}' app/assets/streams/public/customer-chat-stream.tsx` returns nothing and `npm run typecheck` passes.
- [x] 1.2 Expose a live region on the conversation: add `role="log"` and `aria-live="polite"` to the `#chat-messages` container in `app/ui/customer-chat-page.tsx`; verify a render/e2e assertion sees both attributes on the container.
- [x] 1.3 Add focus management and keyboard operation for the approval, question (radio/checkbox + free-text), and slot-picker controls so controls are reachable/operable by keyboard and focus lands predictably after submit/answer/approve/decline/slot selection; verify with a browser interaction test.
- [x] 1.4 Add a visible thinking/busy indicator while the agent is streaming and a Cancel button wired to the existing `abortStream()`; verify with an interaction test that submitting shows the indicator and Cancel aborts the in-flight stream.

## 2. Conversation resume (Tier A)

- [x] 2.1 Add a resource-scoped thread-list helper in `app/actions/mastra/mastra-memory.ts` (and extend the `MemoryHandle.listThreads` type with `filter.resourceId`); verify a unit test lists threads filtered by `resourceId = String(user.id)` and returns the latest by `updatedAt` DESC.
- [x] 2.2 Update the `index` action in `app/actions/chat/controller.tsx` to resolve the latest thread via `listThreads({ filter: { resourceId }, page: 0, perPage: 1, orderBy: updatedAt DESC })`, recall its messages with `recallChatMessages`, and render `<CustomerChatPage threadId messages />`; skip resurrection when the request is a fresh conversation (`?new=1`); verify the updated chat controller test passes (no-history path + resumed-thread path).
- [x] 2.3 Update `app/ui/customer-chat-page.tsx` to accept `Handle<{ threadId?, messages }>`, server-render the recalled turns as bubbles, and set `data-thread-id` on `#chat-messages`; verify SSR output contains the history bubbles and the thread id attribute when resuming, and is empty when fresh.
- [x] 2.4 Update `app/assets/streams/public/customer-chat-stream.tsx` to read `data-thread-id` on mount into `currentThreadId` so subsequent messages continue the resumed thread; verify a browser test that a resumed conversation's next message echoes the same `threadId` in the `start` event.

## 3. New-conversation control

- [x] 3.1 Add a "Neue Unterhaltung" button in `app/ui/customer-chat-page.tsx` that reloads the page in a fresh state (`/chat?new=1`); verify the control is rendered and clicking it navigates to a fresh (empty) conversation.
- [x] 3.2 Ensure the fresh path clears the active thread client-side and that the next submitted message (sent without a thread id) creates a new thread server-side; verify with a browser test that the new thread id differs from the prior thread and the conversation starts empty.

## 4. Tests and verification

- [x] 4.1 Update `app/actions/chat/controller.test.ts`'s `GET /chat` "empty conversation" expectation to reflect the resume behavior, and add a no-history path assertion (and an injected-recall assertion if a resumed-thread index path is covered); verify the chat controller test suite passes.
- [x] 4.2 Extend the stream browser test (`app/assets/streams/streams.test.browser.tsx`) to cover resume + theme-token rendering + accessible live region + Cancel; verify the stream browser test passes.
- [x] 4.3 Run the full verification gate: `npm run typecheck`, the affected test suites (`npm test`), and `openspec validate customer-chat-resume-theme-a11y --type change`; verify all pass.
