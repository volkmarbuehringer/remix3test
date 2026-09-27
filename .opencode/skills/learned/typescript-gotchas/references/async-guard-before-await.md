# Async Action Guard Claimed After `await`

**Source:** `async-guard-before-await`

**Extracted:** 2026-09-27
**Context:** A retriggerable async action handler (copy/submit/send button, form submit, queue drain) that checks an in-flight flag on entry but assigns it only after an `await`.

## Problem

A re-entrancy guard is checked at the top of the handler but set after an `await`:

```typescript
// ❌ Bug: a second trigger during the awaited flush passes the same guard
let copySelected = async () => {
  if (busy) return                        // second click also sees busy === false
  let ids = selectedIds()
  let flushed = await flushPendingSave()  // spans a real network round-trip
  if (!flushed) return
  busy = true                             // set too late
  try { await post('/copy', { ids }) } finally { busy = false }
}
```

A double-click (or double `submit`, Enter-repeat, or a retried request) during
`flushPendingSave()` passes the guard and issues a second write. The window exists
only when the awaited work performs I/O: if it is an already-settled promise the
continuation runs as a microtask before the next event and the bug does not
reproduce — which is why it appears only when a save/upload/flush is genuinely in
flight (`await fetch`, `await setTimeout`, a DB write).

Server-side preconditions do **not** dedupe it. The duplicate requests carry the
same valid `If-Match`/ETag because the first request does not change the
precondition resource, so both succeed and the side effect happens twice.

## Solution

Claim the guard synchronously, before the first `await`, and release it in
`finally` on every exit path:

```typescript
// ✅ Correct: guard claimed before the first await
let copySelected = async () => {
  if (busy) return
  // synchronous validation only; return early on invalid input
  if (!targetId || selectedIds().length === 0) return

  busy = true            // claimed synchronously
  update()               // render disabled/label state from `busy`
  try {
    let flushed = await flushPendingSave()
    if (!flushed) return
    await post('/copy', { targetId, ids: selectedIds() })
  } catch {
    /* surface error */
  } finally {
    busy = false
    update()
  }
}
```

Drive the control's `disabled`/label from the same flag so a click after the
first is a no-op even if the guard is bypassed, and reset the flag in `finally`
(success, validation, conflict, network error). If the write is not naturally
idempotent, also consider a server-side idempotency key.

## How to detect this pattern

1. The handler/action is triggered by a user gesture that can repeat (click, submit).
2. The first statement guards on a boolean: `if (busy|inFlight|pending|saving|submitting) return`.
3. That boolean is assigned `true` **after** an `await`.
4. The awaited work performs I/O, so the event loop can run a second trigger in the gap.

```
if (.*(busy|inFlight|pending|saving|submitting).*\breturn\b
```

## Fix checklist

- [ ] Move the flag assignment to before the first `await`
- [ ] Move all awaited work (flush/save/validate) inside the `try`
- [ ] Reset the flag in `finally`, not only on success
- [ ] Bind the control's disabled/label state to the same flag
- [ ] Confirm no other early `return` skips the reset (that is what `finally` is for)

## When to Use

- A button/submit handler performs a create/copy/charge/send that is not idempotent and can be triggered twice.
- You see `if (busy) return` followed by an `await` before `busy = true`.
- Reviewing an async action: ask "what happens if this fires again while the awaited work is in flight?"
