## 1. Theme Surface Level Fix

- [x] 1.1 Invert `lvl0`–`lvl4` values in light theme (`app/theme.tsx`) so `lvl0` = lightest (`#f7fbff`) and `lvl4` = darkest (`#dee2e6`), preserving all existing hex values
- [x] 1.2 Invert `lvl0`–`lvl4` values in dark theme (`app/theme.tsx`) so `lvl0` = lightest dark surface and `lvl4` = darkest dark surface
- [x] 1.3 Verify status surface tokens (`dangerBg`, `dangerText`, `dangerBorder`, `successBg`, `successText`, `successBorder`) remain unchanged in both themes

## 2. Glyph Sprite Setup

- [x] 2.1 Add `RMX_01_GLYPHS` component render to `app/ui/document.tsx` — imported from `remix/ui/theme`, rendered as first child of `<body>`
- [x] 2.2 Glyph import not needed in document.tsx (used in individual page components)

## 3. Layout Icon Replacements

- [x] 3.1 Replace inline logout SVG in `app/ui/layout.tsx` with `<Glyph name="close" />`
- [ ] 3.2 🌓 emoji kept as-is — no sun/moon glyph in RMX_01 set (design doc acknowledges this gap)

## 4. Admin Sidebar Icon Replacements

- [x] 4.1 Replaced SVGs with glyphs where matches exist: dashboard→`menu`, agentonly→`info`, lists→`menu`, header→`alert`. Chat, messages, client kept inline (no glyph match)

## 5. AI Sidebar Icon Replacements

- [x] 5.1 Replaced SVGs with glyphs where matches exist: dashboard→`menu`, agent→`info`. Chat, workflow, header kept inline (no glyph match)

## 6. CRUD Button Icon Replacements

- [x] 6.1 ✓ replaced with `<Glyph name="check" />` in save button
- [x] 6.2 ✕ replaced with `<Glyph name="close" />` in cancel/delete buttons; also replaced ✎ with `<Glyph name="edit" />` in edit button

## 7. Workflow Page Icon Replacements

- [x] 7.1 Select dropdown arrow replaced with `<Glyph name="chevronDown" />`, parameters header with `<Glyph name="menu" />`, run card arrow with `<Glyph name="chevronRight" />`
- [ ] 7.2 No edit/delete action buttons found in workflow-page.tsx (the file has section header icons and empty state icons — none have matching glyphs)

## 8. Prompt Button Icon Replacement

- [x] 8.1 `CopyIcon` inline SVG replaced with `<Glyph name="copy" />` and `CopyIcon` function removed

## 9. Verification

- [x] 9.1 `npm run typecheck` — clean, no errors
- [x] 9.2 `npm test` — 197/197 passed, 0 failures
- [ ] 9.3 Start dev server and visually confirm: all replaced icons render correctly, surface level changes look coherent
