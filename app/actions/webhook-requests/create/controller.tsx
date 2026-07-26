import { createController } from 'remix/router'
import { webhookCreateRoute } from '../../../routes.ts'
import { insertWebhookRequest } from '../../../data/webhook-requests.ts'
import { sourceIp } from '../../../utils/request-ip.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { Document } from '../../../ui/document.tsx'
import { Layout } from '../../../ui/layout.tsx'
import { WebhookComposerPage } from '../../../ui/webhook-composer-page.tsx'

export const webhookRequestsCreate = createController(webhookCreateRoute, {
  middleware: [requireAuth()],
  actions: {
    index(context) {
      return context.render(
        <Document title="Webhook erstellen">
          <Layout>
            <WebhookComposerPage />
          </Layout>
        </Document>,
      )
    },

    async action(context) {
      let payloadRaw = context.formData.get('payload')

      let payload: Record<string, string> = {}
      if (payloadRaw && typeof payloadRaw === 'string') {
        if (payloadRaw.length > 100_000) {
          return new Response('Payload too large', { status: 413 })
        }
        try {
          let parsed = JSON.parse(payloadRaw)
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            for (let [key, value] of Object.entries(parsed)) {
              if (key.trim()) {
                if (key.length > 256) {
                  return new Response('Key too long', { status: 400 })
                }
                let strValue = String(value)
                if (strValue.length > 10_000) {
                  return new Response('Value too long', { status: 400 })
                }
                payload[key] = strValue
              }
            }
          }
        } catch {
          return new Response('Invalid JSON payload', { status: 400 })
        }
      }

      let now = Date.now()
      try {
        await insertWebhookRequest(context.db, {
          payload: JSON.stringify(payload),
          headers: '{}',
          sourceIp: sourceIp(context.request),
          now,
        })
      } catch (err) {
        console.error('Failed to insert webhook request:', err)
        return new Response('Fehler beim Speichern', { status: 500 })
      }

      return new Response(null, {
        status: 303,
        headers: { Location: '/webhook-requests' },
      })
    },
  },
})
