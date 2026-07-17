## Why

The support agent page has no message history — each agent response overwrites the previous one in a single text slot. Users can't scroll back through the conversation to see what was asked or what the agent answered. The text input is a single-line field, making multi-line questions or structured data entry cumbersome. This makes the agent feel ephemeral and hard to follow for complex multi-turn interactions.

## What Changes

- **Message history with scroll** — user messages and agent responses accumulate as DOM elements in a scrollable container instead of overwriting a single text slot
- **3-row textarea input** — single-line `<input>` replaced with `<textarea rows="3" resize:none>` for comfortable multi-line input
- **Inline question/approval rendering** — agent questions (with options) and tool suspension approvals render as interactive elements inside the message stream, not in a separate bar
- **Remove agent-bar** — the single `#agent-bar` slot is replaced by the chat message list; transient status lines ("Navigiere zu...") become brief message bubbles
- **Chat-history container** — new scrollable `#chat-messages` div inserted between the Frame and the input area, with `min-height` for at ~3 visible message rows before scrolling

## Capabilities

### New Capabilities
- `chat-history-ui`: Accumulated, scrollable message history with user/agent bubble rendering, inline interactive elements for questions and tool approvals, and auto-scroll-to-bottom behavior
- `agent-input-textarea`: Multi-line textarea input with Enter-to-submit, Shift+Enter-for-newline convention, matching existing form submit handler

### Modified Capabilities

None — this is a pure UI change; no spec-level behavior changes for existing capabilities.

## Impact

- `app/ui/support-agent-page.tsx` — layout restructured: add chat-history div between frame and input, replace input with textarea, remove agent-bar styles
- `app/assets/support-agent-stream.tsx` — core rewrite of the stream handler: replace `setBarText()` with DOM message append/update functions, inline question/suspension rendering, scroll management
- `app/actions/mastra/controller.tsx` — optionally: pass recalled thread messages for initial chat history render on page load
- No API changes — SSE event protocol stays the same, only the rendering changes
