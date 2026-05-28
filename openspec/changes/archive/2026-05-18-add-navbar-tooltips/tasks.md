## 1. Add shared tooltip CSS

- [x] 1.1 Add a `tooltipStyle` CSS mixin in `app/ui/layout.tsx` that positions and styles the `::after` pseudo-element for `[data-tooltip]` buttons on hover/focus-visible
- [x] 1.2 Add a `tooltipWrapperStyle` CSS mixin for the parent button/container to establish positioning context (`position: relative`)

## 2. Wire tooltip attributes to navbar buttons

- [x] 2.1 Add `data-tooltip="Logout"` attribute to the logout button in the navbar form
- [x] 2.2 Add `data-tooltip="Toggle dark mode"` attribute to the theme toggle button in the navbar

## 3. Verify

- [x] 3.1 Run `npm run typecheck` to verify no type errors
- [x] 3.2 Run `npm test` to verify existing tests still pass
