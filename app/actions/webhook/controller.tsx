import { createAction } from 'remix/router'
import { SuperHeaders } from 'remix/headers'
import { pool } from '../../data/setup.ts'
import { webhookRoute } from '../../routes.ts'
import { webhookChannel } from '../../lib/sse-events.ts'
import { sourceIp } from '../../lib/request-ip.ts'
import { SENSITIVE_HEADERS } from '../../lib/sensitive-headers.ts'
import { JsonBody } from '../../middleware/json-body.ts'
import { apiTokenAuth } from '../../middleware/api-token-auth.ts'
import { requireApiAuth } from '../../middleware/api-require-auth.ts'
import type { AppContext } from '../../types/context.ts'


export const webhookReceive = createAction<typeof webhookRoute, AppContext>(
  webhookRoute,
  {
    middleware: [apiTokenAuth(), requireApiAuth()],
    handler: async (context) => {
      let log = process.env.NODE_ENV !== 'test' ? console.log.bind(console, '[Webhook]') : () => {}

      let body = context.get(JsonBody)
      if (!body) {
        return new Response('Expected application/json', { status: 400 })
      }

      let now = Date.now()

      let headers: Record<string, string> = {}
      context.request.headers.forEach((value, key) => {
        if (!SENSITIVE_HEADERS.has(key.toLowerCase())) {
          headers[key] = value
        }
      })

      let serialized = JSON.stringify(body)
      let result = await pool.query(
        `INSERT INTO webhook_requests (payload, headers, source_ip, created_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [serialized, JSON.stringify(headers), sourceIp(context.request), now],
      )

      let id = result.rows[0].id
      log('Gespeichert: id=' + id + ' payload=' + serialized.slice(0, 500))

      webhookChannel.broadcast('invalidate')

      let responseHeaders = new SuperHeaders()
      responseHeaders.contentType = { mediaType: 'application/json' }
      return new Response(JSON.stringify({ id }), {
        status: 200,
        headers: responseHeaders,
      })
    },
  },
)
