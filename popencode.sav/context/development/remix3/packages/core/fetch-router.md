<!-- Context: development/remix3/packages/core | Priority: critical | Version: 1.0 | Updated: 2026-04-25 -->

# fetch-router

Minimal, composable HTTP router built on the web Fetch API.

## Core Idea

Create typed route maps with `route()`, apply middleware, and handle requests with a fetch-based API. Works in Node.js, Bun, Deno, and Cloudflare Workers.

## Key Points

- **Route Maps**: `route({ home: '/', about: '/about', blog: { show: '/blog/:slug' } })`
- **Method Routing**: `router.get()`, `router.post()`, `router.map()` for typed routes
- **Form Routes**: `form()` creates index (GET) + action (POST) routes
- **Resources**: `resources()` creates RESTful routes (index, show, create, edit, update, destroy)
- **Middleware**: Global (router level) or inline (route level)
- **Request Context**: `context.request`, `context.params`, `context.get(Key)`
- **Type-Safe**: Route params and context types are inferred

## Quick Example

```ts
import { createRouter } from 'remix/fetch-router'
import { route, form } from 'remix/fetch-router/routes'

let routes = route({
  home: '/',
  contact: form('contact'),
})

let router = createRouter({
  middleware: [formData(), session()],
})

router.get(routes.home, () => new Response('Home'))

router.map(routes.contact, {
  actions: {
    index() { return htmlResponse('<form>...</form>') },
    action({ get }) {
      let data = get(FormData)
      return redirect('/success')
    },
  },
})
```

## Middleware Pattern

```ts
function logger(): Middleware {
  return async (context, next) => {
    let start = Date.now()
    let response = await next()
    console.log(`${context.request.method} ${context.request.url} ${Date.now() - start}ms`)
    return response
  }
}

let router = createRouter({ middleware: [logger()] })
```

## Reference

`/home/lucky/remix/packages/fetch-router/README.md`