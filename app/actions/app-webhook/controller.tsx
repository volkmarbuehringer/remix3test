import { createAction } from 'remix/router'
import { SuperHeaders } from 'remix/headers'
import { pool } from '../../data/setup.ts'
import { appWebhookRoute } from '../../routes.ts'
import { webhookChannel } from '../../lib/sse-events.ts'
import { sourceIp } from '../../lib/request-ip.ts'
import { authenticateWebhook, verifyWebhookHmac, SENSITIVE_HEADERS } from '../../lib/auth-webhook.ts'
import type { AppContext } from '../../types/context.ts'

function hermesUrl(): string {
  return process.env.HERMES_URL ?? 'http://127.0.0.1:8644/webhooks/app-webhook'
}

const HERMES_TIMEOUT_MS = 3_000
const MAX_PAYLOAD_BYTES = 256 * 1024

interface WebhookInsertResult {
  id: string
}

export const appWebhookReceive = createAction<typeof appWebhookRoute, AppContext>(
  appWebhookRoute,
  {
    handler: async (context) => {
      let auth = authenticateWebhook(context.request)
      if (auth instanceof Response) return auth

      let contentLength = Number(context.request.headers.get('Content-Length')) || 0
      if (contentLength > MAX_PAYLOAD_BYTES) {
        return new Response('Payload too large', { status: 413 })
      }

      let hmacResult = await verifyWebhookHmac(context.request, auth)
      if (hmacResult) return hmacResult

      let contentType = context.request.headers.get('Content-Type') ?? ''
      if (!contentType.includes('application/json')) {
        return new Response('Expected application/json', { status: 400 })
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

      let result = await pool.query<WebhookInsertResult>(
        `INSERT INTO webhook_requests (payload, headers, source_ip, created_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [serializedPayload, JSON.stringify(headers), sourceIp(context.request), now],
      )

      let row = result.rows[0]
      if (!row?.id) throw new Error('INSERT did not return an id')
      let id = row.id

      webhookChannel.broadcast('invalidate')

      let hermesStatusText: string
      let callbackUrl = process.env.WEBHOOK_CALLBACK_URL ?? 'http://[::1]:44100/callback'
      let hermesPayload = JSON.stringify({ id, callbackUrl, payload: body })
      if (process.env.NODE_ENV !== 'test') console.log(`[Webhook] Sende an Hermes: ${hermesUrl()} payload=${hermesPayload}`)

      try {
        let signal = AbortSignal.timeout(HERMES_TIMEOUT_MS)
        let hermesResponse = await fetch(hermesUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: hermesPayload,
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

      let responseBody = { id, callbackUrl, payload: body }

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: responseHeaders,
      })
    },
  },
)
