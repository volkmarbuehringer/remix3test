import { createController } from 'remix/router'
import { pool } from '../../../data/setup.ts'
import { webhookCreateRoute } from '../../../routes.ts'
import { sourceIp } from '../../../lib/request-ip.ts'
import type { AppContext } from '../../../types/context.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { Document } from '../../../ui/document.tsx'
import { Layout } from '../../../ui/layout.tsx'
import { WebhookComposerPage } from '../../../ui/webhook-composer-page.tsx'

export const webhookRequestsCreate = createController<typeof webhookCreateRoute, AppContext>(
  webhookCreateRoute,
  {
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
          try {
            let parsed = JSON.parse(payloadRaw)
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              for (let [key, value] of Object.entries(parsed)) {
                if (key.trim()) {
                  payload[key] = String(value)
                }
              }
            }
          } catch {
            return new Response('Invalid JSON payload', { status: 400 })
          }
        }

        let now = Date.now()
        try {
          await pool.query(
            `INSERT INTO webhook_requests (payload, token, headers, source_ip, created_at)
             VALUES ($1, '', '{}', $2, $3)`,
            [JSON.stringify(payload), sourceIp(context.request), now],
          )
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
  },
)
