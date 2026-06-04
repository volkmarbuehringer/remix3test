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

      let parseResult = s.parseSafe(userCreateSchema, formData)
      if (!parseResult.success) {
        return context.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
      }
      let fields = parseResult.value

      // Validate fields
      if (!fields.name || !fields.name.trim()) {
        return context.json({ ok: false, error: 'Name is required' }, { status: 400 })
      }
      if (!fields.email || !EMAIL_RE.test(fields.email)) {
        return context.json({ ok: false, error: 'Invalid email format' }, { status: 400 })
      }
      if (!fields.password || fields.password.length < 6) {
        return context.json({ ok: false, error: 'Password must be at least 6 characters' }, { status: 400 })
      }

      // Check for duplicate email
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

      // Redirect back with editing=NEW_ID
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

      // Validate email if provided
      if (fields.email && !EMAIL_RE.test(fields.email)) {
        return context.json({ ok: false, error: 'Invalid email format' }, { status: 400 })
      }

      // Check for duplicate email (excluding current user)
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
      if (fields.password && fields.password.length >= 6) {
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

      // Redirect back with preserved grid state
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
        logAdminAction(pool, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'users',
          target_id: id,
        })
      }

      // Redirect back with preserved grid state
      // With s.defaulted() on all fields, parseSafe always succeeds for this schema,
      // but the miss branch preserves grid state defensively.
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
