import { createContextKey, type Middleware } from 'remix/router'

export const JsonBody = createContextKey<unknown>()

export function jsonBody(options?: { maxSize?: number }): Middleware<{
  key: typeof JsonBody
  value: unknown
  property: 'jsonBody'
}> {
  return async (context, next) => {
    let contentType = context.request.headers.get('Content-Type') ?? ''

    if (contentType.includes('application/json')) {
      if (options?.maxSize) {
        let contentLength = Number(context.request.headers.get('Content-Length')) || 0
        if (contentLength > options.maxSize) {
          return Response.json({ error: 'Payload too large' }, { status: 413 })
        }
      }

      try {
        let body = await context.request.json()
        context.set(JsonBody, body, { property: 'jsonBody' })
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
    }

    return next()
  }
}
