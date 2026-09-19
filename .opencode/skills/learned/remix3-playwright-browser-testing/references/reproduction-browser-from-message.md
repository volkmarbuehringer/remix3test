# Pick the reproduction browser from the error message

**Source:** `playwright-capture-swallowed-exception-stack` — Chromium vs Firefox DOMException message styles

DOMException `message` strings are browser-specific. A user report without a browser name tells you which engine to reproduce in:

- Firefox style: `Node.insertBefore: Cannot insert a Text as a child of a Document`
- Chromium style: `Failed to execute 'insertBefore' on 'Node': ...`

In the source case, **Chromium silently tolerated the malformed diff** (only a 404 console warning) while **Firefox threw** — reproduce in the engine whose message format matches the report, or you may chase a crash that doesn't happen in your first-choice browser.
