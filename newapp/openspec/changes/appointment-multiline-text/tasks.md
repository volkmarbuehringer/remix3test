## 1. Multiline Rendering (CSS-only)

- [x] 1.1 Add `white-space: pre-wrap` to `blockTitleStyle` so stored `\n` characters render as line breaks in the appointment block
- [x] 1.2 Add `white-space: pre-wrap` to `tooltipStyle` so tooltip renders multiline titles correctly
- [x] 1.3 Change `expandedTitleStyle` to use `display: block` (instead of inheriting `-webkit-box` from `blockTitleStyle`) and add `white-space: pre-wrap`

## 2. Draft Block: Textarea + Buttons

- [x] 2.1 Change `draftInput` type from `HTMLInputElement | null` to `HTMLTextAreaElement | null`
- [x] 2.2 Replace `<input type="text">` with `<textarea rows={2}>` in the draft render block, matching textarea styling from the rename pattern
- [x] 2.3 Update draft `on('keydown')` handler: `Enter` inserts newline, `Shift+Enter` calls `commitDraft()`, `Escape` calls `cancelDraft()`
- [x] 2.4 Change `commitDraft` `e.target` cast from `HTMLInputElement` to `HTMLTextAreaElement`
- [x] 2.5 Change blur behavior: replace `on('blur', ...auto-save...)` with cancel (call `cancelDraft()`)
- [x] 2.6 Add Save and Cancel buttons to the draft block below the textarea, with click handlers calling `commitDraft`/`cancelDraft`
- [x] 2.7 Update draft block layout: `draftBlockStyle` to `flex-direction: column; align-items: stretch; gap: 4px; padding: 6px 4px`
- [x] 2.8 Bump draft block minimum height from 48px to 84px in the inline style calculation

## 3. Verify

- [x] 3.1 Run `npm run typecheck` to ensure no type errors
- [x] 3.2 Run `npm test` to confirm no regressions
- [ ] 3.3 Verify draft block renders correctly: textarea accepts multiline input, Enter inserts newlines, Shift+Enter saves, Escape cancels, blur cancels, buttons work
- [ ] 3.4 Verify multiline titles from existing data now render line breaks in blocks and tooltips
