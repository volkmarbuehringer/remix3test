import { createAction } from 'remix/router'
import { pool } from '../../data/setup.ts'
import { webhookRequestsRoute, webhookRequestsEventsRoute, webhookRequestsResendRoute, webhookRequestsUpdateRoute } from '../../routes.ts'
import { webhookChannel } from '../../lib/sse-events.ts'
import { Document } from '../../ui/document.tsx'
import { Layout } from '../../ui/layout.tsx'
import { WebhookRequestsPage } from '../../ui/webhook-requests-page.tsx'
import { requireAuth } from '../../middleware/auth.ts'
import { requireSseAuth } from '../../middleware/sse-auth.ts'
import type { AppContext } from '../../types/context.ts'
import { gridStateFromFormData, editingRedirect } from '../../utils/grid-state.ts'

const PAGE_SIZE = 15

const ORDER_BY_COLUMNS: Record<string, string> = {
  created_at: 'created_at',
  token: 'token',
  source_ip: 'source_ip',
  hermes_status: 'hermes_status',
  callback_received_at: 'callback_received_at',
}

export interface WebhookRequestRow {
  id: string
  payload: Record<string, unknown>
  token: string
  source_ip: string
  created_at: number
  hermes_status: string | null
  callback_response: Record<string, unknown> | string | null
  callback_received_at: number | null
}

interface PageData {
  rows: WebhookRequestRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
}

async function loadPageData(
  context: AppContext,
  overrides?: Partial<Pick<PageData, 'offset' | 'sortColumn' | 'sortDirection' | 'filter'>>,
): Promise<PageData> {
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  let sortParam = context.url.searchParams.get('sort') || 'created_at'
  let orderParam = context.url.searchParams.get('order') || 'desc'
  let column = ORDER_BY_COLUMNS[sortParam] || 'created_at'
  let direction: 'asc' | 'desc' = orderParam === 'asc' ? 'asc' : 'desc'
  if (overrides?.sortColumn) {
    column = ORDER_BY_COLUMNS[overrides.sortColumn] || 'created_at'
    direction = overrides.sortDirection ?? 'desc'
  }

  let query = `SELECT id, payload, token, headers, source_ip, created_at, hermes_status, callback_response, callback_received_at FROM webhook_requests`
  let params: unknown[] = []
  let paramIndex = 0

  if (filter && filter.length <= 200) {
    paramIndex++
    query += ` WHERE token ILIKE $${paramIndex}`
    params.push(`%${filter}%`)
  }

  paramIndex++
  query += ` ORDER BY ${column} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  params.push(PAGE_SIZE + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let result = await pool.query(query, params)
  let rows = result.rows as WebhookRequestRow[]
  let hasMore = rows.length > PAGE_SIZE
  if (hasMore) rows.pop()

  return {
    rows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - PAGE_SIZE),
    nextOffset: offset + PAGE_SIZE,
    sortColumn: sortParam,
    sortDirection: direction,
    filter,
  }
}

export const webhookRequestsIndex = createAction<typeof webhookRequestsRoute, AppContext>(
  webhookRequestsRoute,
  {
    middleware: [requireAuth()],
    handler: async (context) => {
      let data = await loadPageData(context)

      let editingParam = context.url.searchParams.get('editing')
      let editRow: WebhookRequestRow | null = null
      if (editingParam && UUID_RE.test(editingParam)) {
        let result = await pool.query(
          `SELECT id, payload, token, headers, source_ip, created_at, hermes_status, callback_response, callback_received_at FROM webhook_requests WHERE id = $1`,
          [editingParam],
        )
        if (result.rowCount && result.rowCount > 0) {
          editRow = result.rows[0] as WebhookRequestRow
        }
      }

      return context.render(
        <Document title="Webhook Requests">
          <Layout>
            <WebhookRequestsPage
              {...data}
              editRow={editRow}
              editingOffset={context.url.searchParams.get('offset') || '0'}
              editingSort={context.url.searchParams.get('sort') || 'created_at'}
              editingOrder={context.url.searchParams.get('order') || 'desc'}
              editingFilter={context.url.searchParams.get('filter') || ''}
            />
          </Layout>
        </Document>,
      )
    },
  },
)

export const webhookRequestsEvents = createAction<typeof webhookRequestsEventsRoute, AppContext>(
  webhookRequestsEventsRoute,
  {
    middleware: [requireSseAuth()],
    handler: async (context) => webhookChannel.subscribe(context.request),
  },
)

function hermesUrl(): string {
  return process.env.HERMES_URL ?? 'http://127.0.0.1:8644/webhooks/app-webhook'
}

const HERMES_TIMEOUT_MS = 3_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const webhookRequestsUpdate = createAction<typeof webhookRequestsUpdateRoute, AppContext>(
  webhookRequestsUpdateRoute,
  {
    middleware: [requireAuth()],
    handler: async (context) => {
      let id = context.params.id
      if (!id || !UUID_RE.test(id)) {
        return new Response('Invalid UUID', { status: 400 })
      }

      let payloadRaw = context.formData.get('payload')

      let payload: Record<string, string> = {}
      if (payloadRaw && typeof payloadRaw === 'string') {
        try {
          let parsed = JSON.parse(payloadRaw)
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            for (let [key, value] of Object.entries(parsed)) {
              if (key.trim()) {
                payload[key] = String(value)
              }
            }
          }
        } catch {
          return new Response('Invalid JSON payload', { status: 400 })
        }
      }

      try {
        let result = await pool.query(
          `UPDATE webhook_requests SET payload = $1 WHERE id = $2`,
          [JSON.stringify(payload), id],
        )
        if (result.rowCount === 0) {
          return new Response('Not Found', { status: 404 })
        }
      } catch (err) {
        console.error('Failed to update webhook request:', err)
        return new Response('Fehler beim Speichern', { status: 500 })
      }

      webhookChannel.broadcast('invalidate')

      let gridState = gridStateFromFormData(context.formData)
      return editingRedirect(webhookRequestsRoute.href(), id, gridState)
    },
  },
)

export const webhookRequestsResend = createAction<typeof webhookRequestsResendRoute, AppContext>(
  webhookRequestsResendRoute,
  {
    middleware: [requireAuth()],
    handler: async (context) => {
      let id = context.params.id
      if (!id || !UUID_RE.test(id)) {
        return new Response('Invalid UUID', { status: 400 })
      }

      let offset = context.url.searchParams.get('offset') || '0'
      let sort = context.url.searchParams.get('sort') || 'created_at'
      let order = context.url.searchParams.get('order') || 'desc'
      let filter = context.url.searchParams.get('filter') || ''

      let rowResult = await pool.query(
        `SELECT payload FROM webhook_requests WHERE id = $1`,
        [id],
      )
      if (rowResult.rowCount === 0) {
        return new Response('Not Found', { status: 404 })
      }

      let row = rowResult.rows[0] as { payload: Record<string, unknown> }

      await pool.query(
        `UPDATE webhook_requests SET callback_response = NULL, callback_received_at = NULL WHERE id = $1`,
        [id],
      )

      let callbackUrl = process.env.WEBHOOK_CALLBACK_URL ?? 'http://[::1]:44100/callback'
      let hermesPayload = JSON.stringify({ id, callbackUrl, payload: row.payload })

      let hermesStatusText: string
      try {
        let signal = AbortSignal.timeout(HERMES_TIMEOUT_MS)
        let hermesResponse = await fetch(hermesUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: hermesPayload,
          signal,
        })
        hermesStatusText = String(hermesResponse.status)
      } catch {
        hermesStatusText = 'error'
      }

      await pool.query(
        `UPDATE webhook_requests SET hermes_status = $1 WHERE id = $2`,
        [hermesStatusText, id],
      )

      webhookChannel.broadcast('invalidate')

      let params = new URLSearchParams()
      if (offset !== '0') params.set('offset', String(offset))
      params.set('sort', String(sort))
      params.set('order', String(order))
      if (filter) params.set('filter', String(filter))
      let qs = params.toString()

      return new Response(null, {
        status: 303,
        headers: { Location: webhookRequestsRoute.href() + (qs ? '?' + qs : '') },
      })
    },
  },
)
