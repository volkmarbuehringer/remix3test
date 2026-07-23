## Why

The Workflow Agent currently uses a minimal "agent bar" interface that overwrites output on every interaction, making it hard for operators to track multi-step procedures (navigate → confirm → execute → consistency checks → report). The Support Agent has a richer conversation-based UX with chat history, inline approve/decline buttons for destructive actions, and better error visibility. Transferring these patterns to the Workflow Agent will make it safer, more usable, and give operators full session context.

## What Changes

- Add persistent conversation history (chat bubbles) to the Workflow Agent, replacing the single-line agent bar with a scrollable conversation container
- Add inline approve/decline buttons for tool suspensions (cancel/lock/unlock) instead of plain text messages
- Add frame auto-reload on stream completion to reflect workflow results immediately
- Add tool-error event handling for better debugging visibility
- Add a completeness scorer to evaluate protocol adherence
- Upgrade the message input from single-line `<input>` to multi-line `<textarea>` with Enter-to-send

## Capabilities

### New Capabilities
- `agent-chat-ux`: Shared conversation-bubble UI pattern for Remix 3 Frame-based agents — persistent message history, user/agent bubble rendering, question options, and tool approval buttons

### Modified Capabilities
- None. This change is purely internal UX — no domain-level requirements change.

## Impact

- `app/assets/streams/workflow-agent-stream.browser.tsx` — Major rewrite to support chat bubbles, approve/decline buttons, tool-error handling, frame auto-reload
- `app/ui/workflow-agent-page.tsx` — Template changes for chat bubble container
- `app/actions/mastra/agents/workflow-agent.ts` — Add scorer, minor adjustments
- Potentially extract shared stream client utilities from `support-agent-stream.browser.tsx` to reduce duplication
