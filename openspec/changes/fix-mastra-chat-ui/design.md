## Context

MastraChatPage renders as a flex column inside the admin layout grid. Messages use `flex: 1, overflowY: auto` but don't scroll to new messages on load. The input form uses full card styling (`padding: xl`, `border`, `boxShadow`, `textarea: 100px` min height) that takes ~200px regardless of content.

## Goals / Non-Goals

**Goals:**
- Auto-scroll conversation to bottom on page load
- Compact input form (minimal padding, smaller textarea, no card wrapper)
- Remove unused space below form

**Non-Goals:**
- No data/logic changes
- No restructuring of the remix controller or route

## Decisions

### Decision 1: CSS-only form compaction

**Chosen:** Reduce `padding` from `xl` to `md`, remove `border` and `boxShadow`, reduce `textarea` min-height from `100px` to `60px`. Keep the form as a server-rendered block with minimal visual weight.

**Rationale:** The card-like form was designed for a standalone page. Inside the admin layout, it should blend into the content area.

### Decision 2: Auto-scroll via hash anchor

**Chosen:** Add an anchor element at the bottom of the message list and include `#chat-end` in the redirect URL.

**Rationale:** Zero JavaScript. The browser natively scrolls to `#chat-end` on page load. Only works for the full-page case (after POST redirect) but that's the primary flow.
