<!-- Context: development/remix3/lookup/route-types | Priority: high | Version: 1.0 | Updated: 2026-05-02 -->

# Route Types: Leaf vs RouteMap

## Quick Reference

| Creates a **RouteMap** → needs own controller + `router.map()` | Creates a **Route leaf** → use verb method or `router.map()` + action |
|---|---|
| `route('path', { index: get('/'), ... })` | `get('/path')` — single GET |
| `form('path')` — index (GET) + action (POST) | `post('/path')` — single POST |
| `resources('path')` — full CRUD (7 routes) | `put('/path')` — single PUT |
| `resource('path')` — singleton CRUD (6 routes) | `patch('/path')` — single PATCH |
| `{ key: '/path', nested: { ... } }` — plain object | `del('/path')` — single DELETE |
|  | `'/path'` — string shorthand (ANY method) |

## How Route helpers Produce These

| Import | Produces | Used in routes.ts |
|---|---|---|
| `import { route } from 'remix/routes'` | Top-level `route()` creates the RouteMap container; nested `get/post` create Route leaves | `chat: route('chat', { index: get('/'), action: post('/') })` |
| `import { form } from 'remix/routes'` | RouteMap with `index` and `action` leaves | `login: form('login')` |
| `import { resources } from 'remix/routes'` | RouteMap with CRUD leaves | `books: resources('books', { param: 'bookId' })` |
| `import { get, post, del } from 'remix/routes'` | Single Route leaf | `messagesContent: get('/messages/content')` |

## RouteMap Hierarchy in Practice

```typescript
export const routes = route({
  // Route leaf — string shorthand (ANY method)
  home: '/',

  // RouteMap — form() creates index + action
  authLogin: form('login'),

  // Route leaf — get() is a single Route
  authLogout: post('logout'),

  // RouteMap — route() with nested defs
  messages: route('messages', {
    index: get('/'),
    action: post('/'),
  }),

  // RouteMap — route() containing another RouteMap
  admin: route('admin', {
    index: get('/'),
    lists: route('lists', {    // ← nested RouteMap
      index: get('/'),
      delete: post('/:listId'),
    }),
  }),

  // RouteMap — resources() with CRUD leaves
  books: resources('books', { param: 'bookId' }),

  // RouteMap — plain object (no route() wrapper)
  cart: {
    add: post('/api/add'),
    update: put('/api/update'),
  },
})
```

## Which Goes Where

```
router.ts mapping:
├── routes that are RouteMaps → router.map(routes.X, Controller)
├── routes that are Route leaves → router.get/post/delete/routes.X, handler)
└── string/Route leaves → router.map('/path', handler) or router.get('/path', handler)

Controller actions:
├── Route leaf keys → required action handler
└── RouteMap keys → forbidden (?: never)
```

## Runtime Check

In `mapController()` (router.ts line 414-451):

```typescript
// Action keys in controller must be Route (leaf), not RouteMap
if (!(routes[key] instanceof Route)) {
  throw new TypeError(
    `Cannot map nested route map key \`${key}\` in controller actions; ` +
    `call router.map() for that route map separately`
  )
}
```
