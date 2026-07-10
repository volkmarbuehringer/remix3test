import { createContextKey, type Middleware } from 'remix/router'

const JsonRenderer = createContextKey<(data: unknown, init?: ResponseInit) => Response>()

/**
 * Middleware that installs `context.json()` — a JSON response renderer.
 *
 * Use in route handlers: `return context.json({ ok: true }, { status: 201 })`
 * Equivalent to `Response.json(data, init)` but avoids manually setting
 * `Content-Type: application/json` on every response.
 *
 * This is distinct from `context.render()` (from the UI render middleware)
 * which renders Remix UI nodes. Both renderers coexist on the same context
 * using different property names.
 */
export function json(): Middleware<{
  key: typeof JsonRenderer
  value: (data: unknown, init?: ResponseInit) => Response
  property: 'json'
}> {
  return (context, next) => {
    context.set(JsonRenderer, (data: unknown, init?: ResponseInit) => Response.json(data, init), {
      property: 'json',
    })
    return next()
  }
}
