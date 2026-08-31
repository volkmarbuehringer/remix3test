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
import { getCurrentUser } from '../../../utils/context.ts'

import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { AdminMessagesPage } from '../../../ui/admin-messages-page.tsx'
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

/** Clamps a query/form offset to a non-negative integer. */
function parseOffset(raw: string | null | undefined): number {
  let value = Number(raw ?? '')
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/** Clamps a query/form filter to a bounded string (optional). */
function parseFilter(raw: string | null | undefined): string | undefined {
  let value = raw?.trim() ?? ''
  return value ? value.slice(0, 200) : undefined
}

async function renderMessagesPage(
  context: any,
  offset: number,
  filter?: string,
): Promise<Response> {
  let effectivePageSize = getPageSize(context.session, MESSAGES_PAGE_LIMIT)

  let rows = await listMessages(context.db, effectivePageSize + 1, offset, filter)

  let hasMore = rows.length > effectivePageSize
  if (hasMore) rows.pop()

  return renderAdminPage(
    context.render,
    'messages',
    <AdminMessagesPage
      messages={rows}
      offset={offset}
      hasMore={hasMore}
      pageSize={effectivePageSize}
      prevOffset={Math.max(0, offset - effectivePageSize)}
      nextOffset={offset + effectivePageSize}
      filter={filter}
    />,
  )
}

export default createController(routes.admin.messages, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let offset = parseOffset(context.url.searchParams.get('offset'))
      let filter = parseFilter(context.url.searchParams.get('filter'))
      return renderMessagesPage(context, offset, filter)
    },

    // The frame commits the POST delete form action path (form action == frame
    // src) as its address after submission, and the live ConnectionIndicator
    // reloads it on invalidate. Render the list so that GET of the action path
    // resolves instead of falling to a 404 (POST-only route).
    async destroyResolve(context) {
      let offset = parseOffset(context.url.searchParams.get('offset'))
      let filter = parseFilter(context.url.searchParams.get('filter'))
      return renderMessagesPage(context, offset, filter)
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
      let rawOffset = context.formData.get('_offset') as string | null
      let offset = parseOffset(rawOffset)
      let filter = parseFilter(context.formData.get('_filter') as string | null)

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

      let urlParams = new URLSearchParams()
      if (offset > 0) urlParams.set('offset', String(offset))
      if (filter) urlParams.set('filter', filter)
      let qs = urlParams.toString()
      return redirect(routes.admin.messages.index.href() + (qs ? '?' + qs : ''))
    },

    subscribe(context) {
      return adminChannel.subscribe(context.request)
    },
  },
})
