import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

import { messages } from '../../data/schema.ts'
import { pool } from '../../data/setup.ts'
import { adminChannel, messageRateLimiter, broadcastInvalidate } from '../../lib/messages-sse.ts'
import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { renderAdminPage } from '../../ui/admin-layout.tsx'
import { AdminMessagesPage } from '../../ui/admin-messages-page.tsx'
import { logAdminAction } from '../../data/audit-log.ts'

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

const PAGE_LIMIT = 10

export default createController<typeof routes.admin.messages, AppContext>(routes.admin.messages, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)

      // Query messages with sender name via raw join
      let result = await pool.query(
        `SELECT m.id, m.sender_id, u.name AS sender_name, m.content, m.created_at
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         ORDER BY m.created_at DESC
         LIMIT $1
         OFFSET $2`,
        [PAGE_LIMIT + 1, offset],
      )

      let rows = result.rows.map((row: Record<string, unknown>) => ({
        id: typeof row.id === 'string' ? Number(row.id) : (row.id as number),
        sender_id: typeof row.sender_id === 'string' ? Number(row.sender_id) : (row.sender_id as number),
        sender_name: row.sender_name as string,
        content: row.content as string,
        created_at: typeof row.created_at === 'string' ? Number(row.created_at) : (row.created_at as number),
      }))

      let hasMore = rows.length > PAGE_LIMIT
      if (hasMore) rows.pop()

      return renderAdminPage(
        context.render,
        'messages',
        <AdminMessagesPage
          messages={rows}
          offset={offset}
          hasMore={hasMore}
          prevOffset={Math.max(0, offset - PAGE_LIMIT)}
          nextOffset={offset + PAGE_LIMIT}
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

      // Check rate limit
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

      logAdminAction(pool, {
        admin_user_id: user.id,
        admin_email: user.email,
        action_type: 'create',
        target_type: 'messages',
        target_id: row.id as number,
        details: { content_preview: content.slice(0, 100) },
      })

      broadcastInvalidate()

      return new Response(null, {
        status: 302,
        headers: { Location: routes.admin.messages.index.href() },
      })
    },

    async destroy(context) {
      let db = context.db
      let { params } = context
      let messageId = Number(params.id)

      if (!Number.isFinite(messageId) || messageId < 1) {
        return new Response('Invalid message ID', { status: 400 })
      }

      await db.delete(messages, { id: messageId })

      let user = getCurrentUser()
      logAdminAction(pool, {
        admin_user_id: user.id,
        admin_email: user.email,
        action_type: 'destroy',
        target_type: 'messages',
        target_id: messageId,
      })

      broadcastInvalidate()

      return new Response(null, {
        status: 302,
        headers: { Location: routes.admin.messages.index.href() },
      })
    },

    subscribe(context) {
      return adminChannel.subscribe(context.request)
    },
  },
})
