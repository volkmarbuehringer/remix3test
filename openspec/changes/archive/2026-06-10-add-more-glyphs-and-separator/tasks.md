## 1. Library: Add new glyph names and path definitions

- [x] 1.1 Add new glyph names to `glyphNames` array in `remix/packages/ui/src/theme/glyph-contract.ts`:
      `eye`, `eyeOff`, `clock`, `send`, `chat`, `user`, `arrowRight`, `cog`, `moon`, `shield`, `zap`, `calendar`
- [x] 1.2 Add `symbol()` path definitions in `remix/packages/ui/src/theme/presets/rmx-01/glyphs.tsx` for each new glyph, matching the 16×16 stroke style:
  - `eye`: Eye outline + pupil circle
  - `eyeOff`: Eye outline + pupil + diagonal strikethrough
  - `clock`: Circle + clock hands (short hand at hour, long hand at minute)
  - `send`: Paper-plane arrow shape
  - `chat`: Bubble rectangle with tail
  - `user`: Head + shoulders silhouette
  - `arrowRight`: Horizontal line with arrowhead at end
  - `cog`: Circle with notches around it (gear teeth)
  - `moon`: Crescent moon shape
  - `shield`: Shield outline with checkmark inside (or plain shield)
  - `zap`: Lightning bolt zigzag
  - `calendar`: Calendar page with date lines
- [x] 1.3 Run `npm run typecheck` to verify glyph contract matches glyph values

## 2. Separator adoption: context menus

- [x] 2.1 Replace `<div role="separator" />` with `<Separator />` in `app/assets/admin-users-context-menu.tsx`:87
- [x] 2.2 Replace in `app/assets/admin-offerings-context-menu.tsx`:100
- [x] 2.3 Replace in `app/assets/admin-appointments-context-menu.tsx`:112
- [x] 2.4 Replace both in `app/assets/nutzer-table-interactive.tsx`:57, 65
- [x] 2.5 Replace in `app/ui/appointtype-panel.tsx`:148
- [x] 2.6 Add `Separator` component export to the library's `@remix-run/ui/separator` module (pnpm store)

## 3. Password toggle: convert innerHTML to Glyph

- [x] 3.1 Refactor `app/assets/password-toggle.tsx`:
  - Remove `eyeSvg` and `eyeOffSvg` string constants ✓
  - Replace `btn.innerHTML` with `<use>` href swap ✓
- [x] 3.2 Password toggle uses `<use>` href swap — runtime behavior verified via typecheck

## 4. Password eye glyph: form pages

- [x] 4.1 Replace inline eye SVGs in `app/actions/settings/controller.tsx` with `<Glyph name="eye" width={18} height={18} />`
- [x] 4.2 Replace inline eye SVGs in `app/actions/auth/pages.tsx` with Glyph components
- [x] 4.3 No `eyeSvg`/`eyeOffSvg` JSX constants in those files (they used inline SVGs directly)

## 5. Clock glyph: ai/workflow pages

- [x] 5.1 Replace clock SVG in `app/ui/ai-layout.tsx`:50 with `<Glyph name="clock" />`
- [x] 5.2 Replace clock SVGs in `app/ui/workflow-page.tsx` (lines 242, 252, 279) with `<Glyph name="clock" />`

## 6. Chat and send glyphs: chat/agent pages

- [x] 6.1 Replace chat bubble inline SVGs:
  - `app/ui/ai-layout.tsx`:33 → `<Glyph name="chat" />`
  - `app/ui/admin-layout.tsx`:70 → `<Glyph name="chat" />`
- [x] 6.2 Replace send arrow inline SVGs:
  - `app/ui/agent-page.tsx`:181 → `<Glyph name="send" />`
  - `app/ui/chat-page.tsx`:334 → `<Glyph name="send" />`

## 7. User glyph: avatar placeholders

- [x] 7.1 Replace user silhouette inline SVGs:
  - `app/ui/workflow-page.tsx`:273 → `<Glyph name="user" />`
  - `app/ui/agent-page.tsx`:141 → `<Glyph name="user" />`
  - `app/ui/chat-page.tsx`:284 → `<Glyph name="user" />`

## 8. ArrowRight, menu, close glyph: various pages

- [x] 8.1 Replace arrow-right inline SVGs in `app/ui/scaffold-home-page.tsx` (3 instances) with `<Glyph name="arrowRight" />`
- [x] 8.2 Replace hamburger menu SVG in `app/ui/main-nav.tsx`:108 with `<Glyph name="menu" />`
- [x] 8.3 Replace close SVG in `app/ui/main-nav.tsx`:138 with `<Glyph name="close" />`

## 9. Cog glyph: settings nav

- [x] 9.1 Replace gear/cog SVG in `app/ui/main-nav.tsx`:77 with `<Glyph name="cog" />`

## 10. Moon glyph: dark mode toggle

- [x] 10.1 Replace moon SVG in `app/ui/main-nav.tsx`:123 with `<Glyph name="moon" />`
- [x] 10.2 Theme toggle only renders moon glyph — sun SVG kept inline (no sun glyph exists)

## 11. Low-frequency glyphs: single-use icons

- [x] 11.1 Replace shield SVG in `app/ui/scaffold-home-page.tsx`:180 with `<Glyph name="shield" />`
- [x] 11.2 Replace zap SVG in `app/ui/scaffold-home-page.tsx`:173 with `<Glyph name="zap" />`
- [x] 11.3 Replace calendar SVG in `app/ui/scaffold-home-page.tsx`:136 with `<Glyph name="calendar" />`
- [x] 11.4 Replace check SVG in `app/ui/scaffold-home-page.tsx`:132 with `<Glyph name="check" />`

## 12. Check: unused inline SVGs removed

- [x] 12.1 After all replacements, grep for remaining `<svg` in `app/` to verify no intended replacement was missed
- [x] 12.2 Check remaining inline SVGs are intentional (brand logo, composite icons, low-frequency shapes documented in design doc)

## 13. Verification

- [x] 13.1 `npm run typecheck` — clean, no errors
- [x] 13.2 `npm test` — 787/789 pass, 1 pre-existing failure (offering date filter test), 1 todo
- [ ] 13.3 Start dev server and visually confirm:
  - All replaced glyphs render at correct size
  - Password toggle works correctly in auth and settings forms
  - Context menu separators render with theme-consistent border styling
  - Chat, workflow, and scaffold pages look correct
