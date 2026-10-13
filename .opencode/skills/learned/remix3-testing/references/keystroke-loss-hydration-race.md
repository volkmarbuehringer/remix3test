# E2E typing loses leading keystrokes until the client entry mounts

**Source:** `remix3-e2e-keystroke-loss-hydration-race`

**Status:** mitigated test-side (`typeInto` settle-check + bounded retype, commit `d7ed97e`).
Root cause is vendor hydration timing — do not chase an app-side "fix".

## Symptom

- A Playwright e2e types into an input right after `goto` + `waitFor`; the field
  settles **missing leading characters** (`Entwurf 179…` typed → DOM holds `twurf 179…`).
  Every downstream assertion (draft banner, autosave DB poll) then burns its whole
  budget and fails.
- Fails reliably under suite load (`--concurrency 2`, other suites running) yet passes
  alone on an idle machine — a hydration-gap race, not a budget problem. Widening
  `waitFor` budgets cannot converge: the lost keystrokes never reached `setTitle`,
  so the **app state** is short, not just the DOM.

## Attribution — is it my change?

1. Reproduce at the parent commit in a throwaway worktree:
   `git worktree add /tmp/opencode/bisect HEAD~2 && cp <project>/.env . && ln -s <project>/node_modules node_modules`,
   then run the single failing `*.test.e2e.ts` there 3×. Same failures at the baseline
   commit prove the flake predates the session's changes.
   (Keep the `.env` copy local to the scratch worktree — never quote secret values into
   skill text, commits, or logs.)
2. Measure honestly: 5 repeat runs single-file, plus one batch at the **suite's**
   `--concurrency`. One green run under noise ≠ fixed; the observed rate here was
   ~60% single-file (worse with the two typing tests colliding) vs 0/5 after the fix.

## Diagnosis — instrument the live page, don't theorize

- In a disposable `*.debug.test.e2e.ts` (delete after), `page.evaluate` before typing:
  a `MutationObserver` on the input's parent (`childList + attributes, subtree` — catches
  node recreation vs `setAttribute` patches) plus `focus/blur/select/input/keyup`
  listeners logging `value`, `selectionStart/End`, and `document.activeElement === input`.
- Type once **slowly** (60 ms/char — clean) and once at failing speed; the delta
  localizes the mechanism. What the trace showed here: the runtime patches `value` via
  **setAttribute** (a dirty-typed input ignores that) and no `REMOVED` record fires —
  so the loss is `input` events landing before the entry binds its handlers, with the
  first post-mount event carrying only the surviving text. Widening budgets was
  therefore doomed; the fix had to re-deliver the events.

## Stabilization — the test pattern

- `typeInto` = click → `Control+a` → `pressSequentially` → poll `inputValue()` until it
  equals the intended value (~1.5 s settle) → **re-type the whole value, bounded to
  ~3 rounds**, and throw a named error if it never settles. On a retry every event fires
  against the bound handler, so DOM and app state converge together.
- **Never retry with Playwright `fill()`**: it sets the DOM value without firing remix
  `on('input')` (runtime change-detection ignores programmatic sets — the file-header
  note in `lists-client-edit.test.e2e.ts`). A fill-"pass" is a false green: the field
  looks right, the editor stays clean, and the PUT never carries the text — the symptom
  just relocates to the DB assertion.
- Guard the poll: wrap `inputValue()` in try/catch and break out to the retype if the
  node is replaced mid-settle.
- Keep the helper per-file (the repo duplicates small e2e helpers); when hardening one
  e2e file's `typeInto`, grep the sibling `*.test.e2e.ts` files for the same helper and
  fix all copies in the same change — the edit and nav copies here both typed into
  `#lists-title`.

## When to Use

- An e2e types text that "disappears" or loses leading characters, or a typed value
  fails a DB/derived assertion although the typing appeared to succeed — especially
  right after `goto`/frame navigation or only under full-suite load.
- You need to prove a flake predates the session's commits before spending fix budget
  (worktree-at-baseline + repeat runs).
