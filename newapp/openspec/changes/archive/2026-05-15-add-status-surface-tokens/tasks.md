## 1. Theme Token Definitions

- [x] 1.1 Add `dangerBg`, `dangerText`, `dangerBorder`, `successBg`, `successText`, `successBorder` flat string tokens to the light theme surface in `app/theme.tsx`
- [x] 1.2 Add corresponding dark-mode values for the 6 status tokens to the dark theme surface

## 2. Consumer Refactoring

- [x] 2.1 Replace hardcoded error/success flash banner colors in `app/ui/layout.tsx` with `theme.surface` status tokens (via `Record<string, string>` cast)
- [x] 2.2 Replace hardcoded error state colors in `app/ui/chat-page.tsx` with `theme.surface` status tokens
- [x] 2.3 Replace hardcoded failed status badge colors in `app/ui/workflow-run-page.tsx` with `theme.surface` status tokens — also fixed inconsistency: `#fee2e2` → `#fef2f2`

## 3. Showcase Update

- [x] 3.1 Add danger and success surface swatches to the theme showcase page in `showcase-pages.tsx`

## 4. Verification

- [x] 4.1 Run `pnpm run typecheck` to verify type correctness
- [x] 4.2 Run `pnpm test` to verify no test regressions
