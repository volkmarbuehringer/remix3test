import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength, email } from 'remix/data-schema/checks'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'
import { Layout } from '../../ui/layout.tsx'
import { renderAdminPage, AdminLayout } from '../../ui/admin-layout.tsx'
import { AdminNutzerPage } from '../../ui/admin-nutzer-page.tsx'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { parseSort } from '../../utils/sort-params.ts'
import { gridStateToParams } from '../../utils/grid-state.ts'
import { getPageSize } from '../../utils/get-page-size.ts'
import { hashPassword } from '../../utils/password-hash.ts'
import { logAdminAction } from '../../data/audit-log.ts'
import { isConstraintViolation } from '../../utils/db-errors.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../utils/schema-utils.ts'
import { getAdminIdentity } from '../../utils/context.ts'
import {
  listNutzerGrid,
  fetchNutzerEditRow,
  createNutzerWithLogin,
  updateNutzerWithLogin,
  deleteNutzer,
  getNutzerWithLogin,
  updateNutzerPassword,
  toggleNutzerLock,
  toggleNutzerActive,
} from '../../data/nutzer.ts'

const PAGE_SIZE = 15

const NUTZER_FORM_KEYS = [
  'vorname',
  'name',
  'email',
  'verpflichtung',
  'login',
  'aktiv',
  'gesperrt',
  '_l_id',
  '_offset',
  '_sort',
  '_order',
  '_filter',
] as const

const nutzerSaveSchema = f.object({
  vorname: f.field(s.defaulted(s.string(), '')),
  name: f.field(s.defaulted(s.string(), '').pipe(minLength(8))),
  email: f.field(s.defaulted(s.string(), '').pipe(email())),
  verpflichtung: f.field(s.defaulted(s.string(), '')),
  login: f.field(s.defaulted(s.string(), '').pipe(minLength(1))),
  aktiv: f.field(s.defaulted(s.string(), '')),
  gesperrt: f.field(s.defaulted(s.string(), '')),
  _l_id: f.field(s.defaulted(s.string(), '')),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

function boolFromString(val: string): boolean {
  return val === 'on' || val === 'true' || val === '1'
}

function dbErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    let pg = error as { code?: string; cause?: { code?: string } }
    let code = pg.code ?? pg.cause?.code
    if (code === '23505') return 'Login existiert bereits.'
    if (code === '23514') return 'Ungültige Eingabe.'
  }
  return 'Ein Datenbankfehler ist aufgetreten.'
}

export default createController(routes.admin.nutzer, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let effectivePageSize = getPageSize(context.session, PAGE_SIZE)
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: [
          'n_vorname',
          'n_name',
          'n_email',
          'n_verpflichtung',
          'l_login',
          'l_aktiv',
          'l_gesperrt',
          'l_letzte_login',
        ],
        defaultColumn: 'n_name',
        defaultDirection: 'asc',
      })

      let { rows, hasMore } = await listNutzerGrid(context.db, {
        offset,
        column,
        direction,
        filter,
        pageSize: effectivePageSize,
      })

      let editingParam = context.url.searchParams.get('editing')
      let editingRowId = editingParam || null
      let editRow = editingRowId ? await fetchNutzerEditRow(context.db, editingRowId) : null

      let creating = context.url.searchParams.get('creating') === 'true'

      return renderAdminPage(
        context.render,
        'nutzer',
        <AdminNutzerPage
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
        />,
      )
    },

    async update(context) {
      let effectivePageSize = getPageSize(context.session, PAGE_SIZE)
      let formData = context.formData
      let id = context.params.id

      if (!id) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let rawValues = readFormFieldValues(NUTZER_FORM_KEYS, formData)
      let parsed = s.parseSafe(nutzerSaveSchema, formData)

      if (!parsed.success) {
        let fieldErrors = issuesToFieldErrors(parsed.issues)
        let gridOffset = Math.max(0, Number(rawValues._offset) || 0)
        let sortCol = rawValues._sort || 'n_name'
        let sortDir = (rawValues._order === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
        let gridFilter = rawValues._filter || undefined

        let { rows, hasMore } = await listNutzerGrid(context.db, {
          offset: gridOffset,
          column: sortCol,
          direction: sortDir,
          filter: gridFilter,
          pageSize: effectivePageSize,
        })

        let editRow = {
          n_id: id,
          n_vorname: rawValues.vorname || null,
          n_name: rawValues.name || null,
          n_email: rawValues.email || null,
          n_verpflichtung: boolFromString(rawValues.verpflichtung),
          l_id: rawValues._l_id || '',
          l_login: rawValues.login || '',
          l_aktiv: boolFromString(rawValues.aktiv),
          l_gesperrt: boolFromString(rawValues.gesperrt),
          l_letzte_login: null,
        }

        return context.render(
          <Layout>
            <AdminLayout activeItem="nutzer">
              <AdminNutzerPage
                rows={rows}
                offset={gridOffset}
                hasMore={hasMore}
                prevOffset={Math.max(0, gridOffset - effectivePageSize)}
                nextOffset={gridOffset + effectivePageSize}
                sortColumn={sortCol}
                sortDirection={sortDir}
                filter={gridFilter}
                editRow={editRow}
                formValues={rawValues}
                fieldErrors={fieldErrors}
              />
            </AdminLayout>
          </Layout>,
          { status: 400 },
        )
      }

      let lId = parsed.value._l_id
      if (!lId) {
        return context.json({ ok: false, error: 'Missing login reference' }, { status: 400 })
      }

      try {
        await updateNutzerWithLogin(context.db, id, {
          vorname: parsed.value.vorname,
          name: parsed.value.name,
          email: parsed.value.email,
          verpflichtung: boolFromString(parsed.value.verpflichtung),
          login: parsed.value.login,
          aktiv: boolFromString(parsed.value.aktiv),
          gesperrt: boolFromString(parsed.value.gesperrt),
          lId,
        })

        let authIdentity = getAdminIdentity(context.auth)
        if (authIdentity) {
          await logAdminAction(context.db, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'update',
            target_type: 'nutzer',
            target_id: id,
            details: { changes: { vorname: parsed.value.vorname, name: parsed.value.name } },
          })
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'test')
          context.logger?.('DB error in nutzer update: ' + String(error))

        let gridOffset = Math.max(0, Number(rawValues._offset) || 0)
        let sortCol = rawValues._sort || 'n_name'
        let sortDir = (rawValues._order === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
        let gridFilter = rawValues._filter || undefined

        let { rows, hasMore } = await listNutzerGrid(context.db, {
          offset: gridOffset,
          column: sortCol,
          direction: sortDir,
          filter: gridFilter,
          pageSize: effectivePageSize,
        })

        let editRow = {
          n_id: id,
          n_vorname: rawValues.vorname || null,
          n_name: rawValues.name || null,
          n_email: rawValues.email || null,
          n_verpflichtung: boolFromString(rawValues.verpflichtung),
          l_id: rawValues._l_id || '',
          l_login: rawValues.login || '',
          l_aktiv: boolFromString(rawValues.aktiv),
          l_gesperrt: boolFromString(rawValues.gesperrt),
          l_letzte_login: null,
        }

        return context.render(
          <Layout>
            <AdminLayout activeItem="nutzer">
              <AdminNutzerPage
                rows={rows}
                offset={gridOffset}
                hasMore={hasMore}
                prevOffset={Math.max(0, gridOffset - effectivePageSize)}
                nextOffset={gridOffset + effectivePageSize}
                sortColumn={sortCol}
                sortDirection={sortDir}
                filter={gridFilter}
                editRow={editRow}
                error={dbErrorMessage(error)}
                formValues={rawValues}
              />
            </AdminLayout>
          </Layout>,
          { status: 400 },
        )
      }

      let redirectState = {
        offset: parsed.value._offset,
        sort: parsed.value._sort,
        order: parsed.value._order,
        filter: parsed.value._filter,
      }
      let qp = gridStateToParams(redirectState)
      let qs = qp.toString()
      return redirect(routes.admin.nutzer.index.href() + (qs ? '?' + qs : ''))
    },

    async create(context) {
      let effectivePageSize = getPageSize(context.session, PAGE_SIZE)
      let formData = context.formData

      let rawValues = readFormFieldValues(NUTZER_FORM_KEYS, formData)
      let parsed = s.parseSafe(nutzerSaveSchema, formData)

      if (!parsed.success) {
        let fieldErrors = issuesToFieldErrors(parsed.issues)
        let gridOffset = Math.max(0, Number(rawValues._offset) || 0)
        let sortCol = rawValues._sort || 'n_name'
        let sortDir = (rawValues._order === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
        let gridFilter = rawValues._filter || undefined

        let { rows, hasMore } = await listNutzerGrid(context.db, {
          offset: gridOffset,
          column: sortCol,
          direction: sortDir,
          filter: gridFilter,
          pageSize: effectivePageSize,
        })

        return context.render(
          <Layout>
            <AdminLayout activeItem="nutzer">
              <AdminNutzerPage
                rows={rows}
                offset={gridOffset}
                hasMore={hasMore}
                prevOffset={Math.max(0, gridOffset - effectivePageSize)}
                nextOffset={gridOffset + effectivePageSize}
                sortColumn={sortCol}
                sortDirection={sortDir}
                filter={gridFilter}
                creating={true}
                formValues={rawValues}
                fieldErrors={fieldErrors}
              />
            </AdminLayout>
          </Layout>,
          { status: 400 },
        )
      }

      try {
        let { nId } = await createNutzerWithLogin(context.db, {
          vorname: parsed.value.vorname,
          name: parsed.value.name,
          email: parsed.value.email,
          verpflichtung: boolFromString(parsed.value.verpflichtung),
          login: parsed.value.login,
          aktiv: boolFromString(parsed.value.aktiv),
          gesperrt: boolFromString(parsed.value.gesperrt),
        })

        let authIdentity = getAdminIdentity(context.auth)
        if (authIdentity) {
          await logAdminAction(context.db, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'create',
            target_type: 'nutzer',
            target_id: nId,
          })
        }

        let redirectState = {
          offset: parsed.value._offset,
          sort: parsed.value._sort,
          order: parsed.value._order,
          filter: parsed.value._filter,
        }
        let qp = gridStateToParams(redirectState)
        qp.set('editing', String(nId))
        return redirect(routes.admin.nutzer.index.href() + '?' + qp.toString())
      } catch (error) {
        if (process.env.NODE_ENV !== 'test')
          context.logger?.('DB error in nutzer create: ' + String(error))

        let gridOffset = Math.max(0, Number(rawValues._offset) || 0)
        let sortCol = rawValues._sort || 'n_name'
        let sortDir = (rawValues._order === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
        let gridFilter = rawValues._filter || undefined

        let { rows, hasMore } = await listNutzerGrid(context.db, {
          offset: gridOffset,
          column: sortCol,
          direction: sortDir,
          filter: gridFilter,
          pageSize: effectivePageSize,
        })

        return context.render(
          <Layout>
            <AdminLayout activeItem="nutzer">
              <AdminNutzerPage
                rows={rows}
                offset={gridOffset}
                hasMore={hasMore}
                prevOffset={Math.max(0, gridOffset - effectivePageSize)}
                nextOffset={gridOffset + effectivePageSize}
                sortColumn={sortCol}
                sortDirection={sortDir}
                filter={gridFilter}
                creating={true}
                error={dbErrorMessage(error)}
                formValues={rawValues}
              />
            </AdminLayout>
          </Layout>,
          { status: 400 },
        )
      }
    },

    async destroy(context) {
      let id = context.params.id
      if (!id) {
        return context.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let deleteResult: Awaited<ReturnType<typeof deleteNutzer>>
      try {
        deleteResult = await deleteNutzer(context.db, id)
      } catch (error) {
        if (isConstraintViolation(error)) {
          return context.json(
            {
              ok: false,
              error:
                'Dieser Benutzer kann nicht gelöscht werden, da noch Verweise darauf bestehen.',
            },
            { status: 409 },
          )
        }
        throw error
      }
      if (!deleteResult) {
        return context.json({ ok: false, error: 'Row not found' }, { status: 404 })
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'destroy',
          target_type: 'nutzer',
          target_id: id,
        })
      }

      let formData = context.formData
      let redirectState = {
        offset: (formData.get('_offset') as string) ?? '',
        sort: (formData.get('_sort') as string) ?? '',
        order: (formData.get('_order') as string) ?? '',
        filter: (formData.get('_filter') as string) ?? '',
      }
      let qp = gridStateToParams(redirectState)
      let qs = qp.toString()
      return redirect(routes.admin.nutzer.index.href() + (qs ? '?' + qs : ''))
    },

    async resetPassword(context) {
      let id = context.params.id
      if (!id) {
        return context.json({ error: 'Invalid id' }, { status: 400 })
      }

      let user = await getNutzerWithLogin(context.db, id)
      if (!user) {
        return context.json({ error: 'User not found' }, { status: 404 })
      }

      let chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
      let randomBytes = crypto.getRandomValues(new Uint8Array(12))
      let password = ''
      for (let i = 0; i < 12; i++) {
        password += chars[randomBytes[i] % chars.length]
      }

      let hashed = await hashPassword(password)
      await updateNutzerPassword(context.db, user.lId, hashed)

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'password_reset',
          target_type: 'nutzer',
          target_id: id,
        })
      }

      return context.json({ ok: true })
    },

    async toggleLock(context) {
      let id = context.params.id
      if (!id) {
        return context.json({ error: 'Invalid id' }, { status: 400 })
      }

      let body = context.jsonBody as { locked?: boolean } | undefined

      if (!body || typeof body.locked !== 'boolean') {
        return context.json({ error: 'Expected boolean "locked" field' }, { status: 400 })
      }

      let updated = await toggleNutzerLock(context.db, id, body.locked)
      if (!updated) {
        return context.json({ error: 'User not found' }, { status: 404 })
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'toggle_lock',
          target_type: 'nutzer',
          target_id: id,
          details: { locked: body.locked },
        })
      }

      return context.json({ ok: true, locked: body.locked })
    },

    async toggleActive(context) {
      let id = context.params.id
      if (!id) {
        return context.json({ error: 'Invalid id' }, { status: 400 })
      }

      let body = context.jsonBody as { active?: boolean } | undefined

      if (!body || typeof body.active !== 'boolean') {
        return context.json({ error: 'Expected boolean "active" field' }, { status: 400 })
      }

      let updated = await toggleNutzerActive(context.db, id, body.active)
      if (!updated) {
        return context.json({ error: 'User not found' }, { status: 404 })
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'toggle_active',
          target_type: 'nutzer',
          target_id: id,
          details: { active: body.active },
        })
      }

      return context.json({ ok: true, active: body.active })
    },
  },
})
