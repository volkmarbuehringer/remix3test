<!-- Context: project-intelligence/newapp/concepts/architecture | Priority: high | Version: 1.4 | Updated: 2026-05-14 -->

# Concept: App Architecture

**Core Idea**: Route definitions in `app/routes.ts` map to a single consolidated controller (`app/actions/controller.tsx`) that delegates to page modules in `app/ui/`. The middleware stack wraps rendering via `app/middleware/render.tsx`.

---

## File Ownership

```
routes.ts          →  Route map (flat route strings + get() helpers)
router.ts          →  Wires routes to controller via createRouter
actions/
  controller.tsx          →  Top-level createController (home, assets, ui)
  lists/
    controller.tsx        →  Lists routes controller with requireAuth()
middleware/
  render.tsx       →  Request-scoped renderer install
ui/
  layout.tsx       →  App shell (header, nav, footer, theme toggle)
  document.tsx     →  HTML document (<head>, <body> with theme-driven styles)
  nav.ts           →  NAV_SECTIONS registry (single source of truth)
  page-primitives.tsx  →  PageSection, ShowcaseLinkCard, shared CSS
  mixins/          →  Namespace-style CSS mixins (button, card, input, text)
  scaffold-home-page.tsx  →  Home page (removable placeholder)
  showcase-pages.tsx      →  /ui showcase pages (button, form, theme)
assets/
  theme-toggle.tsx →  clientEntry for dark mode toggle
  lists-client.tsx →  clientEntry for interactive list management
  prompt-button.tsx → clientEntry for prompt copy-to-clipboard
  entry.ts         →  Browser runtime entry (run() with loadModule, resolveFrame)
theme.tsx          →  Light + Dark createTheme() definitions
```

## Key Decisions

1. **Single controller with extraction points** — Most route actions start in one `createController` call. When routes need their own middleware or become complex, extract to `app/actions/<route>/controller.tsx` (see [flat controller pattern](../guides/flat-controller-pattern.md)). Examples: client CRUD (auth-protected), lists (auth-protected).
2. **Page modules in `app/ui/`** — Route-owned page components live in `app/ui/`, not `app/actions/`. The controller imports and delegates.
3. **CSS within component files** — Each page/component defines its own `css()` blocks at module scope. No separate stylesheets.
4. **Mixin organization** — CSS-only mixins (no lifecycle, just style objects) live in `app/ui/mixins/` and export a namespace per file (see [namespace mixins guide](../guides/namespace-mixins.md)).
5. **Nav from data** — Navigation renders from `NAV_SECTIONS` array. Add a page → add one entry (see [nav registry guide](../guides/nav-registry.md)).
6. **clientEntry URL with hash fragment** — Always use `import.meta.url + '#ExportName'` when calling `clientEntry()`. `ExportName` must match the exported variable name, not the handler function name. This prevents resolution failures when the names differ (see [clientEntry pattern guide](../guides/client-entry-pattern.md)).
7. **Asset server allows `app/ui/**`** — The `createAssetServer` config includes `'app/ui/**'` in its `allow` list so client entries in `app/assets/` can import mixins from `app/ui/mixins/`. This is the standard pattern for sharing styles between server components and client entries.
8. **Body as flex container** — `<body>` in `document.tsx` gets `display: flex; flex-direction: column; min-height: 100vh` plus theme-driven `fontFamily`, `backgroundColor`, and `color`. Every page inherits these without per-page setup (see [sticky footer layout guide](../guides/sticky-footer-layout.md)).
9. **Registry-driven showcase routing** — UI showcase sub-routes (`/ui/:component`) use a `SHOWCASE_PAGES` record in `app/ui/showcase-registry.ts` instead of an if/else chain. Adding a showcase page = one record entry, no controller changes. Scoped to `/ui/` only (see [showcase registry guide](../guides/showcase-registry.md)).
10. **Theme dedup via shared constant** — `BASE_THEME_VALUES` in `app/theme.tsx` holds shared token groups (`space`, `radius`, `fontFamily`, etc.) used by both light and dark themes via spread. Theme-specific tokens (`surface`, `shadow`, `colors`) remain per-theme (see [theme setup guide](../concepts/theme-setup.md)).
11. **Button component replaces mixins** — All button styling migrated from `app/ui/mixins/button.ts` to `remix/ui/button` `Button` component. The `button.ts` mixin file has been deleted. The `Button` component is SSR-safe and usable in layout.tsx (see [component adoption guide](../guides/component-adoption.md)).
12. **Adopt `remix/ui/*` components when available** — Prefer pre-built components from `remix/ui/` over custom CSS mixins when the component covers the needed variants and is SSR-safe. This reduces maintenance burden and ensures consistency.

13. **Logger middleware in router stack** — The router in `app/router.ts` applies `logger({ format: '[%date] %method %path → %status (%duration)' })` as the first middleware. This logs every request with method, path, status code, and duration. Middleware order: logger → formData → session → asyncContext → database → auth → render.

14. **Breadcrumbs via path-to-trail mapping** — `app/ui/breadcrumbs.tsx` exports `getBreadcrumbs(pathname)` that maps URL paths to breadcrumb arrays. The last item has no `href` (current page). Integrated into the main Layout, AI shell, and Admin shell. The component is `remix/ui/breadcrumbs` Breadcrumbs; only the mapping logic is app-specific.

15. **Auth redirect captures current path** — `requireAuth()` in `app/middleware/auth.ts` uses `getSafeReturnTo(context.url.pathname)` as the `returnTo` fallback when the user is unauthenticated. This means a user who visits `/admin/chatlog` while logged out gets redirected to `/login?returnTo=/admin/chatlog`, and the login controller reads `returnTo` to redirect back after successful login. The login form also has an explicit `action` attribute with the `returnTo` param to prevent Remix client routing from stripping the query string.

16. **Nav consolidation: main nav bar vs section navs** — The main navbar (`NAV_SECTIONS` in `app/ui/nav.ts`) only shows top-level app sections: Home, AI, Admin. Lists and Client Lab were moved from the main navbar to admin sidebar cards and the admin sidebar's "Data" group. AI and Admin sections have their own sidebar navigation with grouped nav items (see [admin frame-nav pattern](../guides/admin-frame-nav-pattern.md)). Decision rule: if a page belongs to a section's domain, it lives in that section's navigation — not the main bar.

17. **Router as factory pattern** — `app/router.ts` exports `createNewappRouter()` function instead of a singleton router. This accepts optional `sessionCookie`/`sessionStorage` overrides for testing. A default `router` instance is also exported for backward compat. The factory is called in `server.ts` with no arguments (see [middleware chain](./concepts/middleware-chain.md)).

18. **Compression, methodOverride, loadAssetEntry in stack** — Three new middleware added: `compression()` (gzip/brotli, after logger), `methodOverride()` (reads `_method`, after formData), `loadAssetEntry()` (resolves script URLs, after auth). The stack grew from 7 to 10 layers (see [middleware chain](./middleware-chain.md)).

19. **Asset entry middleware** — `loadAssetEntry()` in `app/middleware/asset-entry.ts` resolves the script entry path to a hashed URL and preloads at request time, storing them in context. `getAssetEntry()` retrieves the resolved values. This sits between auth and render in the stack, replacing earlier hardcoded script path approaches.

20. **RestfulForm for RESTful HTML forms** — The `RestfulForm` component (`app/ui/restful-form.tsx`) wraps native `<form>` to emit `PUT`, `DELETE`, and `PATCH` via a hidden `_method` input. Used with `methodOverride()` middleware. All client CRUD forms use this pattern: `RestfulForm method="PUT"` for updates, `RestfulForm method="POST"` for creates (see [form ergonomics](./form-ergonomics.md)).

21. **data-schema validation for form data** — Server-side form validation uses `remix/data-schema` with form-data bindings from `remix/data-schema/form-data`. Three patterns exist: strict (register — all required, no defaults), guarded (login — validates format before credentials check), and lenient (client CRUD — all fields defaulted, returns object even with partial input) (see [form ergonomics](./form-ergonomics.md) and [data-schema API](../lookup/data-schema-api.md)).

22. **Inline sidebar CRUD with RESTful routes** — The client CRUD grid uses RESTful routes (`put('/:id')`, `del('/:id')`, `post('/')`). Edit and create happen in an inline sidebar panel triggered by `?editing=` and `?creating=true` (see [client-lab-architecture](./client-lab-architecture.md)).

## 📂 Codebase References

- **Main controller**: `app/actions/controller.tsx` — Home, assets, UI showcase
- **Lists controller**: `app/actions/lists-controller.tsx` — Lists routes with requireAuth
- **Router**: `app/router.ts` — `createNewappRouter()` factory, 10-layer stack
- **Config**: `app/routes.ts` — Route definitions
- **Document**: `app/ui/document.tsx` — Theme-driven body + asset script
- **Layout**: `app/ui/layout.tsx` — Flexbox sticky footer, nav rendering
- **Theme**: `app/theme.tsx` — `BASE_THEME_VALUES` shared constant
- **Showcase registry**: `app/ui/showcase-registry.ts` — `/ui/:component` routing
- **Nav registry**: `app/ui/nav.ts` — `NAV_SECTIONS`
- **Auth middleware**: `app/middleware/auth.ts` — `requireAuth()` with returnTo
- **RestfulForm**: `app/ui/restful-form.tsx` — RESTful HTML form wrapper
- **Asset entry middleware**: `app/middleware/asset-entry.ts` — `loadAssetEntry()`
- **Client entries**: `app/assets/` — `theme-toggle.tsx`, `client-del-button.tsx`

## Related

- [Middleware Chain](./middleware-chain.md) — 9-layer stack
- [Context Access Patterns](./context-access-patterns.md) — Direct properties vs getContext
- [Form Ergonomics](./form-ergonomics.md) — RestfulForm + methodOverride + validation
- [Controller Pattern](../guides/controller-pattern.md) — createController patterns
- [Client Lab Architecture](./client-lab-architecture.md) — Inline sidebar CRUD
- [Auth Architecture](./auth-architecture.md) — Session-based auth
- [Database Architecture](./database-architecture.md) — PostgreSQL + schema
- [Known Issues](../lookup/known-issues.md) — Hardcoded session secret
