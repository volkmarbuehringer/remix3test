## 1. Controller — pass pagination state to sidebar render

- [x] 1.1 Read `offset` from `context.url.searchParams` in the `index` action (default 0)
- [x] 1.2 Pass `offset` and `hasMore` from `getAllLists` result into `renderListsPage` call
- [x] 1.3 Update `renderListsPage` signature to accept `offset`, `hasMore`, `limit` params
- [x] 1.4 Pass pagination state through `ShellOrFragment` to `ListsLayout`

## 2. Sidebar layout — render pagination controls

- [x] 2.1 Add page indicator text and "Vorherige"/"Nächste" `<NavLink>` elements below list entries in `ListsLayout`
- [x] 2.2 Build `?offset=<value>` href for prev/next links, targeting the lists frame
- [x] 2.3 Conditionally hide prev button when `offset === 0`
- [x] 2.4 Conditionally hide next button when `hasMore === false`
- [x] 2.5 Add CSS styles for pagination controls (container, buttons, page indicator)

## 3. Preserve offset across list navigation

- [x] 3.1 Update `buildListHref` to include current `offset` in the URL alongside `?load=`
- [x] 3.2 Ensure destroy action redirect preserves offset in the redirect URL

## 4. Verify

- [x] 4.1 Run `npm run typecheck` to confirm no type errors
- [x] 4.2 Run `npm test` to verify existing tests still pass
