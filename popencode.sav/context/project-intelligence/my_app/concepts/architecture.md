<!-- Context: project-intelligence/my_app/architecture | Priority: high | Version: 2.4 | Updated: 2026-05-07 -->

# My App Architecture & Conventions

## Core Concept
Scaffolded Remix 3 app (`remix new`) with auth routes (login/register/logout), session middleware chain, PostgreSQL, and `toDiskSegment()` route-to-controller naming.

## Route Definitions

```typescript
export const routes = route({
  assets: get('/assets/*path'),
  home: '/',
  authLogin: form('login'),            // → directory controller
  authRegister: form('register'),      // → directory controller
  authLogout: post('logout'),          // → consolidated in root controller
  messagesContent: get('messages/content'),  // → consolidated in root controller
  messagesSubscribe: get('messages/subscribe'),  // → consolidated in root controller

  // Client runtime lab
  client: route('client', {
    index: get('/'),       // → directory controller
    grid: get('/grid'),    // → directory controller
    edit: get('/edit/:rowId'),  // → directory controller
    save: post('/save'),   // → directory controller
  }),
})
```

## Route-to-Controller Mapping

`toDiskSegment()` converts camelCase route keys to kebab-case disk segments (`authLogin` → `auth-login`).

| Route Type | Disk | Export |
|---|---|---|
| **Controller action** | `app/actions/controller.tsx` | `default { actions } satisfies Controller<typeof routes>` |
| **Sub-controller** | `app/actions/{name}/controller.tsx` | `default { actions } satisfies AppController<typeof routes.X>` |
| **Dir form()** | `app/actions/{kebab-name}/controller.tsx` | `default (context) => { ... }` |

## Controller Layout

```
app/actions/
├── controller.tsx      # root: assets, home, authLogout, messagesContent, messagesSubscribe
├── render.tsx          # co-located render (new Response, resolveFrame(src, target))
├── auth-login/controller.tsx     ├── auth-register/controller.tsx
├── messages/controller.tsx       ├── chat/controller.tsx
├── client/controller.tsx         └── admin/controller.tsx
└── admin/lists/controller.tsx     # nested under admin/
```

## Root Controller Pattern

Route leaves previously handled by standalone `BuildAction` files are now consolidated:

```typescript
export default {
  actions: { async assets({request}){}, home(){}, authLogout(){},
             async messagesContent({url}){}, messagesSubscribe(){} },
} satisfies Controller<typeof routes>
```

The controller also exports `assetServer` inline. This creates a circular dependency between `controller.tsx` and `render.tsx` that works via ESM live bindings. For projects where this pattern is undesirable, extract `assetServer` into a separate module (e.g., `bookstore/app/actions/asset-server.ts`).

## Render Co-location

`app/actions/render.tsx` replaces `app/utils/render.tsx`:
- **HTML**: `new Response(stream, { ...init, headers })` instead of `createHtmlResponse`
- **resolveFrame**: `(src, target)` with `x-remix-target` + `x-remix-frame` headers. Always returns `response.text()` (string) — returning `response.body` (ReadableStream) breaks Frame SSR.
- **Asset server**: co-located in `controller.tsx`, imported by `render.tsx`

## Frame Infrastructure

- **`routes.ts`**: Exports `frames` constant (`{ clientEdit: 'client-edit' }`) for named Frame references
- **`render.tsx`**: `resolveFrame(src, target)` sets `x-remix-frame: true` header for Frame request detection
- **`entry.ts`**: Client-side `resolveFrame(src, signal, target)` mirrors the server-side pattern with `x-remix-frame` header
- **`page.tsx`**: Uses `<Frame name={frames.clientEdit} src="...">` for edit panel SSR
- **`grid-client.ts`**: Uses `fetch()` + DOM replacement for programmatic Frame updates (Navigation API not reliable for JS-triggered Frame navigation)

## UI Architecture

### Mixin Library
`app/ui/mixins/` contains 14 reusable `css()` mixins (organized in 4 files) composed from `remix/ui/theme` tokens.

| File | Mixins |
|------|--------|
| `mixins/button.ts` | `buttonBase`, `buttonPrimary`, `buttonGhost`, `buttonDanger` |
| `mixins/card.ts` | `cardBase`, `cardHover`, `cardSelected` |
| `mixins/input.ts` | `inputBase`, `inputFocus`, `inputError` |
| `mixins/text.ts` | `textHeading`, `textBody`, `textMuted`, `textLabel` |

See `../guides/css-mixin-usage.md` for how-to and composition rules. See `../concepts/mixin-architecture.md` for naming conventions (action colors use `foreground`/`backgroundHover`, not `text`/`hover`).

### Context Providers
`app/ui/context-providers.tsx` provides `AppStateProvider` and `ThemeProvider` as pass-through wrappers in `document.tsx`. Ready for future `clientEntry` components that need typed context. **Note**: `handle.context` only works with `clientEntry`, not server-rendered components.

### Shared Utilities
- `app/utils/pagination.ts` — `paginate(db, table, options)` with `pageSize+1` hasMore detection
- `app/utils/sort-params.ts` — `parseSort(url, options)` with validation against allowed columns
- `app/utils/context.ts` — `getCurrentUser()`, `getCurrentUserSafely()` with null-check pattern for auth state

## AppController / AppContext Pattern

`app/router.ts` defines three types that bind the middleware stack into every controller:

```typescript
export type RootMiddleware = [ReturnType<typeof formData>, ...]
export type AppContext<params = {}> = WithParams<MiddlewareContext<RootMiddleware>, params>
export type AppController<routes extends RouteMap> = Controller<routes, AppContext>
```

Every sub-controller imports `AppController` from `router.ts` and uses it in `satisfies AppController<typeof routes.X>`. This ensures `context.get(Key)` returns concrete types (not `T | undefined`) in controller action handlers, because TypeScript knows the middleware chain has run.

Utilities and helpers using `getContext()` (e.g., `utils/context.ts`) still see `T | undefined` and use the null-check pattern described in `../guides/request-context-usage.md`.

## Other Conventions

- **Typecheck**: uses `tsgo --noEmit` (not `tsc`)
- **Middleware**: `compression() → staticFiles() → formData() → methodOverride() → session() → asyncContext() → loadDatabase() → loadAuth()`
- **Router**: single `router.map(routes, rootController)` for all root leaves

## Codebase References

- Routes: `my_app/app/routes.ts`
- Router: `my_app/app/router.ts`
- Root controller + asset server: `my_app/app/actions/controller.tsx`
- Render utility: `my_app/app/actions/render.tsx`
- Middleware: `my_app/app/middleware/`
- Mixin library: `my_app/app/ui/mixins/button.ts`, `card.ts`, `input.ts`, `text.ts`
- Context providers: `my_app/app/ui/context-providers.tsx`
- Pagination utility: `my_app/app/utils/pagination.ts`
- Sort param utility: `my_app/app/utils/sort-params.ts`
- Client lab controller: `my_app/app/actions/client/controller.tsx` (index, grid, edit, save)
- Client lab grid fragment: `my_app/app/actions/client/grid-page.tsx`
- Client lab page shell: `my_app/app/actions/client/page.tsx`
- Client lab edit form: `my_app/app/actions/client/edit-page.tsx`
- Client lab clientEntry: `my_app/app/assets/grid-client.ts`

## Related

- `../guides/controller-convention-fix.md` — Fix remix doctor warnings
- `../guides/inline-editing-patterns.md` — Client entry inline editing with event delegation
- `../guides/request-context-usage.md` — AppController, getContext vs get(), auth context utilities
- `../concepts/mixin-architecture.md` — Mixin library architecture and theme naming conventions
- `../guides/css-mixin-usage.md` — How to create and compose mixins
- `../errors/context-api-limitations.md` — handle.context restrictions
- `development/remix3/guides/controller-creation.md` — General controller patterns
- `development/remix3/concepts/controller-architecture.md` — Controller type system
- `development/remix3/guides/render-utilities.md` — Render utility patterns
- `development/remix3/middleware/concepts/request-context-get-pattern.md` — General get() null-check pattern
