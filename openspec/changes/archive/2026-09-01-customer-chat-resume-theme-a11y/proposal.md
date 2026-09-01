## Why

The customer `/chat` page is session/DOM-scoped: a reload, tab close, or navigation empties the conversation for the customer even though every turn is already persisted to Mastra memory (the admin chatlog can read it back, the customer cannot). Restoring the most recent conversation on load closes that gap. Separately, this chat is the only remaining agent UI that still styles bubbles, cards, and inputs with hardcoded hex instead of theme tokens, and it renders rich interactive content (tool approval, questions, slot picker) with no live-region, focus, or keyboard support.

## What Changes

- Resume the customer's most recent conversation on `GET /chat` (Tier A).
- Add a "Neue Unterhaltung" control that starts a fresh conversation.
- Replace all hardcoded colors in the customer chat UI with theme tokens.
- Add accessibility semantics: `role="log"`/`aria-live` on the conversation, focus management, and keyboard navigation for the approval/question/slot controls.
- Add a visible "thinking" indicator and a Cancel button for an in-flight stream.

No schema change is required: the resume relies on the Memory API `listThreads({ filter: { resourceId } })`, which the existing `mastra-memory` wrapper does not yet expose.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `customer-chat`: Update the requirement "Conversation history is session-scoped on load" so that `GET /chat` rehydrates the most recent thread from agent memory instead of rendering an empty area; and add new requirements for the "Neue Unterhaltung" control, theme-token conformance, and accessibility (live-region announcements, focus management, keyboard navigation, visible busy state).

## Impact

- `app/actions/mastra/mastra-memory.ts`: add a resource-scoped thread-list helper (and extend the `MemoryHandle.listThreads` type) so the user's own threads can be found by `resourceId`.
- `app/actions/chat/controller.tsx`: the `index` action resolves the latest thread, recalls its messages, and honors a fresh-conversation marker (`?new=1`).
- `app/ui/customer-chat-page.tsx`: new props (`threadId`, `messages`), server-rendered history bubbles, a `data-thread-id` hook, and the "Neue Unterhaltung" button.
- `app/assets/streams/public/customer-chat-stream.tsx`: adopt the thread id on mount; theme-token refactor; live-region/focus/keyboard a11y; cancel + thinking indicator; "Neue Unterhaltung" wiring.
- Tests: update the `GET /chat` "empty conversation" expectation in `app/actions/chat/controller.test.ts` and add a recall seam / no-history path; extend the stream browser assertions.
