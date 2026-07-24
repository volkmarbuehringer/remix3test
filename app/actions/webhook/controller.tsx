import { createAction } from 'remix/router'
import { SuperHeaders } from 'remix/headers'
import { webhookRoute } from '../../routes.ts'
import { insertWebhookRequest } from '../../data/webhook-requests.ts'
import { webhookChannel } from '../../utils/sse-events.ts'
import { sourceIp } from '../../utils/request-ip.ts'
import { SENSITIVE_HEADERS } from '../../utils/sensitive-headers.ts'
import { apiTokenAuth } from '../../middleware/api-token-auth.ts'
import { requireApiAuth } from '../../middleware/api-require-auth.ts'
import { createLogger } from '../../utils/logger.ts'
export const webhookReceive = createAction(webhookRoute, {
  middleware: [apiTokenAuth(), requireApiAuth()],
  handler: async (context) => {
    let log = createLogger('[Webhook]')

    let body = context.jsonBody
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
    let id = await insertWebhookRequest(context.db, {
      payload: serialized,
      headers: JSON.stringify(headers),
      sourceIp: sourceIp(context.request),
      now,
    })
    log('Gespeichert: id=' + id + ' size=' + serialized.length)

    webhookChannel.broadcast('invalidate')

    let responseHeaders = new SuperHeaders()
    responseHeaders.contentType = { mediaType: 'application/json' }
    return new Response(JSON.stringify({ id }), {
      status: 200,
      headers: responseHeaders,
    })
  },
})
