# Upstream Dependency Change Impact Analysis

**Source:** `remix-upstream-dependency-analysis`

**Extracted:** 2026-07-10
**Re-validated:** 2026-10-15 (vendor facts below re-checked against the installed tree at unified build `48b54a55` / source `aa2efcd`; version table unchanged from the stable `remix 3.0.0` / `component 1.0.0` / `component-hmr 1.0.0` / `ui 0.12.1` lines — the `3.1.0` / `1.1.0` / `0.13.0` release is staged on PR #11978 and not yet on `preview/main`)
**Context:** A project pins a dependency via `github:owner/repo#branch&path:subdir` (or similar) and upstream commits land on that branch. Need to determine whether updating the dependency would break the project.

## Problem

When a dependency is pinned to a GitHub branch (e.g. `"remix": "github:remix-run/remix#preview/main&path:packages/remix"`), upstream changes are opaque — `npm update` or `pnpm update` fetches whatever is at the branch tip. You need to know:

- What commits landed upstream
- Whether any of them change APIs your project uses
- Whether updating would introduce breakage

## Solution

Trace the chain from upstream changes to project impact:

1. **Find the pinned commit** in the lockfile (e.g. `pnpm-lock.yaml` contains the resolved commit hash: `version: https://codeload.github.com/.../<commit_hash>#path:...`)

2. **Fetch upstream changes** and compare:
   ```bash
   git fetch upstream-branch
   git log <pinned-commit>..origin/<branch>
   ```

3. **Diff the relevant source** between pinned and latest:
   ```bash
   git diff --stat <pinned-commit>..<latest-commit> -- packages/<dep>/
   ```

4. **Check each changed API** against your codebase:
   ```bash
   grep -r "affectedApi|changedFunction" app/
   ```

4b. **Audit code that shadows a changed vendor default.** If the app replaces a default the changed package exports (`run({ resolveFrame })` shadows `defaultResolveFrame`), the upstream fix never reaches it — diff the override against the new default and port the change. #11938 changed `getRequestBody` in `packages/component/src/runtime/run.ts` and `packages/spa/src/lib/spa.ts`; `app/assets/frame-response.browser.tsx` had to be re-synced by hand.

5. **Verify with typecheck + tests:**
   ```bash
   npm run typecheck
   npm test
   ```

**Blame triage:** before blaming a bump for a failing test, diff the *runner* between pins
(`git diff --stat <old> <new> -- packages/test packages/cli`). If that subsystem is unchanged,
the regression is app-side — the `document.dispatchEvent` failure here predated the bump.

Key focus areas when reviewing diffs:
- **New opaque types** — classes hiding previously public internals (e.g. `RoutePattern` making `.pathname` opaque)
- **Changed default behavior** — cookie codecs, encoding, serialization
- **New runtime validation** — a helper that now throws on invalid input can turn an existing unchecked `as` cast at a boundary into a 500; audit the cast adapters that feed it before updating (see `typescript-gotchas` → `references/vendor-validator-cast-audit.md`)
- **New features** — generally safe but may need opt-in adoption
- **Renamed exports** — look for `renamed|moved|deleted` in changelogs

## When to Use

- A project depends on a library via `github:owner/repo#branch&path:subdir`
- Upstream commits have landed on that branch
- Before running `pnpm update <dep>` or `npm update <dep>`
- When debugging regressions after a dependency update

## Version Lines After the Component/UI Split (#11948)

As of 2026-10-15 the repo still carries **three independent version lines**, so a single "remix version" no longer describes the dependency set. The app's branch pin (`preview/main`) resolves to the generated installable-build commit `48b54a55` (built from `aa2efcd`, i.e. `2c9e033` plus #11987/#11992/#11999), where `remix` has crossed to **stable `3.0.0`** and `@remix-run/component` / `-hmr` to **`1.0.0`**:

| package | version | notes |
| --- | --- | --- |
| `remix` | `3.0.0` | stable released; the prerelease-counter caveat no longer applies |
| `@remix-run/component` | `1.0.0` | runtime; aliased as `remix/component*` (crossed `0.x` → `1.0` since rc.5) |
| `@remix-run/component-hmr` | `1.0.0` | aliased as `remix/component-hmr*` (crossed `0.x` → `1.0`) |
| `@remix-run/ui` | `0.12.1` | primitives + animation; **not** aliased into `remix`, must be a direct dependency; still `0.x` |

Prior state (for git archaeology): at the `Release v3.0.0-rc.5` commit (`dba1546a0`; tag `remix@3.0.0-rc.5`) a `preview/main` install resolved to the generated installable-build commit `be58f7beb` (built from `904eb5ff3`) — `remix 3.0.0-rc.5` / `component 0.8.0` / `component-hmr 0.1.0` / `ui 0.12.0`.

`3.0.0-rc.4` with `ui 0.11.0` / `component 0.7.0` / `component-hmr 0.0.0` is the pre-release state at the split commit itself (`7513dae`).

**Bump recorded 2026-10-14: build `c1787ef`/source `7d5a2f9` → `c93cec30`/`e5ed055` (PR #11986 "Clean up UI APIs after styled component removal").** Range touches **only `packages/ui`**; `@remix-run/component`, `-hmr`, `assets`, the `remix` CLI, and the guides are byte-identical to the prior pin. API deltas (all verified live in the installed `.pnpm/@remix-run+ui@…c93cec30…/src/` tree):

- `@remix-run/ui/toggle` export renamed: `toggle.control` is gone → flat `toggle` export, callable directly as `toggle()` (`src/toggle.ts:186` `export const toggle = toggleMixin`). Option type `ToggleControlOptions` → `ToggleOptions`.
- Removed the always-empty styled prop types: `AccordionProps`/`AccordionItemProps`/`AccordionTriggerProps`/`AccordionContentProps`, `SelectProps`/`SelectOptionProps` (unless aliased via closing div param), `ComboboxProps`/`ComboboxOptionProps`, and the empty `TabsRootOptions`/`TabListOptions` metadata objects. Composition now = `Context` props + per-mixin `*Options` types + app-owned `Props<'div'>`/`Props<'button'>`.
- Accordion `headingLevel` prop, its context fields, and `AccordionHeadingLevel` were deleted entirely (`src/accordion.tsx`); the README now instructs an app-owned heading element (`<h2>`-style wrapper around the `trigger()` button) inside the accordion trigger markup.
- Also removed internal unexported namespace objects left over from the styled-removal series in `combobox.tsx`, `select.tsx`, `menu.tsx`.

App-side clearance at this bump (recorded so the next styled-removal-series bump has a baseline): the app imports only `@remix-run/ui/animation` (untouched) and `@remix-run/ui/menu` (unexported-namespace deletion only); grep found zero usage of any removed API; `npm run typecheck` clean; full browser suite green (mod a known timing flake in the lists autosave undo selection test). `remix test --only` scoped to that test and a full `npm run test:browser` rerun both pass at the new pin.

**Bump recorded 2026-10-14 (second, same day): build `c93cec30`/source `e5ed055` → `2c9e033`/source `e6a63ea` (#11988 `unsafeHTML()` prop diagnostics, #11989 traverse scroll/focus, #11990 component/testing docs).** Range touches `packages/component` runtime (`navigation.ts`, `unsafe-html.ts`), the vendor `remix` skill, component/test READMEs and package descriptions, `packages/remix/INDEX.md` + guides, and tests/demos; `packages/ui` and the other packages are byte-identical to the prior pin. API deltas (verified in the installed `.pnpm/@remix-run+component@…2c9e033…/` tree):

- `unsafe-html.ts` only rewords the thrown invariants — `innerHTML`/`srcDoc`/`srcdoc` now say "expected a value created with unsafeHTML()" and `outerHTML` says it is "not supported on host elements". No new validation; app already wraps at `app/ui/theme/runtime.ts`.
- `navigation.ts` `startNavigationListenerImpl`: on `traverse` (back/forward) `scroll` and `focusReset` are forced to `'after-transition'`, ignoring stored `manual`/legacy-boolean settings (previously `resetScroll: false` survived traversal). The app sets no `data-rmx-reset-scroll` and only `data-rmx-reset-focus="manual"` on the lists search form; those submits are pushes and `lists-search.tsx` refocuses on mount for back/forward, so no source change was required.
- No changed/renamed exports and no new opaque types; `@remix-run/ui` is untouched.

App-side clearance: the lock resolves both `path:` entries to the single `2c9e033` tarball; `npm run typecheck` clean; server/browser/e2e suites green (recorded 2026-10-14). The unrelated `oxlint`/`@oxlint/plugins` `1.87 → 1.88` float that `pnpm update` also produced is not part of this range.

**Bump recorded 2026-10-15: mixed prior lock (top-level `2c9e033`/source `e6a63ea`; transitive `@remix-run/*` `c7a4572`/source `22e176d`) → unified build `48b54a55`/source `aa2efcd` (#11987 detached form submitter, #11992 HMR test flake, #11999 derive AppContext from the router).**

- `pnpm update remix @remix-run/ui` re-resolved **both** top-level `path:` entries **and** every transitive `@remix-run/*` package to `48b54a55`, so the lock is now consistent (it was not before — see the branch-pin race below). A recursive diff of the installed trees `.pnpm/@remix-run+component@…c7a4572…` vs `…48b54a55…` shows the **only** changed source file in `packages/component` is `src/runtime/form-navigation.ts`; `packages/test` is byte-identical (only its `node_modules/.bin/playwright` link moved to 1.64.1).
- #11987 (`createFormNavigationResolver`): pending submissions are now indexed by **both** form and submitter (`WeakMap<HTMLFormElement | SubmitterElement, PendingFormSubmission>`), so a submit button detached before the `navigate` event still resolves its form, method/encType (`formmethod`/`formenctype`) and `data-rmx-target`; the native POST `FormData` is preserved across later `FormData` snapshots; a later canceled/duplicate submit (same or another form) can no longer replace the pending navigation. Adds a `form` field + `clearPending()`; no exported API change. Relevant to app forms that remove/re-render their submitter on submit (`admin-uploads-dropzone`, SSE approval `formaction` buttons), but no app source change was required.
- #11999 (template + guides + `packages/fetch-router` README; **no runtime source**): new apps use `export const router = createRouter({…})` + `export type AppContext = RouterContext<typeof router>` instead of `createRouter<AppContext>()` / `MiddlewareContext<[typeof renderMiddleware]>`, because the explicit type argument disabled middleware inference (a later-added `formData()` did not appear on `context`). This app already avoids the pitfall — `app/types/context.ts` derives `AppContext` from `ReturnType<typeof createNewappMiddleware>` and `app/router.ts` passes no explicit type argument — so no migration was required.
- #11992 is a Windows-only timing fix in `packages/component-hmr/test/hmr.test.e2e.tsx`; no runtime change.
- Versions unchanged: `remix` `3.0.0`, `@remix-run/ui` `0.12.1`, `@remix-run/component`/`-hmr` `1.0.0`. The guides anchor moves to `48b54a55` (see `docs/guide-skill-coverage.md`).
- Unrelated floats from the same `pnpm update`: `playwright` `^1.64.0` → `^1.64.1` (direct) and transitive `chat` `4.41.1`→`4.42.0`, `posthog-node` `5.55.3`→`5.56.1`, `fast-copy` `4.1.2`→`4.2.0`, `electron-to-chromium` `1.5.453`→`1.5.456`, `undici-types` `8.11.2`→`8.12.1`.

App-side clearance (2026-10-15): `npm run typecheck` clean; full `npm run test:browser` green (47 files / 740 tests, 0 fail, 2 skipped, ~59s). The single failure first blamed on the bump — the lists autosave undo assertion (`'undo is itself a mutation'`) — is the previously recorded timing flake: three isolated reruns (chromium+firefox, 14 tests each) all pass with the undo test completing in ~1.86s against its 12s budget, and the only changed runtime file in the range (`form-navigation.ts`) is unrelated to that path.

**Branch-pin transitive race (why the prior lock was mixed).** A `github:…#branch&path:…` specifier is not one resolution: `pnpm` resolves the top-level `path:` entries and the transitive `@remix-run/*` packages independently, and a later install can re-resolve the transitive set to the then-current branch tip. Before this bump the lock's two top-level entries were `2c9e033` while all ~260 transitive entries were `c7a4572` (a build published between installs), so the app was already running a *newer* `@remix-run/component` than the top-level pin suggested. When auditing a branch-pinned dependency, inspect the **installed** transitive build (`.pnpm/@remix-run+component@*`), not just the importer's lock line, and prefer a full `pnpm update` to unify the set.

**Release-day `package.json` pair.** Only two top-level entries are needed — `remix` and `@remix-run/ui`. Do not declare `@remix-run/component`(-hmr) directly; they arrive transitively and dedupe to one copy:

```jsonc
"remix": "^3.0.0",          // stable 3.0.0 released 2026-10; no -rc suffix needed
"@remix-run/ui": "^0.12.0"  // 0.12.1 lands under this caret (patch within the minor)
```

**`0.x` caret caveat.** On a `0.x` package, `^0.12.0` means `>=0.12.0 <0.13.0` — it locks the minor and allows only patches. That is the correct pin: a `0.x` minor can be breaking (0.11 -> 0.12 deleted the styled `button`/`breadcrumbs`/`checkbox`/`input`/`radio` modules plus the package-root runtime and JSX exports). Do not widen it to `>=0.12.0`.

**Git-spec equivalent.** If the app keeps `github:` specs instead of npm versions there is no number to write — pin **both** `path:` entries to the same ref/SHA so only one `@remix-run/component` resolves:

```jsonc
"remix":         "github:remix-run/remix#<ref-or-sha>&path:packages/remix",
"@remix-run/ui": "github:remix-run/remix#<ref-or-sha>&path:packages/ui"
```

