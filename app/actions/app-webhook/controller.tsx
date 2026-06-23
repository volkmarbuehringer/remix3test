import { createAction } from 'remix/router'
import { SuperHeaders } from 'remix/headers'
import { pool } from '../../data/setup.ts'
import { appWebhookRoute } from '../../routes.ts'
import { webhookChannel } from '../../lib/sse-events.ts'
import type { AppContext } from '../../types/context.ts'

function hermesUrl(): string {
  return process.env.HERMES_URL ?? 'http://127.0.0.1:8644/webhooks/app-webhook'
}

const HERMES_TIMEOUT_MS = 3_000
const MAX_PAYLOAD_BYTES = 256 * 1024

const SENSITIVE_HEADERS = new Set([
  'authorization', 'cookie', 'set-cookie', 'proxy-authorization',
  'x-api-key', 'x-auth-token', 'www-authenticate', 'x-client-ip',
])

interface WebhookInsertResult {
  id: string
}

export const appWebhookReceive = createAction<typeof appWebhookRoute, AppContext>(
  appWebhookRoute,
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

      let serializedPayload = JSON.stringify(body)
      if (serializedPayload.length > MAX_PAYLOAD_BYTES) {
        return new Response('Payload too large', { status: 413 })
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

      let result = await pool.query<WebhookInsertResult>(
        `INSERT INTO webhook_requests (payload, token, headers, source_ip, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [serializedPayload, token, JSON.stringify(headers), sourceIp, now],
      )

      let row = result.rows[0]
      if (!row?.id) throw new Error('INSERT did not return an id')
      let id = row.id

      webhookChannel.broadcast('new_request')

      let hermesStatusText: string

      try {
        let signal = AbortSignal.timeout(HERMES_TIMEOUT_MS)
        let hermesResponse = await fetch(hermesUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, payload: body }),
          signal,
        })
        hermesStatusText = String(hermesResponse.status)
      } catch {
        hermesStatusText = 'error'
      }

      await pool.query(
        `UPDATE webhook_requests SET hermes_status = $1 WHERE id = $2`,
        [hermesStatusText, id],
      )

      let responseHeaders = new SuperHeaders()
      responseHeaders.contentType = { mediaType: 'application/json' }

      let callbackUrl = process.env.WEBHOOK_CALLBACK_URL ?? 'http://127.0.0.1:44100/webhook-response'
      let responseBody = { id, callbackUrl, payload: body }

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: responseHeaders,
      })
    },
  },
)
