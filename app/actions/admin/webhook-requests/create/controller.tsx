import { createController } from 'remix/router'

import { routes } from '../../../../routes.ts'
import {
  insertWebhookRequest,
  parseWebhookRequestPayload,
} from '../../../../data/webhook-requests.ts'
import { sourceIp } from '../../../../utils/request-ip.ts'
import { requireAuth } from '../../../../middleware/auth.ts'
import { requireAdmin } from '../../../../middleware/admin.ts'
import { logAdminAction } from '../../../../data/audit-log.ts'
import { getAdminIdentity } from '../../../../utils/context.ts'
import { webhookChannel } from '../../../../utils/sse-events.ts'
import { renderAdminPage } from '../../../../ui/admin-layout.tsx'
import { AdminWebhookComposerPage } from '../../../../ui/admin-webhook-composer-page.tsx'

export default createController(routes.admin.webhookRequests.create, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    index(context) {
      return renderAdminPage(context.render, 'webhooks', <AdminWebhookComposerPage />)
    },

    async action(context) {
      let rawPayload = context.formData.get('payload')
      let parsed = parseWebhookRequestPayload(rawPayload)
      let submitted = typeof rawPayload === 'string' ? rawPayload : undefined

      if (!parsed.ok) {
        return renderAdminPage(
          context.render,
          'webhooks',
          <AdminWebhookComposerPage initialPayload={submitted} formError={parsed.message} />,
          { status: 200 },
        )
      }

      let id: string
      try {
        id = await insertWebhookRequest(context.db, {
          payload: JSON.stringify(parsed.payload),
          headers: '{}',
          sourceIp: sourceIp(context.request),
          now: Date.now(),
        })
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('Failed to insert webhook request: ' + String(error))
        }
        return renderAdminPage(
          context.render,
          'webhooks',
          <AdminWebhookComposerPage
            initialPayload={submitted}
            formError="Fehler beim Speichern."
          />,
          { status: 200 },
        )
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'create',
          target_type: 'webhook_requests',
          target_id: id,
        })
      }

      webhookChannel.broadcast('invalidate')
      context.session.flash('success', 'Webhook erstellt.')

      // 303 (not the redirect() 302 default) keeps the PRG method-safe, matching
      // the update/resend handlers and the pre-relocation behaviour.
      return new Response(null, {
        status: 303,
        headers: { Location: routes.admin.webhookRequests.index.href() + '?editing=' + id },
      })
    },
  },
})
