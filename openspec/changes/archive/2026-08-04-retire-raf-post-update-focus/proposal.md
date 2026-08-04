## Why

`app/ui/appointment-grid.browser.tsx` uses `requestAnimationFrame` to focus inputs after a
`handle.update()` that reveals them (`startDraft` at L583, `startEdit` at L641). `requestAnimationFrame`
is the wrong tool for this: its timing says nothing about whether the Frame's DOM mutation has
flushed, and — unlike `handle.queueTask()` — it is **not aborted on re-render**. In practice a rapid
draft → cancel lets the pending `rAF` fire and steal focus onto an input that has just been removed.

The vendor `remix/ui` package documents `handle.queueTask()` as the blessed mechanism for exactly
this job: "DOM operations that need to happen after the DOM has changed from the next update …
focusing elements, scrolling, or measuring dimensions after conditional rendering"
(`~/remix/packages/ui/AGENTS.md`, Focus and Scroll Management, ~L1644-1745).

This is a small, safe consistency + correctness fix, and the durable part is capturing the
convention so future edits don't reintroduce the `rAF` pattern.

## What Changes

- **`startDraft` (L583):** replace `requestAnimationFrame(() => draftInput?.focus())` with
  `handle.queueTask(() => draftInput?.focus())`.
- **`startEdit` (L641):** replace the `requestAnimationFrame` callback (focus + select on
  `renameInputs.get(appt.id)`) with a `handle.queueTask` callback. The `renameInputs` map lookup
  stays valid because `ref` callbacks populate it during commit, before `queueTask` runs.
- **Convention captured:** add a learned delta (`.opencode/skills/learned/remix3-queueTask-over-raf`)
  stating "prefer `queueTask` over `requestAnimationFrame` for post-update DOM ops; `ref` stays for
  self-focus-on-mount."

## Explicitly Out of Scope (to prevent scope creep)

- **`ref`-callback self-focus sites** (`appointtype-panel`, `lists-search`): valid idioms, not the
  `rAF` anti-pattern — left as-is.
- **Imperative DOM insertion** (`client-grid-inline-edit`, `list-name-edit`): build inputs via
  `document.createElement` + `appendChild`/`insertBefore` with synchronous `focus()`. There is no
  `handle.update()` render for `queueTask` to attach to; rewriting them is a separate change.
- **Imperative class-toggle focus** (`nav-toggle`, `lists-client` keyboard nav): no Frame render,
  synchronous focus is correct.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None — this is an implementation-level idiom fix, not a requirement change.

## Impact

**Affected files:**

- `app/ui/appointment-grid.browser.tsx` — 2 call-site swaps (`startDraft`, `startEdit`)
- `.opencode/skills/learned/remix3-queueTask-over-raf/SKILL.md` — new convention doc

**No API changes** — controller and data layer untouched.
**No behavior change for users** beyond more correct focus handling (no focus-steal on rapid cancel).
