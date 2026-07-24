import { createAction } from 'remix/router'
import { SuperHeaders } from 'remix/headers'
import { appWebhookRoute } from '../../routes.ts'
import { insertAppWebhookRequest } from '../../data/app-webhook.ts'
import { updateWebhookRequestHermesStatus } from '../../data/webhook-requests.ts'
import { webhookChannel } from '../../utils/sse-events.ts'
import { sourceIp } from '../../utils/request-ip.ts'
import { SENSITIVE_HEADERS } from '../../utils/sensitive-headers.ts'
import { apiTokenAuth } from '../../middleware/api-token-auth.ts'
import { requireApiAuth } from '../../middleware/api-require-auth.ts'
function hermesUrl(): string {
  return process.env.HERMES_URL ?? 'http://127.0.0.1:8644/webhooks/app-webhook'
}

const HERMES_TIMEOUT_MS = 3_000
const MAX_PAYLOAD_BYTES = 256 * 1024

interface WebhookInsertResult {
  id: string
}

export const appWebhookReceive = createAction(appWebhookRoute, {
  middleware: [apiTokenAuth(), requireApiAuth()],
  handler: async (context) => {
    let body = context.jsonBody
    if (!body) {
      return new Response('Expected application/json', { status: 400 })
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

    let id = await insertAppWebhookRequest(context.db, {
      serialized: serializedPayload,
      headers: JSON.stringify(headers),
      sourceIp: sourceIp(context.request),
      now,
    })
    if (!id) throw new Error('INSERT did not return an id')

    webhookChannel.broadcast('invalidate')

    let hermesStatusText: string
    let callbackUrl = process.env.WEBHOOK_CALLBACK_URL ?? 'http://[::1]:44100/callback'
    let hermesPayload = JSON.stringify({ id, callbackUrl, payload: body })
    if (process.env.NODE_ENV !== 'test')
      console.log(`[Webhook] Sende an Hermes: ${hermesUrl()} id=${id}`)

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

    await updateWebhookRequestHermesStatus(context.db, id, hermesStatusText)

    let responseHeaders = new SuperHeaders()
    responseHeaders.contentType = { mediaType: 'application/json' }

    let responseBody = { id, callbackUrl, payload: body }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: responseHeaders,
    })
  },
})
