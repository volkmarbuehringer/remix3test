## Context

Remix Frame's DOM reconciliation (`diff-dom.js:diffElementAttributes`) preserves the current `.value` of text `<input>` elements during frame content updates. When `shouldPreserveLiveAttribute` sees `current.value !== next.value`, it skips `setAttribute('value')`, preventing server-rendered `defaultValue` from taking effect.

## Goals / Non-Goals

**Goals:**
- Filter input shows the value from the URL after frame navigation
- Works for both agent `navigate` events and user form submissions

**Non-Goals:**
- No modification to Remix internals
- No clientEntry overhead

## Decisions

- **Explicit `.value` set after reload** — simplest fix with minimal code. After `frame.reload()` resolves, read `filter` from the frame's current URL and set `input.value` directly.
- **Target only `input[name="filter"]`** — avoids affecting unrelated inputs that may legitimately preserve user input across reloads.
- **Applied to both agent-stream files** — workflow-agent and route-agent use identical patterns.

## Risks / Trade-offs

- Race condition: if another reload starts before `.value` is set, the fix might be lost. Mitigated by setting value in the `.then()` of `reload()`.
- Narrow scope: only fixes `name="filter"` inputs. Other inputs using `defaultValue` in frame contexts could have the same issue but are out of scope.
