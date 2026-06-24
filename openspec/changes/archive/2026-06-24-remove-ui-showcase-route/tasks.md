## 1. Remove route definitions

- [x] 1.1 Remove `ui: get('/ui')` and `uiComponent: get('/ui/:component')` from `app/routes.ts`

## 2. Remove action handlers from home controller

- [x] 2.1 Remove `ui` and `uiComponent` action handlers from `app/actions/home/controller.tsx`
- [x] 2.2 Remove the `ShowcaseIndexPage`, `SHOWCASE_PAGES`, and `ShowcasePageId` imports from the home controller

## 3. Remove showcase files

- [x] 3.1 Delete `app/ui/showcase-pages.tsx`
- [x] 3.2 Delete `app/ui/showcase-registry.ts`
- [x] 3.3 Delete `app/ui/showcase-registry.test.ts`
- [x] 3.4 Delete `app/actions/home/controller.ui.test.ts`

## 4. Clean up route labels

- [x] 4.1 Remove UI showcase label entries from `app/route-labels.ts`

## 5. Verify

- [x] 5.1 Run `npm run typecheck` to confirm no type errors
- [x] 5.2 Run `npm test` to confirm tests pass
