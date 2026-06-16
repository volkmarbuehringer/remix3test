## 1. Fix delete panel universal spacing

- [x] 1.1 Remove `marginTop: theme.space.xl` from `deletePanelCss` — delete that line entirely
- [x] 1.2 Change `deletePanelCss` `padding` from `theme.space.lg` to `theme.space.md`
- [x] 1.3 Change `warningTextCss` `marginBottom` from `theme.space.md` to `theme.space.sm`

## 2. Add mobile-responsive spacing

- [x] 2.1 Create a `deleteFormCss` mixin with `theme.space.sm` grid gap on ≤768px and `theme.space.md` above, then compose it into the delete form's `mix` attribute
- [x] 2.2 Add `@media (max-width: 768px)` to `submitButton` reducing its padding from `0.5rem 1.5rem` to `0.5rem 1rem` for tighter mobile feel

## 3. Verify

- [x] 3.1 Run `npm run typecheck` — no new type errors
- [x] 3.2 Run `npm test` — 701/701 pass (1 todo, same as before), all existing settings tests pass
