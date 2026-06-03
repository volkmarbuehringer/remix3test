import { createController } from 'remix/router'
import { ilike, or } from 'remix/data-table'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

import { adminRoutes as routes } from '../routes.ts'
import { users } from '../data/schema.ts'
import type { User } from '../data/schema.ts'
import type { AppContext } from '../types/context.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/admin.ts'
import { renderAdminPage } from '../ui/admin-layout.tsx'
import { AdminUsersPage } from '../ui/admin-users-page.tsx'
import { parseSort } from '../utils/sort-params.ts'
import { paginate } from '../utils/pagination.ts'
import {
  gridStateFromForm,
  gridStateToParams,
} from '../utils/grid-state.ts'
import { hashPassword } from '../utils/password-hash.ts'
import { logAdminAction } from '../data/audit-log.ts'
import { pool } from '../data/setup.ts'
import { getAdminIdentity } from '../utils/context.ts'

/** User view returned to the client — password_hash is never serialized. */
type SafeUser = Omit<User, 'password_hash'>

const PAGE_SIZE = 15

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

export default createController<typeof routes.admin.users, AppContext>(routes.admin.users, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let db = context.db
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let pageNum = Math.floor(offset / PAGE_SIZE) + 1
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
        pageSize: PAGE_SIZE,
        page: pageNum,
        orderBy: [[column, direction]],
        where: filterPredicate as Record<string, unknown>,
      })

      // Strip password_hash from rows returned to the client
      let rows: SafeUser[] = (page as User[]).map(
        (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at, updated_at: u.updated_at }),
      )

      // Check for inline editing state
      let editingParam = context.url.searchParams.get('editing')
      let editingRowId = editingParam ? Number(editingParam) : null
      let editRow: SafeUser | null = null
      if (editingRowId && Number.isFinite(editingRowId)) {
        let found = await db.findOne(users, { where: { id: editingRowId } })
        if (found) {
          let u = found as User
          editRow = { id: u.id!, email: u.email, name: u.name, role: u.role, created_at: u.created_at!, updated_at: u.updated_at! }
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
          prevOffset={Math.max(0, offset - PAGE_SIZE)}
          nextOffset={offset + PAGE_SIZE}
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

      let parsed: Record<string, string>
      try {
        parsed = s.parse(userCreateSchema, formData) as Record<string, string>
      } catch {
        return context.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
      }

      // Validate fields
      if (!parsed.name || !parsed.name.trim()) {
        return context.json({ ok: false, error: 'Name is required' }, { status: 400 })
      }
      if (!parsed.email || !EMAIL_RE.test(parsed.email)) {
        return context.json({ ok: false, error: 'Invalid email format' }, { status: 400 })
      }
      if (!parsed.password || parsed.password.length < 6) {
        return context.json({ ok: false, error: 'Password must be at least 6 characters' }, { status: 400 })
      }

      // Check for duplicate email
      let existing = await db.findOne(users, { where: { email: parsed.email.trim().toLowerCase() } })
      if (existing) {
        return context.json({ ok: false, error: 'Email already exists' }, { status: 400 })
      }

      let passwordHash = await hashPassword(parsed.password)
      let role = parsed.role === 'admin' ? 'admin' : 'customer'

      let row = await db.create(
        users,
        {
          name: parsed.name.trim(),
          email: parsed.email.trim().toLowerCase(),
          password_hash: passwordHash,
          role,
        },
        { returnRow: true },
      )

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'create',
          target_type: 'users',
          target_id: row.id as number,
          details: { name: parsed.name.trim(), email: parsed.email.trim().toLowerCase(), role },
        })
      }

      // Redirect back with editing=NEW_ID
      let redirectState = gridStateFromForm(parsed)
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

      let parsed: Record<string, string>
      try {
        parsed = s.parse(userUpdateSchema, formData) as Record<string, string>
      } catch {
        return context.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
      }

      // Validate email if provided
      if (parsed.email && !EMAIL_RE.test(parsed.email)) {
        return context.json({ ok: false, error: 'Invalid email format' }, { status: 400 })
      }

      // Check for duplicate email (excluding current user)
      if (parsed.email) {
        let existing = await db.findOne(users, { where: { email: parsed.email.trim().toLowerCase() } })
        if (existing && existing.id !== id) {
          return context.json({ ok: false, error: 'Email already exists' }, { status: 400 })
        }
      }

      let changes: Record<string, unknown> = {}
      if (parsed.name?.trim()) changes.name = parsed.name.trim()
      if (parsed.email?.trim()) changes.email = parsed.email.trim().toLowerCase()
      if (parsed.role === 'admin' || parsed.role === 'customer') changes.role = parsed.role
      if (parsed.password && parsed.password.length >= 6) {
        changes.password_hash = await hashPassword(parsed.password)
      }

      await db.updateMany(users, changes, { where: { id } })

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'update',
          target_type: 'users',
          target_id: id,
          details: { changes },
        })
      }

      // Redirect back with preserved grid state
      let redirectState = gridStateFromForm(parsed)
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

      await db.deleteMany(users, { where: { id } })

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'users',
          target_id: id,
        })
      }

      // Redirect back with preserved grid state
      let parsed: Record<string, string>
      try {
        parsed = s.parse(userUpdateSchema, formData) as Record<string, string>
      } catch {
        parsed = { name: '', email: '', role: '', password: '', _offset: '', _sort: '', _order: '', _filter: '' }
      }
      let params = gridStateToParams(gridStateFromForm(parsed))
      let qs = params.toString()
      let baseUrl = routes.admin.users.index.href()
      return new Response(null, {
        status: 302,
        headers: { Location: baseUrl + (qs ? '?' + qs : '') },
      })
    },
  },
})
