import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { minLength, email } from 'remix/data-schema/checks'

import { routes } from '../routes.ts'
import { pool } from '../data/setup.ts'
import type { AppContext } from '../types/context.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/admin.ts'
import { Layout } from '../ui/layout.tsx'
import { AdminNutzerPage, type NutzerRow } from '../ui/admin-nutzer-page.tsx'
import { parseSort } from '../utils/sort-params.ts'
import { gridStateToParams } from '../utils/grid-state.ts'
import { hashPassword } from '../utils/password-hash.ts'
import { logAdminAction } from '../data/audit-log.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../utils/schema-utils.ts'

const PAGE_SIZE = 15

const ORDER_BY_COLUMNS: Record<string, string> = {
  'n_vorname': 'n_vorname',
  'n_name': 'n_name',
  'n_email': 'n_email',
  'n_verpflichtung': 'n_verpflichtung',
  'l_login': 'l_login',
  'l_aktiv': 'l_aktiv',
  'l_gesperrt': 'l_gesperrt',
  'l_letzte_login': 'l_letzte_login',
}

const SEARCH_COLUMNS = ['n_vorname', 'n_name', 'n_email', 'l_login']

const NUTZER_FORM_KEYS = ['vorname', 'name', 'email', 'verpflichtung', 'login', 'aktiv', 'gesperrt', '_l_id', '_offset', '_sort', '_order', '_filter'] as const

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
  if (error && typeof error === 'object' && 'code' in error) {
    let pg = error as { code: string; constraint?: string }
    if (pg.code === '23505') return 'Login existiert bereits.'
    if (pg.code === '23514') return 'Ungültige Eingabe.'
  }
  return 'Ein Datenbankfehler ist aufgetreten.'
}

async function fetchNutzerGrid(opts: {
  offset: number
  column: string
  direction: 'asc' | 'desc'
  filter?: string
}) {
  let { offset, column, direction, filter } = opts

  let query = `
    SELECT n_id, n_vorname, n_name, n_email, n_verpflichtung,
           l_id, l_login, l_aktiv, l_gesperrt, l_letzte_login
    FROM nutzer
    INNER JOIN login ON l_id = n_lid
  `

  let params: unknown[] = []
  let paramIndex = 0

  if (filter && filter.length <= 200) {
    paramIndex++
    let searchPattern = `%${filter}%`
    let conditions = SEARCH_COLUMNS.map((col) => `${col} ILIKE $${paramIndex}`)
    query += ` WHERE (${conditions.join(' OR ')})`
    params.push(searchPattern)
  }

  paramIndex++
  query += ` ORDER BY ${ORDER_BY_COLUMNS[column] || 'n_name'} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  params.push(PAGE_SIZE + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let result = await pool.query(query, params)
  let rows = result.rows as NutzerRow[]
  let hasMore = rows.length > PAGE_SIZE
  if (hasMore) rows.pop()

  return { rows, hasMore }
}

async function fetchNutzerEditRow(editingRowId: string): Promise<NutzerRow | null> {
  let editResult = await pool.query(
    `SELECT n_id, n_vorname, n_name, n_email, n_verpflichtung,
            l_id, l_login, l_aktiv, l_gesperrt, l_letzte_login
     FROM nutzer INNER JOIN login ON l_id = n_lid
     WHERE n_id = $1`,
    [editingRowId],
  )
  if (editResult.rows.length > 0) {
    return editResult.rows[0] as NutzerRow
  }
  return null
}

export default createController<typeof routes.nutzer, AppContext>(routes.nutzer, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: Object.keys(ORDER_BY_COLUMNS),
        defaultColumn: 'n_name',
        defaultDirection: 'asc',
      })

      let { rows, hasMore } = await fetchNutzerGrid({ offset, column, direction, filter })

      let editingParam = context.url.searchParams.get('editing')
      let editingRowId = editingParam || null
      let editRow: NutzerRow | null = null
      if (editingRowId) {
        editRow = await fetchNutzerEditRow(editingRowId)
      }

      let creating = context.url.searchParams.get('creating') === 'true'

      return context.render(
        <Layout title="Nutzer">
          <AdminNutzerPage
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
          />
        </Layout>,
      )
    },

    async update(context) {
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

        let { rows, hasMore } = await fetchNutzerGrid({
          offset: gridOffset,
          column: sortCol,
          direction: sortDir,
          filter: gridFilter,
        })

        let editRow: NutzerRow = {
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
          <Layout title="Nutzer">
            <AdminNutzerPage
              rows={rows}
              offset={gridOffset}
              hasMore={hasMore}
              prevOffset={Math.max(0, gridOffset - PAGE_SIZE)}
              nextOffset={gridOffset + PAGE_SIZE}
              sortColumn={sortCol}
              sortDirection={sortDir}
              filter={gridFilter}
              editRow={editRow}
              formValues={rawValues}
              fieldErrors={fieldErrors}
            />
          </Layout>,
          { status: 400 },
        )
      }

      let lId = parsed.value._l_id
      if (!lId) {
        return context.json({ ok: false, error: 'Missing login reference' }, { status: 400 })
      }

      let client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(
          `UPDATE nutzer SET n_vorname=$1, n_name=$2, n_email=$3, n_verpflichtung=$4
           WHERE n_id=$5`,
          [parsed.value.vorname, parsed.value.name, parsed.value.email, boolFromString(parsed.value.verpflichtung), id],
        )
        await client.query(
          `UPDATE login SET l_login=$1, l_aktiv=$2, l_gesperrt=$3
           WHERE l_id=$4`,
          [parsed.value.login, boolFromString(parsed.value.aktiv), boolFromString(parsed.value.gesperrt), lId],
        )
        await client.query('COMMIT')

        let auth = context.auth
        let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
        if (authIdentity) {
          logAdminAction(pool, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'update',
            target_type: 'nutzer',
            target_id: id,
            details: { changes: { vorname: parsed.value.vorname, name: parsed.value.name } },
          })
        }
      } catch (error) {
        await client.query('ROLLBACK')
        client.release()

        if (process.env.NODE_ENV !== 'test') console.error('DB error in nutzer update:', error)

        let gridOffset = Math.max(0, Number(rawValues._offset) || 0)
        let sortCol = rawValues._sort || 'n_name'
        let sortDir = (rawValues._order === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
        let gridFilter = rawValues._filter || undefined

        let { rows, hasMore } = await fetchNutzerGrid({
          offset: gridOffset,
          column: sortCol,
          direction: sortDir,
          filter: gridFilter,
        })

        let editRow: NutzerRow = {
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
          <Layout title="Nutzer">
            <AdminNutzerPage
              rows={rows}
              offset={gridOffset}
              hasMore={hasMore}
              prevOffset={Math.max(0, gridOffset - PAGE_SIZE)}
              nextOffset={gridOffset + PAGE_SIZE}
              sortColumn={sortCol}
              sortDirection={sortDir}
              filter={gridFilter}
              editRow={editRow}
              error={dbErrorMessage(error)}
              formValues={rawValues}
            />
          </Layout>,
          { status: 400 },
        )
      }

      client.release()

      let redirectState = {
        offset: parsed.value._offset,
        sort: parsed.value._sort,
        order: parsed.value._order,
        filter: parsed.value._filter,
      }
      let qp = gridStateToParams(redirectState)
      let qs = qp.toString()
      return new Response(null, {
        status: 302,
        headers: { Location: '/nutzer' + (qs ? '?' + qs : '') },
      })
    },

    async create(context) {
      let formData = context.formData

      let rawValues = readFormFieldValues(NUTZER_FORM_KEYS, formData)
      let parsed = s.parseSafe(nutzerSaveSchema, formData)

      if (!parsed.success) {
        let fieldErrors = issuesToFieldErrors(parsed.issues)
        let gridOffset = Math.max(0, Number(rawValues._offset) || 0)
        let sortCol = rawValues._sort || 'n_name'
        let sortDir = (rawValues._order === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
        let gridFilter = rawValues._filter || undefined

        let { rows, hasMore } = await fetchNutzerGrid({
          offset: gridOffset,
          column: sortCol,
          direction: sortDir,
          filter: gridFilter,
        })

        return context.render(
          <Layout title="Nutzer">
            <AdminNutzerPage
              rows={rows}
              offset={gridOffset}
              hasMore={hasMore}
              prevOffset={Math.max(0, gridOffset - PAGE_SIZE)}
              nextOffset={gridOffset + PAGE_SIZE}
              sortColumn={sortCol}
              sortDirection={sortDir}
              filter={gridFilter}
              creating={true}
              formValues={rawValues}
              fieldErrors={fieldErrors}
            />
          </Layout>,
          { status: 400 },
        )
      }

      let client = await pool.connect()
      try {
        await client.query('BEGIN')

        let loginResult = await client.query(
          `INSERT INTO login (l_login, l_aktiv, l_gesperrt)
           VALUES ($1, $2, $3)
           RETURNING l_id`,
          [parsed.value.login, boolFromString(parsed.value.aktiv), boolFromString(parsed.value.gesperrt)],
        )
        let newLId = loginResult.rows[0].l_id

        let nutzerResult = await client.query(
          `INSERT INTO nutzer (n_vorname, n_name, n_email, n_verpflichtung, n_lid)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING n_id`,
          [parsed.value.vorname, parsed.value.name, parsed.value.email, boolFromString(parsed.value.verpflichtung), newLId],
        )
        let newNId = nutzerResult.rows[0].n_id

        await client.query('COMMIT')

        let auth = context.auth
        let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
        if (authIdentity) {
          logAdminAction(pool, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'create',
            target_type: 'nutzer',
            target_id: newNId,
          })
        }

        client.release()

        let redirectState = {
          offset: parsed.value._offset,
          sort: parsed.value._sort,
          order: parsed.value._order,
          filter: parsed.value._filter,
        }
        let qp = gridStateToParams(redirectState)
        qp.set('editing', newNId)
        return new Response(null, {
          status: 302,
          headers: { Location: '/nutzer?' + qp.toString() },
        })
      } catch (error) {
        await client.query('ROLLBACK')
        client.release()

        if (process.env.NODE_ENV !== 'test') console.error('DB error in nutzer create:', error)

        let gridOffset = Math.max(0, Number(rawValues._offset) || 0)
        let sortCol = rawValues._sort || 'n_name'
        let sortDir = (rawValues._order === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc'
        let gridFilter = rawValues._filter || undefined

        let { rows, hasMore } = await fetchNutzerGrid({
          offset: gridOffset,
          column: sortCol,
          direction: sortDir,
          filter: gridFilter,
        })

        return context.render(
          <Layout title="Nutzer">
            <AdminNutzerPage
              rows={rows}
              offset={gridOffset}
              hasMore={hasMore}
              prevOffset={Math.max(0, gridOffset - PAGE_SIZE)}
              nextOffset={gridOffset + PAGE_SIZE}
              sortColumn={sortCol}
              sortDirection={sortDir}
              filter={gridFilter}
              creating={true}
              error={dbErrorMessage(error)}
              formValues={rawValues}
            />
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

      let formData = context.formData
      let nLid: number

      let client = await pool.connect()
      try {
        await client.query('BEGIN')
        let nutzerResult = await client.query(
          `DELETE FROM nutzer WHERE n_id=$1 RETURNING n_lid`,
          [id],
        )
        if (nutzerResult.rows.length === 0) {
          await client.query('ROLLBACK')
          return context.json({ ok: false, error: 'Row not found' }, { status: 404 })
        }
        nLid = nutzerResult.rows[0].n_lid

        await client.query(`DELETE FROM login WHERE l_id=$1`, [nLid])
        await client.query('COMMIT')

        let auth = context.auth
        let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
        if (authIdentity) {
          logAdminAction(pool, {
            admin_user_id: authIdentity.id,
            admin_email: authIdentity.email,
            action_type: 'destroy',
            target_type: 'nutzer',
            target_id: id,
          })
        }
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }

      let redirectState = {
        offset: (formData.get('_offset') as string) ?? '',
        sort: (formData.get('_sort') as string) ?? '',
        order: (formData.get('_order') as string) ?? '',
        filter: (formData.get('_filter') as string) ?? '',
      }
      let qp = gridStateToParams(redirectState)
      let qs = qp.toString()
      return new Response(null, {
        status: 302,
        headers: { Location: '/nutzer' + (qs ? '?' + qs : '') },
      })
    },

    async resetPassword(context) {
      let id = context.params.id
      if (!id) {
        return context.json({ error: 'Invalid id' }, { status: 400 })
      }

      let result = await pool.query(
        `SELECT n.n_id, n.n_name, n.n_vorname, l.l_id
         FROM nutzer n JOIN login l ON n.n_lid = l.l_id
         WHERE n.n_id = $1`,
        [id],
      )
      if (result.rows.length === 0) {
        return context.json({ error: 'User not found' }, { status: 404 })
      }

      let chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
      let randomBytes = crypto.getRandomValues(new Uint8Array(12))
      let password = ''
      for (let i = 0; i < 12; i++) {
        password += chars[randomBytes[i] % chars.length]
      }

      let hashed = await hashPassword(password)
      await pool.query(`UPDATE login SET l_password=$1 WHERE l_id=$2`, [
        hashed,
        result.rows[0].l_id,
      ])

      let auth = context.auth
      let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
      if (authIdentity) {
        logAdminAction(pool, {
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

      let body: { locked?: boolean }
      try {
        body = await context.request.json()
      } catch {
        return context.json({ error: 'Expected JSON body' }, { status: 400 })
      }

      if (typeof body.locked !== 'boolean') {
        return context.json({ error: 'Expected boolean "locked" field' }, { status: 400 })
      }

      let updateResult = await pool.query(
        `UPDATE login SET l_gesperrt=$1
         FROM nutzer WHERE nutzer.n_lid = login.l_id AND nutzer.n_id = $2`,
        [body.locked, id],
      )

      if (updateResult.rowCount === 0) {
        return context.json({ error: 'User not found' }, { status: 404 })
      }

      let auth = context.auth
      let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
      if (authIdentity) {
        logAdminAction(pool, {
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

      let body: { active?: boolean }
      try {
        body = await context.request.json()
      } catch {
        return context.json({ error: 'Expected JSON body' }, { status: 400 })
      }

      if (typeof body.active !== 'boolean') {
        return context.json({ error: 'Expected boolean "active" field' }, { status: 400 })
      }

      let updateResult = await pool.query(
        `UPDATE login SET l_aktiv=$1
         FROM nutzer WHERE nutzer.n_lid = login.l_id AND nutzer.n_id = $2`,
        [body.active, id],
      )

      if (updateResult.rowCount === 0) {
        return context.json({ error: 'User not found' }, { status: 404 })
      }

      let auth = context.auth
      let authIdentity: { id: number; email: string } | undefined = auth?.ok ? (auth.identity as { id: number; email: string }) : undefined
      if (authIdentity) {
        logAdminAction(pool, {
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
