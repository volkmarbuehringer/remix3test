# E2E Boundary Inventory

The e2e suite protects integration boundaries that a `render()` browser test
cannot reproduce. Client behavior belongs in `*.test.browser.tsx`: component
state, keyboard/focus, stubbed fetch, DOM geometry, and frame behavior driven by
`render()`/`run()` with a stubbed `resolveFrame`.

Use this inventory when a test looks like client behavior. A case may move only
when the browser test fails for the same regression; otherwise keep one e2e case
per boundary below.

Current shape after the 2026-11-12 audit:

- e2e: 44 files / 48 suites / 224 tests (224 pass, ~720 s) → 42 / 46 / 220
  (220 pass, ~702 s) → 43 / 47 / 224 (224 pass, ~716 s) after the viewport-pager
  additions (`clients-prefetch` plus the lists pager case; one test per project).
- browser: 65 files / 108 suites / 1,030 tests (1,028 pass, 2 skipped, ~62 s) →
  66 / 109 / 1,034 (1,032 pass, 2 skipped, ~64 s).

## Boundary classes

- **HTTP/SSR**: real router response, cookies/auth, server-rendered markup.
- **Frame/navigation**: real frame swap, named-target registration, history
  replace, view transitions, scroll restoration.
- **Persistence**: real DB row, `If-Match`, upload/download/zip/PDF bytes.
- **Security/streaming**: CSP enforcement/report delivery, SSE/EventSource.
- **Viewport/shell**: real page shell and viewport media queries that the
  browser iframe cannot resize.
- **Platform pointer/keyboard**: real hover hit-testing and native
  keyboard/Escape semantics.

## Inventory

| File                                                                  | Boundary retained                                                 | Notes                                                                                                                 |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `app/actions/admin/admin-grid-floating-actions.test.e2e.ts`           | SSR grids + real hover + 1200px media query                       | Uses the production users/chatlog grids and real pointer hover.                                                       |
| `app/actions/admin/admin-grid-scroll.test.e2e.ts`                     | Frame paging + nested scroll reset                                | Also keeps the real page-shell bounded-grid geometry.                                                                 |
| `app/actions/admin/admin-grids-responsive.test.e2e.ts`                | Real routes at 390px and viewport cookie                          | Browser fixtures cannot resize the suite iframe.                                                                      |
| `app/actions/admin/admin-lists-owner.test.e2e.ts`                     | Real DB join/filter into the users grid                           | Owner drill-down is server data.                                                                                      |
| `app/actions/admin/admin-lists-prefetch.test.e2e.ts`                  | Real runtime prefetch/claim HTTP                                  | `render()` never boots the prefetch wiring.                                                                           |
| `app/actions/client/clients-prefetch.test.e2e.ts`                     | Real runtime prefetch/claim HTTP on the clients grid pager        | Covers the separate `client/grid-page.tsx` pager; `render()` never boots prefetch.                                    |
| `app/actions/admin/admin-users-pdf.test.e2e.ts`                       | Real PDF download through the frame                               | Binary response and `Content-Disposition`.                                                                            |
| `app/actions/admin/fragments/lazy-frames.test.e2e.ts`                 | Real dashboard fragment + frame route requests                    | The entry half is browser-tested; this proves the shipped fragment wiring.                                            |
| `app/actions/admin/frame-form-detached-submitter.test.e2e.ts`         | Real navigation listener/frame form path                          | Only `run()` installs the document submit + Navigation API listeners.                                                 |
| `app/actions/admin/lists/lists-frame-history.test.e2e.ts`             | Real history replace contract                                     | Navigation API history entry identity.                                                                                |
| `app/actions/admin/lists/lists-ux.test.e2e.ts`                        | Real frame search/focus, phone SSR layout, editor navigation      | Hover/focus and viewport behavior need the real page.                                                                 |
| `app/actions/admin/messages/messages-ux.test.e2e.ts`                  | Real frame search/focus + phone SSR layout                        | Same boundary as admin lists.                                                                                         |
| `app/actions/admin/uploads/uploads-bulk-delete.test.e2e.ts`           | Real POST + in-frame banner + DB rows                             | Mutation and frame reload.                                                                                            |
| `app/actions/admin/uploads/uploads-bulk-download.test.e2e.ts`         | Real ZIP download                                                 | Binary response.                                                                                                      |
| `app/actions/admin/uploads/uploads-context-menu.test.e2e.ts`          | Real right-click menu + delete form + DB                          | Pointer menu and mutation.                                                                                            |
| `app/actions/admin/uploads/uploads-dropzone.test.e2e.ts`              | Real upload/frame reload/file persistence                         | File input and frame state survive a navigation.                                                                      |
| `app/actions/admin/uploads/uploads-pdf-export.test.e2e.ts`            | Real PDF download                                                 | Binary response.                                                                                                      |
| `app/actions/admin/uploads/uploads-ux.test.e2e.ts`                    | Real frame filter + phone page scroll                             | Viewport and real grid shell.                                                                                         |
| `app/actions/agent-events/agent-events-frame-redirect.test.e2e.ts`    | Real frame redirect + host page retention                         | Frame runtime behavior.                                                                                               |
| `app/actions/appointment/appointment-grid-week-nav.test.e2e.ts`       | Real server-rendered week navigation                              | Frame/server contract.                                                                                                |
| `app/actions/appointment/appointment-sidebar-layout.test.e2e.ts`      | Real SSR flex ratio                                               | Retained: the production sidebar module imports server-only CSRF middleware, so it cannot load in the browser bundle. |
| `app/actions/appointments-new/appointments-new-frame-nav.test.e2e.ts` | Real frame navigation, wizard, body scroll lock                   | Frame + shell behavior.                                                                                               |
| `app/actions/auth/auth-responsive.test.e2e.ts`                        | Real public auth routes at 390px                                  | Route/SSR matrix.                                                                                                     |
| `app/actions/home/home-nav-responsive.test.e2e.ts`                    | Real document/client navigation + native Escape + drawer geometry | Needs the page header containing block and native `<dialog>` keyboard path.                                           |
| `app/actions/lists/lists-client-edit.test.e2e.ts`                     | Real autosave/DB writes/draft persistence                         | Includes the view-only sort no-PUT negative window.                                                                   |
| `app/actions/lists/lists-client-importmap.test.e2e.ts`                | Real asset/import-map hydration                                   | The import map is server-shipped.                                                                                     |
| `app/actions/lists/lists-client-nav.test.e2e.ts`                      | Real frame navigation + pending-edit flush                        | Navigation/DB ordering.                                                                                               |
| `app/actions/lists/lists-client-ops.test.e2e.ts`                      | Real drag merge/copy/move DB writes                               | Mutation endpoints and `If-Match`.                                                                                    |
| `app/actions/lists/lists-compact-layout.test.e2e.ts`                  | Real page shell at 390/820/1440                                   | Browser iframe cannot resize.                                                                                         |
| `app/actions/lists/lists-pdf-export.test.e2e.ts`                      | Real PDF download                                                 | Binary response.                                                                                                      |
| `app/actions/lists/lists-row-toolbar.test.e2e.ts`                     | Real pointer hover + focus + view transition                      | Hover hit-testing is not available in `render()`.                                                                     |
| `app/actions/lists/lists-sidebar-menu.test.e2e.ts`                    | Production menu actions + mutations + phone geometry              | Slimmed: menu open/close/focus/dismissal lives in the browser suite.                                                  |
| `app/actions/lists/lists-view-controls.test.e2e.ts`                   | SSR status counts + viewport strip geometry                       | Slimmed: status/hide-done/view-sort transitions live in the browser suite.                                            |
| `app/actions/mobile-route-matrix.test.e2e.ts`                         | Real route matrix at 390px                                        | Route/SSR matrix.                                                                                                     |
| `app/actions/notifications/notifications-bell-read.test.e2e.ts`       | Real DB read + soft navigation + bell client state                | Mutation plus surviving layout state.                                                                                 |
| `app/actions/scroll-restoration/scroll-anchoring.test.e2e.ts`         | Real history traversal + scroll anchoring                         | Navigation/history contract.                                                                                          |
| `app/actions/scroll-restoration/scroll-restoration.test.e2e.ts`       | Real history traversal + scroll restoration                       | Navigation/history contract.                                                                                          |
| `app/actions/settings/settings-responsive.test.e2e.ts`                | Real settings routes at 390px                                     | Route/SSR matrix.                                                                                                     |
| `app/actions/support-agent/no-js-gate.test.e2e.ts`                    | Real no-JS POST + 303 flash                                       | No-JS server path.                                                                                                    |
| `app/actions/ui/gallery.test.e2e.ts`                                  | Real asset URL/import map + nested client-entry hydration         | Gallery ships its own assets.                                                                                         |
| `app/middleware/security-headers.test.e2e.ts`                         | Real CSP headers/violations/report delivery                       | Security boundary.                                                                                                    |
| `app/ui/document-head-resources.test.e2e.ts`                          | Real client-side navigation head persistence                      | Browser document/navigation behavior.                                                                                 |
| `app/ui/view-transitions.test.e2e.ts`                                 | Real document navigation + `pageswap`/`pagereveal`                | Cross-document transition contract.                                                                                   |

## Moved to the browser suite

| Former e2e                                                 | Browser replacement                                                                                                   | Failure mode now covered                                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `app/actions/settings/settings-page-size-keys.test.e2e.ts` | `app/ui/page-size-entries.test.browser.tsx`                                                                           | Both page-size entries mounted together: select→input sync, focus prefill, PageUp/PageDown/Home/End, arrows left native. |
| `app/actions/lists/lists-reorder-transition.test.e2e.ts`   | `app/actions/lists/public/lists-view-transition.test.browser.tsx` (`runs inside the platform startViewTransition...`) | Real `document.startViewTransition` wrapper: exactly one transition when supported, instant fallback otherwise.          |

## Candidate exceptions

These look like browser cases but retain e2e coverage for a concrete reason:

- **`appointment-sidebar-layout`**: importing the production sidebar pulls
  `CsrfTokenInput` → `remix/middleware/csrf` → `node:async_hooks`, which cannot
  load in the browser test bundle. Moving it would need a production import
  split, not a test-only seam.
- **`admin-grid-scroll` clients geometry**: importing `ClientGridPage` pulls
  `getSelfFrameTarget()` → `remix/middleware/async-context`. The messages paging
  case also keeps the real page-shell bounded-grid assertion.
- **Hover and viewport cases** (`admin-grid-floating-actions`,
  `lists-row-toolbar`, `lists-compact-layout`, responsive route matrices): the
  browser suite has no page-level pointer or viewport resizing.
