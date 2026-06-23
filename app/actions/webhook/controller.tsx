import { createAction } from 'remix/router'
import { SuperHeaders } from 'remix/headers'
import { pool } from '../../data/setup.ts'
import { webhookRoute } from '../../routes.ts'
import { webhookChannel } from '../../lib/sse-events.ts'
import type { AppContext } from '../../types/context.ts'

const SENSITIVE_HEADERS = new Set([
  'authorization', 'cookie', 'set-cookie', 'proxy-authorization',
  'x-api-key', 'x-auth-token', 'www-authenticate', 'x-client-ip',
])

const MAX_PAYLOAD_BYTES = 256 * 1024

export const webhookReceive = createAction<typeof webhookRoute, AppContext>(
  webhookRoute,
  {
    handler: async (context) => {
      let token = context.params.token
      let expected = process.env.WEBHOOK_TOKEN
      if (expected === undefined || expected === '') {
        return new Response('Service unavailable', { status: 503 })
      }
      if (token !== expected) {
        return new Response('Unauthorized', { status: 401 })
      }

      let contentType = context.request.headers.get('Content-Type') ?? ''
      if (!contentType.includes('application/json')) {
        return new Response('Expected application/json', { status: 400 })
      }

      let contentLength = Number(context.request.headers.get('Content-Length')) || 0
      if (contentLength > MAX_PAYLOAD_BYTES) {
        return new Response('Payload too large', { status: 413 })
      }

      let body
      try {
        body = await context.request.json()
      } catch {
        return new Response('Invalid JSON body', { status: 400 })
      }

      let now = Date.now()

      let headers: Record<string, string> = {}
      context.request.headers.forEach((value, key) => {
        if (!SENSITIVE_HEADERS.has(key.toLowerCase())) {
          headers[key] = value
        }
      })

      let sourceIp =
        context.request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
        context.request.headers.get('X-Real-Ip') ??
        context.request.headers.get('X-Client-Ip') ??
        ''

      let result = await pool.query(
        `INSERT INTO webhook_requests (payload, token, headers, source_ip, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [JSON.stringify(body), token, JSON.stringify(headers), sourceIp, now],
      )

      let id = result.rows[0].id

      webhookChannel.broadcast('new_request')

      let responseHeaders = new SuperHeaders()
      responseHeaders.contentType = { mediaType: 'application/json' }
      return new Response(JSON.stringify({ id }), {
        status: 200,
        headers: responseHeaders,
      })
    },
  },
)
