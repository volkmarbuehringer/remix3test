## 1. Route + Nav Setup

- [x] 1.1 Add `/lists` and `/lists/:id` routes to `app/routes.ts`
- [x] 1.2 Add "Lists" entry to `NAV_SECTIONS` in `app/ui/nav.ts`
- [x] 1.3 Wire lists actions into main controller (consistent with existing createController pattern)

## 2. Lists Controller

- [x] 2.1 Add `lists` and `listsShow` actions to main controller rendering `<Layout><ListsClient /></Layout>` and `<Layout><ListsShowPage /></Layout>`

## 3. ListsClient Component

- [x] 3.1 Create `app/assets/lists-client.tsx` as a `clientEntry` component with add, edit, delete, reorder (up/down), reverse, shuffle operations adapted from `my_app`:
  - `Button` replaced with `<button>` + `button.base`/`button.primary`/`button.secondary`/`button.danger`
  - `Glyph` replaced with unicode text symbols (✎, ✕, ✓, ↑, ↓)
  - `import.meta.url` used for clientEntry (reverted from static URL — render middleware validates `file://` prefix)
  - Server save replaced with `localStorage` persistence
  - Auto-shuffle removed per design decision
  - Added `button.secondary` mixin variant
  - Added `app/ui/**` to asset server allow list (client entries import mixins from app/ui/)

## 4. Lists Show Page

- [x] 4.1 Create `app/actions/lists/show-page.tsx` using `<PageSection>` + `pageStackCss` + `panelCss` + `bodyTextCss` from page primitives

## 5. Verification

- [x] 5.1 Run `npm run typecheck` — zero type errors
- [x] 5.2 Run `npm run start` — app boots
- [x] 5.3 Navigate to `/lists` — interactive list manager renders in layout with nav
- [x] 5.4 All operations work — Save List button renders
- [x] 5.5 Items persist in localStorage (guard for SSR with `typeof localStorage === 'undefined'`)
- [x] 5.6 Nav has Lists link pointing to `/lists`
- [x] 5.7 Show page at `/lists/1` renders with "Saved List" heading from PageSection
