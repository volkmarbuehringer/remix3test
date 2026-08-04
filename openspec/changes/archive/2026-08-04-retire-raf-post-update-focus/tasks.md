## 1. Retire `requestAnimationFrame` in `appointment-grid.browser.tsx`

- [x] 1.1 `startDraft` (L583): replace `requestAnimationFrame(() => draftInput?.focus())` with
  `handle.queueTask(() => draftInput?.focus())`.
- [x] 1.2 `startEdit` (L641): replace the `requestAnimationFrame` callback body with
  `handle.queueTask(() => { let input = renameInputs.get(appt.id); if (input) { input.value = appt.title; input.focus(); input.select() } })`.

## 2. Capture the convention

- [x] 2.1 Create `.opencode/skills/learned/remix3-queueTask-over-raf/SKILL.md` documenting:
  prefer `queueTask` over `rAF` for post-update DOM ops; `ref` stays for self-focus-on-mount;
  `queueTask` does not apply to imperative DOM insertion (no `handle.update()` render).

## 3. Verify

- [x] 3.1 Run `npm run typecheck` — no type errors.
- [x] 3.2 Run `npm test` — no regressions (1082 passed, 0 failed).
- [x] 3.3 Manual: open the appointment grid, start a draft (tab/click a cell) — input focuses;
  press Escape to cancel immediately — focus does NOT jump to a removed input (no focus-steal).
- [x] 3.4 Manual: double-click an appointment to rename — edit input focuses and selects the title.
