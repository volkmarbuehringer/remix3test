import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { logAdminAction } from '../../../data/audit-log.ts'
import { messages } from '../../../data/schema.ts'
import { listMessages } from '../../../data/admin-messages.ts'
import {
  adminChannel,
  messageRateLimiter,
  broadcastInvalidate,
} from '../../../utils/messages-sse.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { routes } from '../../../routes.ts'
import { getAdminIdentity, getCurrentUser } from '../../../utils/context.ts'

import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { AdminMessagesPage } from '../../../ui/admin-messages-page.tsx'
import type { AppContext } from '../../../types/context.ts'
import { parseId } from '../../../utils/ids.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'

const messageSchema = f.object({
  content: f.field(s.string()),
})

function sanitizeContent(content: string): string {
  return content
    .slice(0, 1000)
    .replace(/[<>'"&]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
}

const MESSAGES_PAGE_LIMIT = 10

export default createController<typeof routes.admin.messages, AppContext>(routes.admin.messages, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let effectivePageSize = getPageSize(context.session, MESSAGES_PAGE_LIMIT)
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)

      let rows = await listMessages(context.db, effectivePageSize + 1, offset)

      let hasMore = rows.length > effectivePageSize
      if (hasMore) rows.pop()

      return renderAdminPage(
        context.render,
        'messages',
        <AdminMessagesPage
          messages={rows}
          offset={offset}
          hasMore={hasMore}
          prevOffset={Math.max(0, offset - effectivePageSize)}
          nextOffset={offset + effectivePageSize}
        />,
      )
    },

    async action(context) {
      let db = context.db
      let formData = context.formData
      let parsed = s.parseSafe(messageSchema, formData)
      if (!parsed.success) {
        return new Response('Message content is required', { status: 400 })
      }
      let content = sanitizeContent(parsed.value.content)

      if (!content) {
        return new Response('Message content cannot be empty', { status: 400 })
      }

      let user = getCurrentUser()

      if (!messageRateLimiter.attempt(user.id)) {
        return new Response('Please wait before sending another message', {
          status: 429,
        })
      }

      let now = Date.now()
      let row = await db.create(
        messages,
        {
          sender_id: user.id,
          content,
          created_at: now,
        },
        { returnRow: true },
      )

      logAdminAction(context.db, {
        admin_user_id: user.id,
        admin_email: user.email,
        action_type: 'create',
        target_type: 'messages',
        target_id: row.id as number,
        details: { content_preview: content.slice(0, 100) },
      })

      broadcastInvalidate()

      return redirect(routes.admin.messages.index.href())
    },

    async destroy(context) {
      let db = context.db
      let { params } = context
      let messageId = parseId(params.id)

      if (messageId === undefined || messageId < 1) {
        return new Response('Invalid message ID', { status: 400 })
      }

      await db.delete(messages, { id: messageId })

      let user = getCurrentUser()
      logAdminAction(context.db, {
        admin_user_id: user.id,
        admin_email: user.email,
        action_type: 'destroy',
        target_type: 'messages',
        target_id: messageId,
      })

      broadcastInvalidate()

      return redirect(routes.admin.messages.index.href())
    },

    subscribe(context) {
      return adminChannel.subscribe(context.request)
    },
  },
})
