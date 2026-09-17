---
name: streamed-chat-markdown-finalize
description: "Use when streaming agent/LLM text into a chat bubble and you want markdown (bold, lists, code, links) rendered only after the stream settles — parse once on the terminal event, never per token, and build the DOM safely without innerHTML."
metadata:
  origin: auto-extracted
---

# Finalize-on-Complete Markdown for Streamed Chat Text

**Extracted:** 2026-09-17
**Context:** A client-side SSE/streaming chat (LLM agent replies, tool results) where assistant text arrives as text-delta events and the bubble is updated imperatively via `textContent`.

## Problem

Rendering markdown on every text delta re-parses and rebuilds the bubble's DOM per token: flicker, wasted work, scroll jank. The tempting alternative — stream plain text, then set `innerHTML` once — is an XSS hole when model output is treated as HTML. A third trap: a tool-result card or approval gate can be the "last element" when the final text arrives, so formatting the wrong node wipes the card.

## Solution

Stream the reply as plain `textContent` and render markdown **once**, in the terminal `complete` handler, into the correct bubble.

1. **Tag the text bubble** so it can be found later and never confused with a tool-result card or gate:

```ts
function appendAgentMessage(text?: string): HTMLElement {
  let bubble = document.createElement('div')
  if (text) {
    bubble.textContent = text
    bubble.dataset.kind = 'text' // tag the streaming text bubble
  }
  return bubble
}

function updateLastAgentMessage(text: string) {
  if (currentAgentMessageEl) {
    currentAgentMessageEl.textContent = text
    if (!currentAgentMessageEl.dataset.kind) currentAgentMessageEl.dataset.kind = 'text'
  }
}
```

2. **Finalize only a tagged text bubble** on the terminal event:

```ts
function finalizeAgentMessage() {
  let el = currentAgentMessageEl
  if (el && el.dataset.kind === 'text') {
    let text = el.textContent || ''
    el.textContent = ''
    el.dataset.kind = 'markdown'
    el.appendChild(renderMarkdownToDom(text))
  }
}
```

3. **Build the DOM without `innerHTML`** — every token is a `createTextNode`/`textContent` assignment, and links are restricted to `http(s)` so a model can never emit a `javascript:`/`data:` href:

```ts
function renderMarkdownToDom(text: string): DocumentFragment {
  // parse text into blocks (paragraph / heading / list / code / hr) and inline
  // tokens (text / bold / italic / code / link), then for each:
  //   - text -> document.createTextNode(t.text)
  //   - bold -> <strong> with children rendered recursively
  //   - link -> <a href=t.href target="_blank" rel="noreferrer noopener">
  //             href set via the property, never a string attribute
}
```

Parsing runs once per reply (not per token), and the block/inline tokenizer is a pure function you can unit-test without a DOM.

## When to Use

- An SSE/streaming chat updates an assistant bubble via `textContent` deltas and you want bold/lists/code/links in the final reply.
- You need markdown formatting without an `innerHTML` XSS risk.
- A tool-result card or approval gate can be the last element when the final text arrives, so the formatter must target the right node.