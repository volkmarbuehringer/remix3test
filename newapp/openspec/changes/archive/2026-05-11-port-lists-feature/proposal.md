## Why

The starter app has the foundation patterns (theme, mixins, page primitives, nav registry, showcase) but no real interactive feature that exercises them. The `ListsClient` component from `my_app` is a 475-line fully client-side interactive list manager — add/edit/delete/reorder/shuffle — that exercises every new pattern: theme tokens in styles, button and text mixins, the nav registry for discoverability, and proves the interactive `clientEntry` pattern works end-to-end. No database or server persistence needed — all state lives in the browser.

## What Changes

- Port the interactive ListsClient component from `my_app` to `newapp/app/assets/lists-client.tsx`, adapted to use the newapp's mixin-based button styles (no dependency on `remix/ui/button` or `remix/ui/glyph`)
- Create `app/actions/lists/controller.tsx` with a single `index` action that renders the ListsClient page
- Register `/lists` route in `app/routes.ts` and wire in `app/router.ts`
- Add "Lists" entry to the nav registry (`app/ui/nav.ts`)
- The list detail (show) page uses `PageSection` + `pageStackCss` from page primitives
- Save uses `localStorage` instead of a server round-trip (no database needed)

## Capabilities

### New Capabilities

- `interactive-list-manager`: A fully client-side interactive list manager with add/edit/delete/reorder/shuffle operations, persisted to localStorage, rendered via clientEntry on `/lists`

### Modified Capabilities

- `nav-registry`: Add "Lists" entry to the NAV_ITEMS array
- `page-primitives`: The list page and detail pages validate PageSection + pageStackCss for real feature pages

## Impact

- **New files**: `app/actions/lists/controller.tsx`, `app/assets/lists-client.tsx`, `app/actions/lists/show-page.tsx`
- **Modified files**: `app/routes.ts`, `app/router.ts`, `app/ui/nav.ts`
- **Dependencies**: None — all functionality uses existing remix/ui APIs already in the starter
- **Systems touched**: Routing (new route group), client assets (new client entry), nav registry (new entry)
