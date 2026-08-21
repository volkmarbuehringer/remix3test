## Context

See proposal.md — Why. The upstream `remix`/`@remix-run/ui` build installed in this repo (`8bdf97f` → `preview/main`, `@remix-run/ui@0.7.0`) already reads only `data-rmx-*` attributes in its frame-navigation runtime (`packages/ui/src/runtime/navigation.ts`). The app still emits bare `rmx-*` names in 129 places across 30 files. TypeScript cannot surface the mismatch: `remix/ui`'s automatic JSX runtime declares `jsx(type, props: ElementProps, key?)` with `ElementProps = Record<string, any>`, so arbitrary attributes pass typecheck regardless of the strict `IntrinsicElements` prop types.

## Goals / Non-Goals

**Goals:**
- Restore frame navigation behavior (targeting, document-escape, history semantics) by renaming attributes to the names the installed runtime reads.
- Keep the diff mechanical and auditable — a pure attribute rename, no logic changes.
- Update stale learned-skill deltas so they match the current vendor contract.

**Non-Goals:**
- No behavior changes beyond restoring pre-rename semantics.
- No spec changes (`skip_specs: true` — the `frame-navigation-conventions` behavior contract is unchanged).
- Not touching upstream `~/remix` source.
- Not upgrading/downgrading the `remix` dependency.

## Decisions

**D1: Mechanical string rename of attribute names, in place.**
Every bare `rmx-*` attribute in `app/` source becomes its `data-rmx-*` equivalent. Rationale: the installed runtime's `navigation.js` reads exactly `data-rmx-target`, `data-rmx-src`, `data-rmx-reset-scroll`, `data-rmx-history` (anchors and forms) and checks `data-rmx-document` for the escape path; `diff-dom.js` uses `data-rmx-preserve-dom`. The rename mapping is 1:1 and invertible.
- Alternative considered: upgrading/downgrading the dependency to a build still using bare names — rejected, that fights the upstream contract and loses the (already installed) fix.

**D2: `nav-link.tsx` record keys renamed inside the `Record<string, string | undefined>` spread.**
`app/ui/nav-link.tsx:32-38` builds `extra['rmx-src']`/`extra['rmx-target']`/`extra['rmx-document']` and spreads into `<a>`. Because the keys live in a string-indexed record, neither the old nor new spelling is type-checked — the rename must be done by hand and verified by runtime test, not by trusting tsc. This is the shared nav primitive, so it is the highest-leverage site.

**D3: Learned-skill deltas updated in place (kept, not deleted).**
Per AGENTS.md, learned deltas encode version-pinned facts that rot as the vendor moves on. `remix3-frame-cliententry`, `remix-forms`, and `remix-route-relocation` reference bare `rmx-*` names throughout; they must be corrected to `data-rmx-*` (and the `rmx-document`→`data-rmx-document` form-support addition noted where relevant). Do not delete the deltas — the vendor docs still cover the underlying behavior, and AGENTS.md says to keep the delta and correct the vendor fact.

**D4: Verification via runtime behavior, not typecheck.**
Because the JSX typing is permissive, correctness is proven by exercising the affected flows (frame-targeted link/form navigation, `rmx-document` escape for downloads/cross-section links, `rmx-history="replace"` filter navigation) rather than by `tsc`. Existing tests that assert on frame navigation should be run; add coverage only where a gap is found.

## Risks / Trade-offs

- [Missed occurrence silently leaves a dead attribute] → Mechanical rename across all 30 files plus a final `rg 'rmx-(target|src|document|history|reset-scroll|preserve-dom)' app/` sweep asserting zero matches (docs/skills excluded from the code sweep).
- [`nav-link.tsx` keys are untypechecked] → Explicitly listed as a task with a runtime verification step; it is the shared primitive, so most frame navigation flows exercise it.
- [Stale skills mislead future work] → D3 keeps deltas but corrects them; the audit-drift-risk skills (`remix3-frame-cliententry`, `remix-forms`) are updated in the same change so the delta and code move together.
- [Upstream renames again] → Out of scope; the `data-rmx-*` namespace is the current vendor contract and is forward-stable.

## Migration Plan

Single change, no external deploy: rename attributes in `app/`, update skills, run `npm test` + `npm run typecheck`, then a manual pass over the admin frame navigation and download/cross-section links. Rollback is a single revert commit — the rename is mechanical and invertible.

## Open Questions

None — the approach is fully determined by the installed runtime's attribute names and the existing code surface.