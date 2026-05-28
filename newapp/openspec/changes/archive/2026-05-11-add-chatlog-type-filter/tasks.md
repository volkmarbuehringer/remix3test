## 1. Controller Filtering

- [x] 1.1 Add `type` query parameter parsing to `app/actions/admin-chatlog-controller.tsx` — accept `type=chat` / `type=agent` / invalid values, filter conversations in-memory by `toolCalls` presence, pass `type` prop to page component

## 2. Page UI

- [x] 2.1 Update `app/ui/admin-chatlog-page.tsx` — accept `type` prop, display active filter label with clear link, preserve `type` in pagination `pageHref` URLs

## 3. Admin Sidebar Nav

- [x] 3.1 Update `app/ui/admin-layout.tsx` — add optional `href` field to `NavItem` type, add "Chat Only" and "Agent Only" nav items with `href: "/admin/chatlog?type=chat"` and `href: "/admin/chatlog?type=agent"`, update nav rendering to use `href` when present, add icon mappings for new items

## 4. Verify

- [x] 4.1 Run `pnpm run typecheck` to verify no type errors
- [x] 4.2 Run `pnpm run lint` to verify no lint issues
- [x] 4.3 Run `pnpm test` to verify existing tests still pass
