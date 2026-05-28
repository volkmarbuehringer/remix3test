import { createController } from 'remix/router'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

import { adminRoutes as routes } from '../routes.ts'
import { pool } from '../data/setup.ts'
import type { AppContext } from '../types/context.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin } from '../middleware/admin.ts'
import { renderAdminPage } from '../ui/admin-layout.tsx'
import { AdminNutzerPage, type NutzerRow } from '../ui/admin-nutzer-page.tsx'
import { parseSort } from '../utils/sort-params.ts'
import { gridStateToParams } from '../utils/grid-state.ts'
import { hashPassword } from '../utils/password-hash.ts'

const PAGE_SIZE = 15

const SORTABLE_COLUMNS = [
  'n_vorname',
  'n_name',
  'n_email',
  'n_verpflichtung',
  'l_login',
  'l_aktiv',
  'l_gesperrt',
  'l_letzte_login',
] as const

const SEARCH_COLUMNS = ['n_vorname', 'n_name', 'n_email', 'l_login']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const nutzerSaveSchema = f.object({
  vorname: f.field(s.defaulted(s.string(), '')),
  name: f.field(s.defaulted(s.string(), '')),
  email: f.field(s.defaulted(s.string(), '')),
  verpflichtung: f.field(s.defaulted(s.string(), '')),
  login: f.field(s.defaulted(s.string(), '')),
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

export default createController<typeof routes.admin.nutzer, AppContext>(routes.admin.nutzer, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let offset = Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
      let filter = context.url.searchParams.get('filter') || undefined

      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_COLUMNS,
        defaultColumn: 'n_name',
        defaultDirection: 'asc',
      })

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
      query += ` ORDER BY ${column} ${direction === 'desc' ? 'DESC' : 'ASC'}`
      query += ` LIMIT $${paramIndex}`
      params.push(PAGE_SIZE + 1)

      paramIndex++
      query += ` OFFSET $${paramIndex}`
      params.push(offset)

      let result = await pool.query(query, params)
      let rows = result.rows as NutzerRow[]
      let hasMore = rows.length > PAGE_SIZE
      if (hasMore) rows.pop()

      // Check for inline editing state
      let editingParam = context.url.searchParams.get('editing')
      let editingRowId = editingParam || null
      let editRow: NutzerRow | null = null
      if (editingRowId) {
        let editResult = await pool.query(
          `SELECT n_id, n_vorname, n_name, n_email, n_verpflichtung,
                  l_id, l_login, l_aktiv, l_gesperrt, l_letzte_login
           FROM nutzer INNER JOIN login ON l_id = n_lid
           WHERE n_id = $1`,
          [editingRowId],
        )
        if (editResult.rows.length > 0) {
          editRow = editResult.rows[0] as NutzerRow
        }
      }

      let creating = context.url.searchParams.get('creating') === 'true'

      return renderAdminPage(
        context.render,
        'nutzer',
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
        />,
      )
    },

    async update(context) {
      let formData = context.formData

      let parsed: Record<string, string>
      try {
        parsed = s.parse(nutzerSaveSchema, formData) as Record<string, string>
      } catch {
        return Response.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
      }

      let id = context.params.id
      if (!id) {
        return Response.json({ ok: false, error: 'Invalid id' }, { status: 400 })
      }

      let lId = parsed._l_id
      if (!lId) {
        return Response.json({ ok: false, error: 'Missing login reference' }, { status: 400 })
      }
      if (parsed.email && !EMAIL_RE.test(parsed.email)) {
        return Response.json({ ok: false, error: 'Invalid email format' }, { status: 400 })
      }

      let client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(
          `UPDATE nutzer SET n_vorname=$1, n_name=$2, n_email=$3, n_verpflichtung=$4
           WHERE n_id=$5`,
          [parsed.vorname, parsed.name, parsed.email, boolFromString(parsed.verpflichtung), id],
        )
        await client.query(
          `UPDATE login SET l_login=$1, l_aktiv=$2, l_gesperrt=$3
           WHERE l_id=$4`,
          [parsed.login, boolFromString(parsed.aktiv), boolFromString(parsed.gesperrt), lId],
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }

      // Redirect back with preserved grid state
      let redirectState = {
        offset: parsed._offset,
        sort: parsed._sort,
        order: parsed._order,
        filter: parsed._filter,
      }
      let params = gridStateToParams(redirectState)
      let qs = params.toString()
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/nutzer' + (qs ? '?' + qs : '') },
      })
    },

    async create(context) {
      let formData = context.formData

      let parsed: Record<string, string>
      try {
        parsed = s.parse(nutzerSaveSchema, formData) as Record<string, string>
      } catch {
        return Response.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
      }

      // Validate required fields
      if (!parsed.login || !parsed.login.trim()) {
        return Response.json({ ok: false, error: 'Login is required' }, { status: 400 })
      }
      if (parsed.email && !EMAIL_RE.test(parsed.email)) {
        return Response.json({ ok: false, error: 'Invalid email format' }, { status: 400 })
      }

      let client = await pool.connect()
      try {
        await client.query('BEGIN')

        let loginResult = await client.query(
          `INSERT INTO login (l_login, l_aktiv, l_gesperrt)
           VALUES ($1, $2, $3)
           RETURNING l_id`,
          [parsed.login, boolFromString(parsed.aktiv), boolFromString(parsed.gesperrt)],
        )
        let newLId = loginResult.rows[0].l_id

        let nutzerResult = await client.query(
          `INSERT INTO nutzer (n_vorname, n_name, n_email, n_verpflichtung, n_lid)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING n_id`,
          [parsed.vorname, parsed.name, parsed.email, boolFromString(parsed.verpflichtung), newLId],
        )
        let newNId = nutzerResult.rows[0].n_id

        await client.query('COMMIT')

        // Redirect back with editing=NEW_NID to show and allow further edits
        let redirectState = {
          offset: parsed._offset,
          sort: parsed._sort,
          order: parsed._order,
          filter: parsed._filter,
        }
        let params = gridStateToParams(redirectState)
        params.set('editing', newNId)
        return new Response(null, {
          status: 302,
          headers: { Location: '/admin/nutzer?' + params.toString() },
        })
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },

    async destroy(context) {
      let id = context.params.id
      if (!id) {
        return Response.json({ ok: false, error: 'Invalid id' }, { status: 400 })
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
          return Response.json({ ok: false, error: 'Row not found' }, { status: 404 })
        }
        nLid = nutzerResult.rows[0].n_lid

        await client.query(`DELETE FROM login WHERE l_id=$1`, [nLid])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }

      // Redirect back with preserved grid state
      let redirectState = {
        offset: (formData.get('_offset') as string) ?? '',
        sort: (formData.get('_sort') as string) ?? '',
        order: (formData.get('_order') as string) ?? '',
        filter: (formData.get('_filter') as string) ?? '',
      }
      let params = gridStateToParams(redirectState)
      let qs = params.toString()
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/nutzer' + (qs ? '?' + qs : '') },
      })
    },

    async resetPassword(context) {
      let id = context.params.id
      if (!id) {
        return Response.json({ error: 'Invalid id' }, { status: 400 })
      }

      // Verify user exists and get their l_id
      let result = await pool.query(
        `SELECT n.n_id, n.n_name, n.n_vorname, l.l_id
         FROM nutzer n JOIN login l ON n.n_lid = l.l_id
         WHERE n.n_id = $1`,
        [id],
      )
      if (result.rows.length === 0) {
        return Response.json({ error: 'User not found' }, { status: 404 })
      }

      // Generate 12-char password (mixed case + digits, no ambiguous chars like 0/O/1/l/I)
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

      return Response.json({ ok: true })
    },

    async toggleLock(context) {
      let id = context.params.id
      if (!id) {
        return Response.json({ error: 'Invalid id' }, { status: 400 })
      }

      let body: { locked?: boolean }
      try {
        body = await context.request.json()
      } catch {
        return Response.json({ error: 'Expected JSON body' }, { status: 400 })
      }

      if (typeof body.locked !== 'boolean') {
        return Response.json({ error: 'Expected boolean "locked" field' }, { status: 400 })
      }

      let updateResult = await pool.query(
        `UPDATE login SET l_gesperrt=$1
         FROM nutzer WHERE nutzer.n_lid = login.l_id AND nutzer.n_id = $2`,
        [body.locked, id],
      )

      if (updateResult.rowCount === 0) {
        return Response.json({ error: 'User not found' }, { status: 404 })
      }

      return Response.json({ ok: true, locked: body.locked })
    },

    async toggleActive(context) {
      let id = context.params.id
      if (!id) {
        return Response.json({ error: 'Invalid id' }, { status: 400 })
      }

      let body: { active?: boolean }
      try {
        body = await context.request.json()
      } catch {
        return Response.json({ error: 'Expected JSON body' }, { status: 400 })
      }

      if (typeof body.active !== 'boolean') {
        return Response.json({ error: 'Expected boolean "active" field' }, { status: 400 })
      }

      let updateResult = await pool.query(
        `UPDATE login SET l_aktiv=$1
         FROM nutzer WHERE nutzer.n_lid = login.l_id AND nutzer.n_id = $2`,
        [body.active, id],
      )

      if (updateResult.rowCount === 0) {
        return Response.json({ error: 'User not found' }, { status: 404 })
      }

      return Response.json({ ok: true, active: body.active })
    },
  },
})
