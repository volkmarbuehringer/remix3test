import { createContextKey, type Middleware } from 'remix/router'

export const JsonBody = createContextKey<unknown>()

async function readBodyWithLimit(request: Request, maxSize: number): Promise<string | null> {
  let reader = request.body?.getReader()
  if (!reader) return null
  let chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    let { done, value } = await reader.read()
    if (done) break
    let data = value!
    total += data.length
    if (total > maxSize) {
      await reader.cancel()
      return null
    }
    chunks.push(data)
  }
  let merged = new Uint8Array(total)
  let offset = 0
  for (let chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return new TextDecoder().decode(merged)
}

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
        let isChunked = context.request.headers.get('Transfer-Encoding')?.toLowerCase() === 'chunked'

        if (isChunked || !contentLength) {
          let text = await readBodyWithLimit(context.request, options.maxSize)
          if (text === null) {
            return Response.json({ error: 'Payload too large' }, { status: 413 })
          }
          try {
            let body = JSON.parse(text)
            context.set(JsonBody, body, { property: 'jsonBody' })
          } catch {
            return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
          }
          return next()
        }

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
