## 1. Create dropdown component

- [x] 1.1 Create `app/assets/showcase-dropdown.tsx` — a `clientEntry` component that handles click-to-toggle, click-outside-close, and Escape-close behavior

## 2. Add dropdown CSS to layout

- [x] 2.1 Add `showcaseButtonStyle` CSS mixin in `app/ui/layout.tsx` for the "Showcase" trigger button
- [x] 2.2 Add `showcaseMenuStyle` CSS mixin for the dropdown panel (positioned absolutely below the button, border, shadow, rounded corners, z-index)

## 3. Rewire Showcase rendering in navbar

- [x] 3.1 In `app/ui/layout.tsx`, change the Showcase section rendering from inline `<a>` links to a button + dropdown panel with showcase items as links inside
- [x] 3.2 Wire the active state — Showcase button shows active style when current path matches any showcase item

## 4. Verify

- [x] 4.1 Run `npm run typecheck` to verify no type errors
- [x] 4.2 Run `npm test` to verify existing tests still pass
