import { createContextKey, type Middleware } from 'remix/router'

const JsonRenderer = createContextKey<(data: unknown, init?: ResponseInit) => Response>()

export function json(): Middleware<{
  key: typeof JsonRenderer
  value: (data: unknown, init?: ResponseInit) => Response
  property: 'json'
}> {
  return (context) => {
    context.set(
      JsonRenderer,
      (data: unknown, init?: ResponseInit) => Response.json(data, init),
      { property: 'json' },
    )
  }
}
