# Streaming Chat Tool Results: Display Policy and No-Text Turn Fallback

**Source:** session 2026-11-03 (adopted chatlog thread continued in `/admin/support-agent`)
**Context:** An SSE agent chat emits `tool-result` frames while assistant text arrives as
`message` frames. The server transcript (`memory.recall` → `messageContentToText`) keeps only
`type: 'text'` parts.

## Problem

A tool-heavy turn can end with no assistant text (step budget, tool-only generation). The
live client is then the only place the result exists, and a naive renderer exposes machine
payloads:

- `JSON.stringify(result)` fallback prints raw weather/date/tool-search JSON;
  `String(nestedObject)` prints `[object Object]`.
- Every result creates a card, including internal `search_tools`/`load_tool` plumbing and
  `{ success: true }` acknowledgements.
- Setting `currentAgentMessageEl = card` lets the next text delta (or final markdown)
  overwrite the last card; conversely a trailing empty bubble can sit under a card.
- Repeated empty results (probing several dates/resources) produce a wall of identical
  "no results" cards.
- A client-only fallback disappears on the panel reload because the server transcript has no
  text for that turn.

## Solution

### 1. Classify the result before touching the DOM (pure, testable)

Pass `toolName` from the SSE frame — the result alone cannot identify plumbing. A pure
descriptor keeps the policy testable in the server suite and the DOM code dumb:

```ts
type View =
  | { kind: 'skip' }
  | { kind: 'empty'; text: string }
  | { kind: 'table'; columns: string[]; rows: Record<string, unknown>[] }
  | { kind: 'detail'; entries: { label: string; value: string }[] }
  | { kind: 'note'; text: string }
  | { kind: 'pdf'; filename: string; data: string }

function describe(toolName: string | undefined, result: unknown): View {
  if (toolName === 'search_tools' || toolName === 'load_tool') return { kind: 'skip' }
  if (!isRecord(result) || Object.keys(result).length === 0) return { kind: 'skip' }
  if (Object.keys(result).length === 1 && 'success' in result) return { kind: 'skip' }
  // pdf / weather / datetime / collection / found-entity ...
  return { kind: 'skip' } // unknown shapes are the agent's text job
}
```

Rules that matter:

- `search_tools`/`load_tool` payloads are model context, never transcript content.
- Unknown shapes are skipped, never stringified.
- Nested detail values (`rules`, `config`) are `JSON.stringify`, never `String()`.
- Collections cap rendered rows (~20); an empty collection renders one clear empty state.
- Consecutive empty results within one turn collapse into one card (check
  `lastEmptyCard?.isConnected`, reset on text/user message).

### 2. DOM ordering: the card is content, not the text target

```ts
function renderToolResult(result: Record<string, unknown>, toolName?: string) {
  let view = describe(toolName, result)
  if (view.kind === 'skip') return
  if (view.kind === 'empty' && lastEmptyCard?.isConnected) return

  finalizeAgentMessage() // markdown the text segment above the card
  removeEmptyAgentBubble() // no blank bubble under the card
  let card = createCard(view)
  chat.appendChild(card)
  lastEmptyCard = view.kind === 'empty' ? card : null

  // Continue the turn in a fresh bubble BELOW the card. Never assign the card
  // to currentAgentMessageEl: the next text delta would overwrite it.
  currentAgentMessageEl = appendAgentMessage()
}
```

`appendAgentMessage()` should itself drop a trailing empty placeholder (the same helper used
before rendering a gate card), so a question/approval mount is not removed by the next
`append` call.

### 3. Guarantee a readable end to the turn

```ts
// controller, on `complete`
let fallback = !didNavigate && !streamingText.trim() ? EMPTY_TURN_FALLBACK : undefined
ui.finalizeAgentMessage(fallback)
ui.clearAgentMessageEl()

if (!didNavigate && !fallback) {
  reloadPanel() // server transcript has text; safe to replace the live DOM
}
```

Skipping the reload when the fallback is shown is essential: the persisted transcript has no
text for that turn, so a reload would erase the only visible answer. The delegate's
`finalizeAgentMessage(fallbackText?)` fills an empty bubble with the fallback or removes the
empty placeholder when no fallback is needed.

### 4. Give tool-discovery turns enough steps

`search_tools` plus several data calls can consume the shared `maxSteps` before the model
writes text. Make it a per-surface config and use a larger budget for the tool-discovery
surface (16 vs. 10 here) — see `app/utils/agent-chat.ts` `createAgentChat({ maxSteps })`.

### 5. Debugging: live cards vs. stored transcript

When a user reports "raw JSON in the chat", first decide which surface it came from:

- Live-only cards are built from SSE `tool-result` frames; they never enter
  `mastra_messages`.
- Inspect the stored message's `content.parts`: only `type: 'text'` is visible to the
  transcript (`message-content.md`). A textless assistant message is a tool-only turn and
  disappears from the server-rendered history.
- That mismatch is the signal to fix the display policy/fallback, not the memory layer.

## When to Use

- A chat shows raw JSON, `[object Object]`, internal tool-search payloads, or a wall of
  "no results" cards.
- A turn ends with tool cards and no assistant answer, or text after a tool result is
  missing/overwritten.
- You are adding a new tool to an agent chat and the generic renderer has no branch for its
  shape.
- A client-side fallback vanishes after a frame/panel reload.

## Related

- `streamed-chat-markdown-finalize.md` — finalize-on-complete markdown mechanics; this
  reference extends its "card can be the last element" warning.
- `mastra-deltas` → `references/mastra-agent/sse-streaming.md` — `tool-result` event
  forwarding and the client/server event contract.
- `mastra-deltas` → `references/mastra-agent/message-content.md` — `content.parts`
  normalization and the text-only transcript.
