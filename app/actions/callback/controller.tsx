import { createAction } from 'remix/router'
import { SuperHeaders } from 'remix/headers'
import { pool } from '../../data/setup.ts'
import { callbackRoute } from '../../routes.ts'
import { webhookChannel } from '../../lib/sse-events.ts'
import { sourceIp, isLocalhost } from '../../lib/request-ip.ts'
import type { AppContext } from '../../types/context.ts'

const MAX_PAYLOAD_BYTES = 256 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const callbackReceive = createAction<typeof callbackRoute, AppContext>(
  callbackRoute,
  {
    handler: async (context) => {
      let log = process.env.NODE_ENV !== 'test' ? console.log.bind(console, '[Callback]') : () => {}

      let ip = sourceIp(context.request)
      if (!isLocalhost(ip)) {
        log('Blocked non-localhost request from', ip)
        return new Response('Forbidden', { status: 403 })
      }

      let contentType = context.request.headers.get('Content-Type') ?? ''
      if (!contentType.includes('application/json')) {
        log('Expected application/json, got', contentType)
        return new Response('Expected application/json', { status: 400 })
      }

      let contentLength = Number(context.request.headers.get('Content-Length')) || 0
      if (contentLength > MAX_PAYLOAD_BYTES) {
        log('Payload too large:', contentLength, 'bytes')
        return new Response('Payload too large', { status: 413 })
      }

      let body: Record<string, unknown>
      try {
        body = await context.request.json()
      } catch {
        log('Invalid JSON body')
        return new Response('Invalid JSON body', { status: 400 })
      }

      log('Received:', JSON.stringify(body))

      let serialized = JSON.stringify(body)
      if (serialized.length > MAX_PAYLOAD_BYTES) {
        log('Serialized payload too large:', serialized.length, 'bytes')
        return new Response('Payload too large', { status: 413 })
      }

      let id = body?.id
      if (!id || typeof id !== 'string') {
        log('Missing or invalid id field in:', JSON.stringify(body))
        return new Response('Missing or invalid id', { status: 400 })
      }
      if (!UUID_RE.test(id)) {
        log('Invalid UUID format for id:', id, 'in', JSON.stringify(body))
        return new Response('Invalid UUID format for id', { status: 400 })
      }

      let now = Date.now()

      let result = await pool.query(
        `UPDATE webhook_requests SET callback_response = $1, callback_received_at = $2 WHERE id = $3 AND callback_received_at IS NULL`,
        [serialized, now, id],
      )

      if (result.rowCount === 0) {
        let exists = await pool.query(`SELECT 1 FROM webhook_requests WHERE id = $1`, [id])
        if (exists.rowCount === 0) {
          return new Response('Not Found', { status: 404 })
        }
        return new Response('Conflict: callback already received', { status: 409 })
      }

      webhookChannel.broadcast('callback_received')
      webhookChannel.broadcast('invalidate')

      let responseHeaders = new SuperHeaders()
      responseHeaders.contentType = { mediaType: 'application/json' }
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: responseHeaders,
      })
    },
  },
)
