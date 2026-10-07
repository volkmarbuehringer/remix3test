# Captured `let` narrowing under `prefer-let-locals`, and the `any`-opts trap

**Extracted:** 2026-10-07 · **Pinned to:** TypeScript 7.0.2, this repo's `remix-style/prefer-let-locals` oxlint rule

## Symptom

A value guarded in the outer scope is still `T | undefined` inside a nested function, so the code carries `x!`:

```ts
function init() {
  let input = form.querySelector<HTMLInputElement>('[data-file-input]')
  if (!input) return
  function onChange() {
    input.files // TS18047: 'input' is possibly 'null'  -> forces input!.files
  }
}
```

## Rule

TypeScript's control-flow narrowing is **not preserved for a captured `let`/`var` inside a hoisted `function` declaration**, even when the variable is never reassigned. It **is** preserved inside an arrow / function expression when the `let` is never reassigned after the narrowing point.

- This repo reserves `const` for module scope (`remix-style/prefer-let-locals` rewrites local `const` to `let`; `prefer-const-module-scope` is the inverse). So "just use `const`" is not available locally.
- Consequence: the `!` clusters in `app/actions/admin/public/admin-uploads-*.tsx` are *forced* by the style rule + hoisted `function` declarations. They are not removable by adding a guard.

Minimal probe (compile with `tsc --ignoreConfig --noEmit --strict`):

```ts
function f(opts: { runId?: string }) {
  let runId = opts.runId
  if (!runId) return
  let confirmed = runId          // fresh let, never reassigned
  let arrow = () => { let s: string = confirmed }   // OK
  function decl() { let s: string = confirmed }     // error
}
```

## Fixes

- **Closure passed inline (arrow)** — bind a fresh, never-reassigned `let` immediately after the guard and use it inside the closure. This removed 8 `runId!` assertions in `app/utils/agent-chat.ts` with no cast and no lint suppression.
- **Hoisted `function` declaration** — either keep the `!`, pass the narrowed value as a parameter, or convert the helper to an arrow assigned to a `let` (watch ordering; arrows are not hoisted). Do **not** introduce a local `const` — `npm run lint` fails.

## The `any`-opts trap

Replacing a load-bearing `opts?: any` with `opts?: unknown` in a hand-rolled structural interface (`TestAgent` in `app/actions/mastra/shared-agent.ts`) fails to typecheck: function parameters are checked **contravariantly**, and neither the vendor `Agent`'s concrete options type nor the test doubles' narrower types are assignable to `unknown`. `any` is effectively the only type both sides satisfy. Either keep `any` with the documented `eslint-disable`, or introduce an app-owned adapter interface and cast once at the boundary — do not "fix" it to `unknown`.

The same contravariance explains why vendor classes get bridged with `as unknown as`: a structural minimal interface cannot be assigned from a class whose method params are narrower, even when every method the app calls matches.
