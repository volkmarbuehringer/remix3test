import { ilike, isNull, notNull, or, type Database, type TableRow, type WhereInput } from 'remix/data-table'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { email, minLength } from 'remix/data-schema/checks'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { parseId } from '../../../utils/ids.ts'
import { logAdminAction } from '../../../data/audit-log.ts'
import { apiTokens, users } from '../../../data/schema.ts'
import type { User } from '../../../data/schema.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { routes } from '../../../routes.ts'
import { getAdminIdentity } from '../../../utils/context.ts'
import {
  gridStateFromForm,
  gridStateFromFormData,
  gridStateToParams,
} from '../../../utils/grid-state.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../../utils/schema-utils.ts'
import { validatePasswordComplexity } from '../../../utils/password-complexity.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { renderGridFormError, type AdminGridErrorState } from '../../../ui/admin-grid-error.tsx'
import { AdminUsersPage } from '../../../ui/admin-users-page.tsx'
import { paginate } from '../../../utils/pagination.ts'
import { hashPassword } from '../../../utils/password-hash.ts'
import { sendAccountDeletionEmail } from '../../../utils/send-email.ts'

import { parseSort } from '../../../utils/sort-params.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'

type SafeUser = Pick<
  User,
  'id' | 'email' | 'name' | 'role' | 'email_verified' | 'disabled_at' | 'created_at' | 'updated_at'
>

const USERS_PAGE_SIZE = 15

const SORTABLE_FIELDS = ['id', 'name', 'email', 'role', 'created_at'] as const

const USERS_FORM_KEYS = [
  'name',
  'email',
  'role',
  'password',
  'disabled',
  '_offset',
  '_sort',
  '_order',
  '_filter',
] as const

const userCreateSchema = f.object({
  name: f.field(s.defaulted(s.string(), '').pipe(minLength(1))),
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  role: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.defaulted(s.string(), '')),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

const userUpdateSchema = f.object({
  name: f.field(s.defaulted(s.string(), '').pipe(minLength(1))),
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  role: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.defaulted(s.string(), '')),
  disabled: f.field(s.defaulted(s.string(), '')),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

// ── Helpers ──

function toSafeUser(u: User): SafeUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    email_verified: u.email_verified,
    disabled_at: u.disabled_at,
    created_at: u.created_at,
    updated_at: u.updated_at,
  }
}

function buildUsersFilterPredicate(filter?: string): WhereInput | undefined {
  return filter === 'enabled'
    ? isNull('disabled_at')
    : filter === 'disabled'
      ? notNull('disabled_at')
      : filter && /^\d+$/.test(filter)
        ? { id: Number(filter) }
        : filter
          ? or(ilike('name', `%${filter}%`), ilike('email', `%${filter}%`))
          : undefined
}

async function loadGridData(
  db: Database,
  opts: {
    offset: number
    column: string
    direction: 'asc' | 'desc'
    filter?: string | undefined
    pageSize: number
  },
): Promise<{ rows: SafeUser[]; hasMore: boolean }> {
  let pageNum = Math.floor(opts.offset / opts.pageSize) + 1
  let { items: page, hasMore } = (await paginate(db, users, {
    pageSize: opts.pageSize,
    page: pageNum,
    orderBy: [[opts.column, opts.direction]],
    where: buildUsersFilterPredicate(opts.filter),
  })) as { items: User[]; page: number; hasMore: boolean }

  let rows = page.map(toSafeUser)
  return { rows, hasMore }
}

function gridOffset(raw: Record<string, string>): number {
  return Math.max(0, Number(raw._offset) || 0)
}

function gridSortColumn(raw: Record<string, string>): string {
  let col = raw._sort
  return col && (SORTABLE_FIELDS as readonly string[]).includes(col) ? col : 'name'
}

function gridSortDirection(raw: Record<string, string>): 'asc' | 'desc' {
  return raw._order === 'desc' ? 'desc' : 'asc'
}

function gridFilter(raw: Record<string, string>): string | undefined {
  return raw._filter || undefined
}

/** Strips sensitive/private fields before passing form values to the UI. Password
 *  is never echoed back into the DOM; grid-state keys are passed as separate props. */
function userFormValues(raw: Record<string, string>): Record<string, string> {
  return { name: raw.name ?? '', email: raw.email ?? '', role: raw.role ?? '', disabled: raw.disabled ?? '' }
}

function buildEditRowFromRaw(id: number, raw: Record<string, string>): SafeUser {
  return {
    id,
    email: raw.email ?? '',
    name: raw.name ?? '',
    role: raw.role === 'admin' ? 'admin' : 'customer',
    email_verified: 0,
    disabled_at: raw.disabled === 'true' ? Date.now() : null,
    created_at: 0,
    updated_at: 0,
  }
}

/**
 * Returns a reason the given user cannot be disabled, or null if allowed.
 * An admin may not disable their own account (no way to undo the lockout)
 * nor the last remaining admin account — mirroring the destroy guards.
 */
async function disableGuardReason(
  db: Database,
  user: User,
  authIdentity: { id: number; email: string } | undefined,
): Promise<string | null> {
  if (authIdentity && user.id === authIdentity.id) {
    return 'Das eigene Konto kann nicht deaktiviert werden.'
  }
  if (user.role === 'admin') {
    let adminCount = await db.count(users, { where: { role: 'admin' } })
    if (adminCount <= 1) {
      return 'Das letzte Admin-Konto kann nicht deaktiviert werden.'
    }
  }
  return null
}

/** Minimal structural view of the action context that this render adapter needs. */
type UsersRenderContext = {
  db: Database
  render: Parameters<typeof renderAdminPage>[0]
}

/**
 * Re-render the full admin page with a validation error (Pattern 1 direct re-render).
 *
 * A thin per-page adapter: the shared `renderGridFormError` loads the grid rows and
 * returns the fragment at status 200 (so the frame transport shows the inline errors
 * and preserved values rather than an error card). This adapter only binds the
 * users-specific page component and the create/edit distinction.
 */
async function renderUsersError(
  context: UsersRenderContext,
  opts: {
    creating?: boolean
    editRow?: SafeUser | null
    formValues?: Record<string, string>
    fieldErrors?: Record<string, string>
    formError?: string
    offset: number
    column: string
    direction: 'asc' | 'desc'
    filter?: string | undefined
    pageSize: number
  },
): Promise<Response> {
  let grid: AdminGridErrorState = {
    offset: opts.offset,
    sortColumn: opts.column,
    sortDirection: opts.direction,
    filter: opts.filter,
    pageSize: opts.pageSize,
  }
  return renderGridFormError<SafeUser>({
    render: context.render,
    activeItem: 'users',
    loadRows: () =>
      loadGridData(context.db, {
        offset: opts.offset,
        column: opts.column,
        direction: opts.direction,
        filter: opts.filter,
        pageSize: opts.pageSize,
      }),
    buildPage: (page) => (
      <AdminUsersPage
        rows={page.rows}
        offset={page.offset}
        hasMore={page.hasMore}
        prevOffset={Math.max(0, page.offset - page.pageSize)}
        nextOffset={page.offset + page.pageSize}
        sortColumn={page.sortColumn}
        sortDirection={page.sortDirection}
        filter={page.filter}
        editRow={opts.editRow ?? null}
        creating={opts.creating ?? false}
        pageSize={page.pageSize}
        formValues={page.formValues}
        fieldErrors={page.fieldErrors}
        formError={page.formError}
      />
    ),
    formValues: opts.formValues,
    fieldErrors: opts.fieldErrors,
    formError: opts.formError,
    grid,
  })
}

export default createController(routes.admin.users, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let effectivePageSize = getPageSize(context.session, USERS_PAGE_SIZE)
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_FIELDS,
        defaultColumn: 'name',
        defaultDirection: 'asc',
      })

      let { rows, hasMore } = await loadGridData(context.db, {
        offset,
        column,
        direction,
        filter,
        pageSize: effectivePageSize,
      })

      let editingParam = context.url.searchParams.get('editing')
      let editingRowId = editingParam ? Number(editingParam) : null
      let editRow: SafeUser | null = null
      if (editingRowId && Number.isFinite(editingRowId)) {
        let found = await context.db.findOne(users, { where: { id: editingRowId } })
        if (found) editRow = toSafeUser(found as User)
      }

      let creating = context.url.searchParams.get('creating') === 'true'

      return renderAdminPage(
        context.render,
        'users',
        <AdminUsersPage
          rows={rows}
          offset={offset}
          hasMore={hasMore}
          prevOffset={Math.max(0, offset - effectivePageSize)}
          nextOffset={offset + effectivePageSize}
          sortColumn={column}
          sortDirection={direction}
          filter={filter}
          editRow={editRow}
          creating={creating}
          pageSize={effectivePageSize}
        />,
      )
    },

    async create(context) {
      let db = context.db
      let formData = context.formData
      let effectivePageSize = getPageSize(context.session, USERS_PAGE_SIZE)

      let rawValues = readFormFieldValues(USERS_FORM_KEYS, formData)
      let parseResult = s.parseSafe(userCreateSchema, formData)

      if (!parseResult.success) {
        return renderUsersError(context, {
          creating: true,
          formValues: userFormValues(rawValues),
          fieldErrors: issuesToFieldErrors(parseResult.issues),
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
          pageSize: effectivePageSize,
        })
      }
      let fields = parseResult.value

      if (!fields.password) {
        return renderUsersError(context, {
          creating: true,
          formValues: userFormValues(rawValues),
          fieldErrors: { password: 'Passwort ist erforderlich.' },
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
          pageSize: effectivePageSize,
        })
      }
      let complexityError = validatePasswordComplexity(fields.password)
      if (complexityError) {
        return renderUsersError(context, {
          creating: true,
          formValues: userFormValues(rawValues),
          fieldErrors: { password: complexityError },
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
          pageSize: effectivePageSize,
        })
      }

      let existing = await db.findOne(users, {
        where: { email: fields.email.trim().toLowerCase() },
      })
      if (existing) {
        return renderUsersError(context, {
          creating: true,
          formValues: userFormValues(rawValues),
          fieldErrors: { email: 'E-Mail existiert bereits.' },
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
          pageSize: effectivePageSize,
        })
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
          token_version: 1,
        },
        { returnRow: true },
      )

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'create',
          target_type: 'users',
          target_id: row.id as number,
          details: { name: fields.name.trim(), email: fields.email.trim().toLowerCase(), role },
        })
      }

      let redirectState = gridStateFromForm(rawValues)
      let params = gridStateToParams(redirectState)
      params.set('editing', String(row.id))
      let baseUrl = routes.admin.users.index.href()
      return redirect(baseUrl + '?' + params.toString())
    },

    async update(context) {
      let db = context.db
      let formData = context.formData
      let effectivePageSize = getPageSize(context.session, USERS_PAGE_SIZE)

      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let rawValues = readFormFieldValues(USERS_FORM_KEYS, formData)
      let parseResult = s.parseSafe(userUpdateSchema, formData)

      if (!parseResult.success) {
        return renderUsersError(context, {
          editRow: buildEditRowFromRaw(id, rawValues),
          formValues: userFormValues(rawValues),
          fieldErrors: issuesToFieldErrors(parseResult.issues),
          offset: gridOffset(rawValues),
          column: gridSortColumn(rawValues),
          direction: gridSortDirection(rawValues),
          filter: gridFilter(rawValues),
          pageSize: effectivePageSize,
        })
      }
      let fields = parseResult.value

      if (fields.email) {
        let existing = await db.findOne(users, {
          where: { email: fields.email.trim().toLowerCase() },
        })
        if (existing && existing.id !== id) {
          return renderUsersError(context, {
            editRow: buildEditRowFromRaw(id, rawValues),
            formValues: userFormValues(rawValues),
            fieldErrors: { email: 'E-Mail existiert bereits.' },
            offset: gridOffset(rawValues),
            column: gridSortColumn(rawValues),
            direction: gridSortDirection(rawValues),
            filter: gridFilter(rawValues),
            pageSize: effectivePageSize,
          })
        }
      }

      if (fields.password) {
        let complexityError = validatePasswordComplexity(fields.password)
        if (complexityError) {
          return renderUsersError(context, {
            editRow: buildEditRowFromRaw(id, rawValues),
            formValues: userFormValues(rawValues),
            fieldErrors: { password: complexityError },
            offset: gridOffset(rawValues),
            column: gridSortColumn(rawValues),
            direction: gridSortDirection(rawValues),
            filter: gridFilter(rawValues),
            pageSize: effectivePageSize,
          })
        }
      }

      // Guard self-disable / last-admin-disable (mirrors the destroy guards).
      if (fields.disabled === 'true') {
        let currentUser = (await db.find(users, id)) as User | undefined
        if (currentUser && currentUser.disabled_at == null) {
          let reason = await disableGuardReason(db, currentUser, getAdminIdentity(context.auth))
          if (reason) {
            return context.json({ ok: false, error: reason, field: 'disabled' }, { status: 403 })
          }
        }
      }

      let changes: Partial<TableRow<typeof users>> = {}
      if (fields.name?.trim()) changes.name = fields.name.trim()
      if (fields.email?.trim()) changes.email = fields.email.trim().toLowerCase()
      if (fields.role === 'admin' || fields.role === 'customer') changes.role = fields.role
      if (fields.disabled === 'true') {
        changes.disabled_at = Date.now()
      } else if (fields.disabled !== undefined) {
        changes.disabled_at = null
      }
      if (fields.password) {
        changes.password_hash = await hashPassword(fields.password)
        let currentUser = (await db.find(users, id)) as { token_version: number } | undefined
        changes.token_version = (currentUser?.token_version ?? 0) + 1
      }

      await db.updateMany(users, changes, { where: { id } })
      if (fields.password) {
        await db.deleteMany(apiTokens, { where: { user_id: id } })
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        let safeChanges = { ...changes }
        if ('password_hash' in safeChanges) {
          safeChanges.password_hash = '***REDACTED***'
        }
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'update',
          target_type: 'users',
          target_id: id,
          details: { changes: safeChanges },
        })
      }

      let redirectState = gridStateFromForm(rawValues)
      let params = gridStateToParams(redirectState)
      let qs = params.toString()
      let baseUrl = routes.admin.users.index.href()
      return redirect(baseUrl + (qs ? '?' + qs : ''))
    },

    async destroy(context) {
      let db = context.db
      let formData = context.formData

      let id = parseId(context.params.id)
      if (id === undefined || id < 1) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let existing = await db.findOne(users, { where: { id } })
      if (!existing) {
        return context.json({ ok: false, error: 'User not found' }, { status: 404 })
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity && id === authIdentity.id) {
        return context.json(
          { ok: false, error: 'Das eigene Konto kann nicht gelöscht werden.' },
          { status: 403 },
        )
      }

      let user = existing as User
      if (user.role === 'admin') {
        let adminCount = await db.count(users, { where: { role: 'admin' } })
        if (adminCount <= 1) {
          return context.json(
            { ok: false, error: 'Das letzte Admin-Konto kann nicht gelöscht werden.' },
            { status: 403 },
          )
        }
      }

      let deletedEmail = user.email
      let deletedName = user.name

      await db.deleteMany(apiTokens, { where: { user_id: id } })
      await db.deleteMany(users, { where: { id } })

      if (process.env.NODE_ENV !== 'test') {
        try {
          await sendAccountDeletionEmail(
            context.mailer,
            { name: deletedName, email: deletedEmail },
            'admin',
          )
        } catch (err) {
          context.logger?.('Failed to send account deletion email: ' + String(err))
        }
      }

      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'users',
          target_id: id,
        })
      }

      let params = gridStateToParams(gridStateFromFormData(formData))
      let qs = params.toString()
      let baseUrl = routes.admin.users.index.href()
      return redirect(baseUrl + (qs ? '?' + qs : ''))
    },

    async toggleDisabled(context) {
      let db = context.db
      let id = parseId(context.params.id)

      let params = gridStateToParams(gridStateFromFormData(context.formData))
      let baseUrl = routes.admin.users.index.href()

      let fail = (message: string): Response => {
        context.session.flash('error', message)
        let qs = params.toString()
        return redirect(baseUrl + (qs ? '?' + qs : ''))
      }

      if (id === undefined || id < 1) {
        return fail('Ungültige Benutzer-ID.')
      }

      let existing = await db.findOne(users, { where: { id } })
      if (!existing) {
        return fail('Benutzer nicht gefunden.')
      }

      let user = existing as User
      // Guard self-disable / last-admin-disable (mirrors the destroy guards)
      // before turning an active account into a disabled one.
      if (user.disabled_at == null) {
        let reason = await disableGuardReason(db, user, getAdminIdentity(context.auth))
        if (reason) {
          return fail(reason)
        }
      }
      let now = user.disabled_at ? null : Date.now()
      await db.exec(
        `UPDATE users SET disabled_at = $1, token_version = token_version + 1 WHERE id = $2`,
        [now, id],
      )

      let newDisabledState = now !== null
      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'update',
          target_type: 'users',
          target_id: id,
          details: { disabled_at: newDisabledState ? 'set' : 'cleared' },
        })
      }

      let qs = params.toString()
      return redirect(baseUrl + (qs ? '?' + qs : ''))
    },
  },
})
