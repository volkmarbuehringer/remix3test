# Behavior-preserving fixes when an opt-in lint rule fires

**Extracted:** 2026-10-07 · **Pinned to:** oxlint 1.87.0, this repo's `.oxlintrc.json` (categories all `"off"`), `openspec/specs/lint-config/spec.md`

## Symptom

You enable a rule the config keeps off (`"<plugin>/<rule>": "error"`) and it fires on dozens of sites — and the obvious fixes change runtime behavior, invent UI defaults, or trip another rule.

## Rule

Enable the **rule**, never its category: this repo pins every category to `"off"` and allows only explicitly-listed rules. Put the rule in the `**/*.{ts,tsx,js,jsx}` override — it has no `plugins` restriction and does **not** match `.mjs`, so vendored `.agents/`/`.claude/` scripts are skipped with no `ignorePatterns` change. One OpenSpec change per batch; `openspec archive <name> --yes` merges the delta into `openspec/specs/lint-config/spec.md`.

## Fixes by finding shape

| Finding | Behavior-preserving fix |
| --- | --- |
| `typescript/no-floating-promises` on an expression statement | `void expr` — runtime-identical. oxlint `--fix-suggestions` inserts it. |
| `unicorn/no-array-sort` / `no-array-reverse` | `toSorted()` / `toReversed()` **only** on a fresh array (`[...x]`, `Array.from(x)`, `x.filter/map(...)`, array literal) or a local not read again; otherwise preserve the in-place mutation. |
| `typescript/no-unnecessary-type-arguments` | Delete the argument equal to the parameter default (`AuthState<unknown>` to `AuthState`, `MixValue<A, ElementProps>` to `MixValue<A>`). |
| `eslint/no-shadow` | Rename **only** the inner binding, never the outer. A blind `replace_all` on a receiver (`handle.signal`) also hits the outer closure's identical call — split those (tsc reports `TS2304`). |
| `eslint/preserve-caught-error` | `new Error(msg, { cause: err })`. |
| `eslint/no-unsafe-optional-chaining` | Widen the asserted type to include `undefined`, then use optional chaining. |

## `consistent-return` on exhaustive switches

TypeScript's control-flow analysis proves a `switch` over a string-literal union total, so `noImplicitReturns` accepts it; oxlint does not model that and reports "expected a return value". **Do not invent a default value.** Instead:

- Turn the **final `case`** into `default:` — same body; unchanged for every value in the union, and only an out-of-contract runtime value now takes that branch.
- Render maps / JSX callbacks: `default: return null` (`null` and the prior implicit `undefined` render the same nothing).
- A path calling a `never` function (`process.exit(1)`) cannot become `return undefined` — unreachable under `allowUnreachableCode: false`. Write `return process.exit(1)`: the path becomes a `never` return, no unreachable code.
- A bare `return` mixed with value returns becomes `return undefined` / `return null`.

## Verify

`npx oxlint --ignore-pattern=.mastra .` must report 0; run `npm run typecheck`, `npm run lint`, `npm test`. After `--fix-suggestions`, prove the diff is only the insertion: `git diff --word-diff=porcelain -- app server.ts` and check every changed token is `+void`.
