<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: Fetch Router

**Purpose**: Minimal, composable router built on web Fetch API. Define typed route maps, run middleware, share request-scoped context.

**Key Points**:
- Built on standard Fetch API (works in Node, Bun, Deno, Workers)
- Type-safe routing with compile-time validation
- Declarative route maps with `route()`, `form()`, `resources()`
- Flexible middleware: global, per-route, or route hierarchies
- Easy testing with standard `fetch()`

**Minimal Example**:
```ts
import { createRouter } from 'remix/fetch-router'
import { route, form } from 'remix/fetch-router/routes'

let routes = route({
  home: '/',
  contact: form('contact'),
})

let router = createRouter({ middleware: [logger()] })

router.map(routes, {
  actions: {
    home() { return new Response('Home') },
    contact: {
      actions: {
        index() { return new Response('Contact form') },
        action({ get }) {
          let data = get(FormData)
          return new Response('Submitted')
        },
      },
    },
  },
})
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/fetch-router