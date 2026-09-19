# Crash cards: capture the swallowed exception stack

**Source:** `playwright-capture-swallowed-exception-stack`

**Context:** A client runtime catches render/DOM errors and renders its own error card — e.g. "Unexpected Error / Something went wrong / Node.insertBefore: Cannot insert a Text as a child of a Document". Playwright's `pageerror` and console listeners only ever see the *message*, never the stack, because the app's `try/catch` (or error-event handler) consumes the exception before it reaches the page.

Wrap the throwing DOM API in `page.addInitScript` (runs before any app code, re-applies on every document) with a `try/catch` that stashes the stack on `window`:

```ts
await page.addInitScript(() => {
  const orig = (Node.prototype as any).insertBefore
  ;(Node.prototype as any).insertBefore = function (node: Node, child: Node | null) {
    try {
      return orig.call(this, node, child)
    } catch (e: any) {
      ;(window as any).__ibStack = e.stack
      ;(window as any).__ibParent = this.nodeName
      ;(window as any).__ibNode = node.nodeName
      throw e
    }
  }
})
```

Drive the app until the error card shows, then read the captured stack:

```ts
console.log(await page.evaluate(() => (window as any).__ibStack))
```

Notes from the real case (Remix 3 client runtime, 2026-08-30):

- Wrapping **one method** is enough if the error message names it (`Node.insertBefore` → wrap `Node.prototype.insertBefore`). When the throwing API is unknown, cheaply wrap the usual suspects (`insertBefore`, `appendChild`, `removeChild`) in one init script.
- Capturing `this.nodeName` / `node.nodeName` alongside the stack answers "inserted **what** into **where**" (`#text` into `#document`) without re-deriving it from frames.
- This works because the crash card replaces content client-side without a navigation, so `window` state survives. If the failure *does* navigate, write to `sessionStorage` instead of `window` inside the wrapper — it survives same-origin navigations while `addInitScript` re-arms each document.
- The captured stack shows the *full async chain* — in the real case it revealed the trigger was an SSE `invalidate` listener → `window.location.reload()` → a Navigation-API interception → frame reload → stream diff, none of which was guessable from the message.
