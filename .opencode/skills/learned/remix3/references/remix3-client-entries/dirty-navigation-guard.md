# Deferred-Navigation Guard for Async Confirmation

**Extracted:** 2026-11-24 from `app/ui/dirty-form-guard.browser.tsx` and
`app/actions/admin/lists/lists-ux.test.e2e.ts`.
**Context:** A capture-phase click guard must ask before discarding unsaved edits,
but the confirmation is an async styled modal (`requestConfirmDecision`,
`@remix-run/ui/dialog`), not a synchronous `window.confirm`.

## Problem

A synchronous guard can call `window.confirm()` inside the click and only
`preventDefault()` when the answer is no. That does not work with a dialog:

- the dialog decides on a later task, so the browser would already have started
  the click's default navigation;
- cancelling after the fact is too late, and replaying from inside a `submit`
  listener is ignored while the form is already submitting;
- a persistent `discarding` flag that makes `isDirty()` false is dangerous: a
  frame swap can reuse the guard entry while replacing its form, leaving the
  guard dead for the new form.

## Solution

Cancel the original navigation immediately, await the dialog, then replay the
exact navigation with guard-disarmed one-shot flags.

```ts
let form: HTMLFormElement = el.closest('form')!
let submitted = false
let allowUnloadOnce = false // one-shot beforeunload exemption
let replayClick: HTMLElement | null = null // the synthetic click to let through
let formAbort = new AbortController()

document.addEventListener(
  'click',
  (event) => {
    if (!el.isConnected) return // old entry: a new panel owns the form
    let current = el.closest('form')
    if (!current) return
    if (current !== form) bindForm(current) // frame swap replaced the form

    let target = event.target as HTMLElement | null
    if (!target) return
    if (replayClick && (target === replayClick || replayClick.contains(target))) {
      replayClick = null // the replayed click must pass
      return
    }
    allowUnloadOnce = false // a new action retires a stale exemption

    let nav = pendingNavigation(target) // link, or GET form + submitter
    if (!nav) return

    let decision = requestConfirmDecision({ message, title, confirmLabel, tone })
    if (!decision) {
      // No <ConfirmDelete> host (headless/unit renders): synchronous fallback.
      if (!confirm(message)) {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    }

    event.preventDefault()
    event.stopPropagation()
    void decision.then((accepted) => {
      if (accepted) replay(nav)
    })
  },
  { capture: true, signal: handle.signal },
)

function replay(nav: PendingNavigation) {
  allowUnloadOnce = true
  form.removeAttribute('data-dirty')
  if (nav.kind === 'link') {
    if (nav.anchor.isConnected) {
      replayClick = nav.anchor
      nav.anchor.click() // keeps frame targeting/target/download
      replayClick = null
    } else if (nav.anchor.href) {
      window.location.assign(nav.anchor.href) // node vanished: last resort
    }
    return
  }
  if (nav.form.isConnected) nav.form.requestSubmit(nav.submitter)
}

window.addEventListener(
  'beforeunload',
  (event) => {
    if (allowUnloadOnce) {
      allowUnloadOnce = false
      return
    }
    if (!isDirty()) return
    event.preventDefault()
    event.returnValue = ''
  },
  { signal: handle.signal },
)
```

`bindForm(next)` aborts the previous form's controller and attaches
`input`/`change`/`submit` listeners with a fresh `AbortController`:

```ts
function bindForm(next: HTMLFormElement) {
  formAbort.abort()
  formAbort = new AbortController()
  form = next
  submitted = false
  allowUnloadOnce = false
  next.addEventListener('input', refresh, { signal: formAbort.signal })
  next.addEventListener('change', refresh, { signal: formAbort.signal })
  next.addEventListener('submit', markSubmitted, { signal: formAbort.signal })
}
```

Set a client-only hydration marker (`data-dirty-form-guard-ready`) in the ref so
e2e can wait for the guard after a frame swap.

## Rules and pitfalls

- Always `preventDefault()` before awaiting; never assume the click can continue
  after the dialog resolves.
- Replay the real anchor click, not `location.assign`, so the frame runtime still
  intercepts same-origin/`data-rmx-target` links and `target`/`download` survive.
  Replay GET forms with `form.requestSubmit(submitter)`, never from inside a
  `submit` listener (re-entrant `requestSubmit` is ignored).
- The replay click re-enters the same capture listener; identify it with a
  one-shot `replayClick`.
- Use one-shot `allowUnloadOnce` for `beforeunload`, and clear it on the next
  input/click so a frame navigation cannot leave a permanent exemption.
- Do not persist a `discarding` flag in `isDirty()`. Use per-navigation flags:
  a reused entry whose form was replaced otherwise stops guarding.
- In the click handler, re-resolve `el.closest('form')` and rebind if it changed;
  return when the entry's span is detached.
- Close the confirm surface through the host's state (`open`/`onOpenChange`),
  not only through a native dialog `close` event: the shell-owned
  `@remix-run/ui/dialog` surface has no native close event.

## Tests

- Browser: no host mounted, stubbed `window.confirm` fallback; host mounted,
  `[data-confirm-dialog]` appears, accept replays exactly one submit/click,
  cancel does not.
- E2E: dirty the panel, click another row/edit link, accept, wait for the
  destination frame content (the URL commits before the frame swap), then repeat
  and cancel; assert the editor stays.
- App seams: `app/ui/dirty-form-guard.browser.tsx`,
  `app/ui/dirty-form-guard.test.browser.tsx`,
  `app/actions/admin/lists/lists-ux.test.e2e.ts`.

## Related

- `references/remix3-client-entries/native-dialog-drawer.md` — native dialog
  lifecycle and platform-close rules.
- `references/remix3-client-entries/shell-overlay-portal.md` — the imperative
  confirm host (`requestConfirm` / `requestConfirmDecision`).
- `references/remix3-frame-cliententry/cliententry-lifecycle.md` — frame swaps,
  guard click-only behavior, and live-search races.
- `references/remix3-frame-cliententry/frame-unsaved-draft.md` — why
  `beforeunload` is unreliable around frame navigation.
