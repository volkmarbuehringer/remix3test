<!-- Context: development/remix3/routing/concepts/routing | Priority: high | Version: 1.2 | Updated: 2026-05-02 -->

# Routing

## Concept

Declarative routing in `app/routes.ts` defines URL patterns using `route()`, `form()`, `resources()`, and HTTP method helpers. These route definitions are consumed by `app/router.ts` which maps them to action controllers.

## Key Points

- Routes defined in `app/routes.ts` (not `config/routes.ts`)
- `route()`, `form()`, `resources()` create **RouteMaps** — need their own controller
- `get()`, `post()`, `put()`, `del()`, string shorthands create **Route leaves** — use verb methods directly
- See `route-types.md` for leaf vs RouteMap distinction
- See `controller-architecture.md` for how controllers consume routes

## Routes Pattern

```typescript
import { get, post, route } from 'remix/routes'

export let routes = route('blog', {
  index: get('/'),
  posts: route('posts', {
    index: get('/'), // GET /blog/posts
    new: get('/new'), // GET /blog/posts/new
    create: post('/'), // POST /blog/posts
    show: get('/:id'), // GET /blog/posts/:id
    edit: get('/:id/edit'),
    update: post('/:id'), // POST (not PUT)
    destroy: post('/:id/destroy'),
  }),
  authors: route('authors', {
    // Read-only
    index: get('/'),
    show: get('/:authorId'),
  }),
})
```

## Read-Only Routes

```typescript
authors: route('authors', { index: get('/'), show: get('/:authorId') }),
```

## Fragment Routes (for Client Components)

```typescript
fragments: route('fragments', {
  titleEdit: get('title-edit/:postId'),
  authorEdit: get('author-edit/:authorId'),
}),
api: route('api', {
  updateTitle: post('posts/:postId/title'),
  updateAuthor: post('authors/:authorId/role'),
}),
```

## Reference

- Full CRUD example: `examples/crud-controller.md`
- Controller architecture: `./controller-architecture.md`
- Router mapping guide: `guides/router-mapping.md`
- Controller creation guide: `guides/controller-creation.md`
- Route types reference: `lookup/route-types.md`
- Live code: `my_app/app/routes.ts`, `bookstore/app/routes.ts`
