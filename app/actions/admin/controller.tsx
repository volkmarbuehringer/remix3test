import { ilike, or } from 'remix/data-table'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { logAdminAction } from '../../data/audit-log.ts'
import { lists, messages, users } from '../../data/schema.ts'
import type { User } from '../../data/schema.ts'
import { pool } from '../../data/setup.ts'
import { deleteConversation, getAllConversations, getConversation } from '../../lib/chatlog.ts'
import { adminChannel, messageRateLimiter, broadcastInvalidate } from '../../lib/messages-sse.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { fragmentResponseInit } from '../../middleware/render.tsx'
import { routes } from '../../routes.ts'
import type { AppContext } from '../../types/context.ts'
import { ChatLogPage } from '../../ui/admin-chatlog-page.tsx'
import { StatsFragment } from '../../ui/admin-fragments/stats-fragment.tsx'
import { RecentActivityFragment } from '../../ui/admin-fragments/recent-activity-fragment.tsx'
import { UserDetailFragment } from '../../ui/admin-fragments/user-detail-fragment.tsx'
import { ChatlogDetailFragment } from '../../ui/admin-fragments/chatlog-detail-fragment.tsx'
import { renderAdminPage } from '../../ui/admin-layout.tsx'
import { AdminListsPage } from '../../ui/admin-lists-page.tsx'
import { AdminMessagesPage } from '../../ui/admin-messages-page.tsx'
import { AdminDashboardContent } from '../../ui/admin-page.tsx'
import { AdminUsersPage } from '../../ui/admin-users-page.tsx'
import { getAdminIdentity, getCurrentUser } from '../../utils/context.ts'
import { gridStateFromForm, gridStateToParams } from '../../utils/grid-state.ts'
import { paginate } from '../../utils/pagination.ts'
import { hashPassword } from '../../utils/password-hash.ts'
import { validatePasswordComplexity } from '../../utils/password-complexity.ts'
import { parseSort } from '../../utils/sort-params.ts'

// ── Dashboard ──

export const adminController = createController(routes.admin, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    index(context) {
      return renderAdminPage(context.render, 'dashboard', <AdminDashboardContent />)
    },
  },
})

// ── Chatlog ──

const CHATLOG_MAX_FILTER_LENGTH = 200
const CHATLOG_PAGE_SIZE = 5

export const adminChatlog = createController<typeof routes.admin.chatlog, AppContext>(routes.admin.chatlog, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async index(context) {
      try {
        let filter = context.url.searchParams.get('filter') ?? undefined
        if (filter && filter.length > CHATLOG_MAX_FILTER_LENGTH) {
          filter = filter.slice(0, CHATLOG_MAX_FILTER_LENGTH)
        }

        let rawType = context.url.searchParams.get('type')
        let type: 'chat' | 'agent' | undefined
        if (rawType === 'chat' || rawType === 'agent') {
          type = rawType
        }

        let rawPage = parseInt(context.url.searchParams.get('page') ?? '1', 10)
        let page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1
        let offset = (page - 1) * CHATLOG_PAGE_SIZE

        let allConversations = await getAllConversations(filter, CHATLOG_PAGE_SIZE + 1, offset, type)

        let hasMore = allConversations.length > CHATLOG_PAGE_SIZE
        let conversations = hasMore ? allConversations.slice(0, CHATLOG_PAGE_SIZE) : allConversations

        return renderAdminPage(context.render, 'chatlog', <ChatLogPage conversations={conversations} filter={filter} type={type} page={page} hasMore={hasMore} />)
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') console.error('[Admin Chatlog] Error loading conversations:', error)
        return renderAdminPage(context.render, 'chatlog', <ChatLogPage conversations={[]} filter={undefined} type={undefined} page={1} hasMore={false} />)
      }
    },

    async destroy(context) {
      let { params } = context
      await deleteConversation(params.id)

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'chatlog',
          target_id: params.id,
        })
      }

      return redirect(routes.admin.chatlog.index.href())
    },
  },
})

// ── Chatlog Fragments ──

export const adminChatlogFragments = createController(
  routes.admin.chatlog.fragments,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async detail(context) {
        let conversationId = context.params.id

        if (!conversationId) {
          return context.render(
            <ChatlogDetailFragment conversationId="" messages={[]} error="No conversation ID provided" />,
            fragmentResponseInit(),
          )
        }

        let chat = await getConversation(conversationId)

        if (!chat) {
          return context.render(
            <ChatlogDetailFragment conversationId={conversationId} messages={[]} error="Conversation not found" />,
            fragmentResponseInit(),
          )
        }

        return context.render(
          <ChatlogDetailFragment
            conversationId={chat.id}
            messages={chat.conversation}
          />,
          fragmentResponseInit(),
        )
      },
    },
  },
)

// ── Messages ──

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

export const adminMessages = createController(routes.admin.messages, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)

      let result = await pool.query(
        `SELECT m.id, m.sender_id, u.name AS sender_name, m.content, m.created_at
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         ORDER BY m.created_at DESC
         LIMIT $1
         OFFSET $2`,
        [MESSAGES_PAGE_LIMIT + 1, offset],
      )

      let rows = result.rows.map((row: Record<string, unknown>) => ({
        id: typeof row.id === 'string' ? Number(row.id) : (row.id as number),
        sender_id: typeof row.sender_id === 'string' ? Number(row.sender_id) : (row.sender_id as number),
        sender_name: row.sender_name as string,
        content: row.content as string,
        created_at: typeof row.created_at === 'string' ? Number(row.created_at) : (row.created_at as number),
      }))

      let hasMore = rows.length > MESSAGES_PAGE_LIMIT
      if (hasMore) rows.pop()

      return renderAdminPage(
        context.render,
        'messages',
        <AdminMessagesPage
          messages={rows}
          offset={offset}
          hasMore={hasMore}
          prevOffset={Math.max(0, offset - MESSAGES_PAGE_LIMIT)}
          nextOffset={offset + MESSAGES_PAGE_LIMIT}
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

// ── Fragments ──

export const adminFragments = createController(
  routes.admin.fragments,
  {
    middleware: [requireAuth(), requireAdmin()],

    actions: {
      async stats(context) {
        await delay(50)

        let now = new Date()
        let uptimeSeconds = Math.floor(process.uptime())
        let hours = Math.floor(uptimeSeconds / 3600)
        let minutes = Math.floor((uptimeSeconds % 3600) / 60)

        return context.render(
          <StatsFragment
            serverTime={now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            serverDate={now.toLocaleDateString('de-DE')}
            uptime={`${hours}h ${minutes}m`}
            nodeVersion={process.version}
          />,
          fragmentResponseInit(),
        )
      },

      async recentActivity(context) {
        await delay(100)

        let now = new Date()

        let activities = [
          { id: 1, userId: 101, action: 'Created a new chat conversation', time: new Date(now.getTime() - 30000) },
          { id: 2, userId: 102, action: 'Deleted a workflow', time: new Date(now.getTime() - 120000) },
          { id: 3, userId: 103, action: 'Updated AI agent configuration', time: new Date(now.getTime() - 300000) },
          { id: 4, userId: 101, action: 'Exported chat log', time: new Date(now.getTime() - 600000) },
          { id: 5, userId: 104, action: 'Modified admin settings', time: new Date(now.getTime() - 900000) },
          { id: 6, userId: 102, action: 'Ran a new agent process', time: new Date(now.getTime() - 1800000) },
        ]

        return context.render(
          <RecentActivityFragment activities={activities} />,
          fragmentResponseInit(),
        )
      },

      async userDetail(context) {
        await delay(30)

        let userId = Number(context.params.userId)
        let userNames: Record<number, string> = {
          101: 'Alice Johnson',
          102: 'Bob Smith',
          103: 'Carol Williams',
          104: 'David Brown',
        }
        let userRoles: Record<number, string> = {
          101: 'Admin',
          102: 'Editor',
          103: 'Viewer',
          104: 'Viewer',
        }

        return context.render(
          <UserDetailFragment
            userId={userId}
            name={userNames[userId] ?? `User #${userId}`}
            role={userRoles[userId] ?? 'Unknown'}
          />,
          fragmentResponseInit(),
        )
      },
    },
  },
)

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Lists ──

const LISTS_PAGE_LIMIT = 10

export const adminLists = createController<typeof routes.admin.lists, AppContext>(routes.admin.lists, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined

      let rows: any[]
      let hasMore: boolean

      if (filter) {
        if (filter.length > 200) filter = filter.slice(0, 200)
        let searchPattern = `%${filter}%`
        let result = await pool.query(
          `SELECT * FROM lists
           WHERE description ILIKE $1
              OR EXISTS (
                SELECT 1 FROM jsonb_array_elements(list) item
                WHERE item->>'label' ILIKE $1
              )
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [searchPattern, LISTS_PAGE_LIMIT + 1, offset],
        )
        rows = result.rows.map((row: Record<string, unknown>) => {
          let list = row.list
          if (typeof list === 'string') {
            try { list = JSON.parse(list) } catch { list = [] }
          }
          return {
            ...row,
            list,
            created_at: typeof row.created_at === 'string' ? Number(row.created_at) : row.created_at,
            updated_at: typeof row.updated_at === 'string' ? Number(row.updated_at) : row.updated_at,
          }
        })
        hasMore = rows.length > LISTS_PAGE_LIMIT
        if (hasMore) rows.pop()
      } else {
        rows = await context.db.findMany(lists, {
          limit: LISTS_PAGE_LIMIT + 1,
          offset,
          orderBy: [['created_at', 'desc']] as const,
        })
        hasMore = rows.length > LISTS_PAGE_LIMIT
        if (hasMore) rows.pop()
      }

      return renderAdminPage(
        context.render,
        'lists',
        <AdminListsPage
          lists={rows as any[]}
          offset={offset}
          hasMore={hasMore}
          filter={filter}
          prevOffset={Math.max(0, offset - LISTS_PAGE_LIMIT)}
          nextOffset={offset + LISTS_PAGE_LIMIT}
        />,
      )
    },

    async destroy(context) {
      let db = context.db
      let listId = Number(context.params.id)

      if (!Number.isFinite(listId) || !Number.isInteger(listId) || listId < 1) {
        return new Response('Invalid list ID', { status: 400 })
      }

      await db.delete(lists, { id: listId })

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'lists',
          target_id: listId,
        })
      }

      let filter = context.url.searchParams.get('filter')
      let offset = context.url.searchParams.get('offset')
      let params = new URLSearchParams()
      if (offset) params.set('offset', offset)
      if (filter) params.set('filter', filter)
      let qs = params.toString()

      return new Response(null, {
        status: 302,
        headers: { Location: routes.admin.lists.index.href() + (qs ? '?' + qs : '') },
      })
    },
  },
})

// ── Users ──

type SafeUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'email_verified' | 'created_at' | 'updated_at'>

const USERS_PAGE_SIZE = 15

const SORTABLE_FIELDS = ['id', 'name', 'email', 'role', 'created_at'] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const userCreateSchema = f.object({
  name: f.field(s.defaulted(s.string(), '')),
  email: f.field(s.defaulted(s.string(), '')),
  role: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.defaulted(s.string(), '')),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

const userUpdateSchema = f.object({
  name: f.field(s.defaulted(s.string(), '')),
  email: f.field(s.defaulted(s.string(), '')),
  role: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.defaulted(s.string(), '')),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

export const adminUsers = createController<typeof routes.admin.users, AppContext>(routes.admin.users, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let db = context.db
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let pageNum = Math.floor(offset / USERS_PAGE_SIZE) + 1
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_FIELDS,
        defaultColumn: 'name',
        defaultDirection: 'asc',
      })

      let filterPredicate = filter
        ? or(ilike('name', `%${filter}%`), ilike('email', `%${filter}%`))
        : undefined

      let { items: page, hasMore } = await paginate(db, users, {
        pageSize: USERS_PAGE_SIZE,
        page: pageNum,
        orderBy: [[column, direction]],
        where: filterPredicate as Record<string, unknown>,
      })

      let rows: SafeUser[] = (page as User[]).map(
        (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, email_verified: u.email_verified, created_at: u.created_at, updated_at: u.updated_at }),
      )

      let editingParam = context.url.searchParams.get('editing')
      let editingRowId = editingParam ? Number(editingParam) : null
      let editRow: SafeUser | null = null
      if (editingRowId && Number.isFinite(editingRowId)) {
        let found = await db.findOne(users, { where: { id: editingRowId } })
        if (found) {
          let u = found as User
          editRow = { id: u.id!, email: u.email, name: u.name, role: u.role, email_verified: u.email_verified, created_at: u.created_at!, updated_at: u.updated_at! }
        }
      }

      let creating = context.url.searchParams.get('creating') === 'true'

      return renderAdminPage(
        context.render,
        'users',
        <AdminUsersPage
          rows={rows}
          offset={offset}
          hasMore={hasMore}
          prevOffset={Math.max(0, offset - USERS_PAGE_SIZE)}
          nextOffset={offset + USERS_PAGE_SIZE}
          sortColumn={column}
          sortDirection={direction}
          filter={filter}
          editRow={editRow}
          creating={creating}
        />,
      )
    },

    async create(context) {
      let db = context.db
      let formData = context.formData

      let parseResult = s.parseSafe(userCreateSchema, formData)
      if (!parseResult.success) {
        return context.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
      }
      let fields = parseResult.value

      if (!fields.name || !fields.name.trim()) {
        return context.json({ ok: false, error: 'Name is required' }, { status: 400 })
      }
      if (!fields.email || !EMAIL_RE.test(fields.email)) {
        return context.json({ ok: false, error: 'Invalid email format' }, { status: 400 })
      }
      if (!fields.password) {
        return context.json({ ok: false, error: 'Password is required' }, { status: 400 })
      }
      let complexityError = validatePasswordComplexity(fields.password)
      if (complexityError) {
        return context.json({ ok: false, error: complexityError }, { status: 400 })
      }

      let existing = await db.findOne(users, { where: { email: fields.email.trim().toLowerCase() } })
      if (existing) {
        return context.json({ ok: false, error: 'Email already exists' }, { status: 400 })
      }

      let passwordHash = await hashPassword(fields.password)
      let role = fields.role === 'admin' ? 'admin' : 'customer'

      let row = await db.create(
        users,
        {
          name: fields.name.trim(),
          email: fields.email.trim().toLowerCase(),
          password_hash: passwordHash,
          role,
        },
        { returnRow: true },
      )

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'create',
          target_type: 'users',
          target_id: row.id as number,
          details: { name: fields.name.trim(), email: fields.email.trim().toLowerCase(), role },
        })
      }

      let redirectState = gridStateFromForm(fields)
      let params = gridStateToParams(redirectState)
      params.set('editing', String(row.id))
      let baseUrl = routes.admin.users.index.href()
      return new Response(null, {
        status: 302,
        headers: { Location: baseUrl + '?' + params.toString() },
      })
    },

    async update(context) {
      let db = context.db
      let formData = context.formData

      let id = Number(context.params.id)
      if (!Number.isFinite(id) || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let parseResult = s.parseSafe(userUpdateSchema, formData)
      if (!parseResult.success) {
        return context.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
      }
      let fields = parseResult.value

      if (fields.email && !EMAIL_RE.test(fields.email)) {
        return context.json({ ok: false, error: 'Invalid email format' }, { status: 400 })
      }

      if (fields.email) {
        let existing = await db.findOne(users, { where: { email: fields.email.trim().toLowerCase() } })
        if (existing && existing.id !== id) {
          return context.json({ ok: false, error: 'Email already exists' }, { status: 400 })
        }
      }

      let changes: Record<string, unknown> = {}
      if (fields.name?.trim()) changes.name = fields.name.trim()
      if (fields.email?.trim()) changes.email = fields.email.trim().toLowerCase()
      if (fields.role === 'admin' || fields.role === 'customer') changes.role = fields.role
      if (fields.password) {
        let complexityError = validatePasswordComplexity(fields.password)
        if (complexityError) {
          return context.json({ ok: false, error: complexityError }, { status: 400 })
        }
        changes.password_hash = await hashPassword(fields.password)
      }

      await db.updateMany(users, changes, { where: { id } })

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        let safeChanges = { ...changes }
        if ('password_hash' in safeChanges) {
          safeChanges.password_hash = '***REDACTED***'
        }
        await logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'update',
          target_type: 'users',
          target_id: id,
          details: { changes: safeChanges },
        })
      }

      let redirectState = gridStateFromForm(fields)
      let params = gridStateToParams(redirectState)
      let qs = params.toString()
      let baseUrl = routes.admin.users.index.href()
      return new Response(null, {
        status: 302,
        headers: { Location: baseUrl + (qs ? '?' + qs : '') },
      })
    },

    async destroy(context) {
      let db = context.db
      let formData = context.formData

      let id = Number(context.params.id)
      if (!Number.isFinite(id) || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let existing = await db.findOne(users, { where: { id } })
      if (!existing) {
        return context.json({ ok: false, error: 'User not found' }, { status: 404 })
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity && id === authIdentity.id) {
        return context.json({ ok: false, error: 'Cannot delete your own account' }, { status: 403 })
      }

      let user = existing as User
      if (user.role === 'admin') {
        let adminCount = await db.count(users, { where: { role: 'admin' } })
        if (adminCount <= 1) {
          return context.json({ ok: false, error: 'Cannot delete the last admin account' }, { status: 403 })
        }
      }

      await db.deleteMany(users, { where: { id } })

      if (authIdentity) {
        await logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'users',
          target_id: id,
        })
      }

      let parseResult = s.parseSafe(userUpdateSchema, formData)
      let fields = parseResult.success ? parseResult.value : { name: '', email: '', role: '', password: '', _offset: '', _sort: '', _order: '', _filter: '' }
      let params = gridStateToParams(gridStateFromForm(fields))
      let qs = params.toString()
      let baseUrl = routes.admin.users.index.href()
      return new Response(null, {
        status: 302,
        headers: { Location: baseUrl + (qs ? '?' + qs : '') },
      })
    },
  },
})
