import { createAction } from 'remix/router'
import { system } from '../../routes.ts'
import type { WebhookRequestRow } from '../../data/webhook-requests.ts'
import {
  listWebhookRequests,
  WEBHOOK_REQUESTS_PAGE_SIZE,
  getWebhookRequest,
  updateWebhookRequestPayload,
  getWebhookRequestPayload,
  resetWebhookRequestCallback,
  updateWebhookRequestHermesStatus,
} from '../../data/webhook-requests.ts'
import { webhookChannel } from '../../utils/sse-events.ts'
import { Layout } from '../../ui/layout.tsx'
import { WebhookRequestsPage } from '../../ui/webhook-requests-page.tsx'
import { requireAuth } from '../../middleware/auth.ts'
import { requireAdmin } from '../../middleware/admin.ts'
import { requireSseAuth } from '../../middleware/sse-auth.ts'
import type { AppContext } from '../../types/context.ts'
import { gridStateFromFormData, editingRedirect } from '../../utils/grid-state.ts'

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
  context: any,
  overrides?: Partial<Pick<PageData, 'offset' | 'sortColumn' | 'sortDirection' | 'filter'>>,
): Promise<PageData> {
  let offset = overrides?.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = (overrides?.filter ?? context.url.searchParams.get('filter')) || undefined

  let sortParam = context.url.searchParams.get('sort') || 'created_at'
  let orderParam = context.url.searchParams.get('order') || 'desc'
  let column = sortParam
  let direction: 'asc' | 'desc' = orderParam === 'asc' ? 'asc' : 'desc'
  if (overrides?.sortColumn) {
    column = overrides.sortColumn
    direction = overrides.sortDirection ?? 'desc'
  }

  let { rows, hasMore } = await listWebhookRequests(context.db, {
    offset,
    column,
    direction,
    filter,
  })

  return {
    rows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - WEBHOOK_REQUESTS_PAGE_SIZE),
    nextOffset: offset + WEBHOOK_REQUESTS_PAGE_SIZE,
    sortColumn: sortParam,
    sortDirection: direction,
    filter,
  }
}

export const webhookRequestsIndex = createAction(system.webhookRequests, {
  middleware: [requireAuth(), requireAdmin()],
  handler: async (context) => {
    let data = await loadPageData(context)

    let editingParam = context.url.searchParams.get('editing')
    let editRow: WebhookRequestRow | null = null
    let viewRow: WebhookRequestRow | null = null
    if (editingParam && UUID_RE.test(editingParam)) {
      editRow = (await getWebhookRequest(context.db, editingParam)) ?? null
    } else {
      let viewingParam = context.url.searchParams.get('viewing')
      if (viewingParam && UUID_RE.test(viewingParam)) {
        viewRow = (await getWebhookRequest(context.db, viewingParam)) ?? null
      }
    }

    return context.render(
      <Layout title="Webhook Requests">
        <WebhookRequestsPage
          {...data}
          editRow={editRow}
          viewRow={viewRow}
          editingOffset={context.url.searchParams.get('offset') || '0'}
          editingSort={context.url.searchParams.get('sort') || 'created_at'}
          editingOrder={context.url.searchParams.get('order') || 'desc'}
          editingFilter={context.url.searchParams.get('filter') || ''}
        />
      </Layout>,
    )
  },
})

export const webhookRequestsEvents = createAction(system.webhookRequestEvents, {
  middleware: [requireSseAuth()],
  handler: async (context) => webhookChannel.subscribe(context.request),
})

function hermesUrl(): string {
  return process.env.HERMES_URL ?? 'http://127.0.0.1:8644/webhooks/app-webhook'
}

const HERMES_TIMEOUT_MS = 3_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const webhookRequestsUpdate = createAction(system.webhookRequestUpdate, {
  middleware: [requireAuth(), requireAdmin()],
  handler: async (context) => {
    let id = context.params.id
    if (!id || !UUID_RE.test(id)) {
      return new Response('Invalid UUID', { status: 400 })
    }

    let payloadRaw = context.formData.get('payload')

    let payload: Record<string, string> = {}
    if (payloadRaw && typeof payloadRaw === 'string') {
      if (payloadRaw.length > 100_000) {
        return new Response('Payload too large', { status: 413 })
      }
      try {
        let parsed = JSON.parse(payloadRaw)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          for (let [key, value] of Object.entries(parsed)) {
            if (key.trim()) {
              if (key.length > 256) {
                return new Response('Key too long', { status: 400 })
              }
              let strValue = String(value)
              if (strValue.length > 10_000) {
                return new Response('Value too long', { status: 400 })
              }
              payload[key] = strValue
            }
          }
        }
      } catch {
        return new Response('Invalid JSON payload', { status: 400 })
      }
    }

    try {
      let updated = await updateWebhookRequestPayload(context.db, id, JSON.stringify(payload))
      if (!updated) {
        return new Response('Not Found', { status: 404 })
      }
    } catch (err) {
      console.error('Failed to update webhook request:', err)
      return new Response('Fehler beim Speichern', { status: 500 })
    }

    webhookChannel.broadcast('invalidate')

    let gridState = gridStateFromFormData(context.formData)
    return editingRedirect(system.webhookRequests.href(), id, gridState)
  },
})

export const webhookRequestsResend = createAction(system.webhookRequestResend, {
  middleware: [requireAuth(), requireAdmin()],
  handler: async (context) => {
    let id = context.params.id
    if (!id || !UUID_RE.test(id)) {
      return new Response('Invalid UUID', { status: 400 })
    }

    let offset = context.url.searchParams.get('offset') || '0'
    let sort = context.url.searchParams.get('sort') || 'created_at'
    let order = context.url.searchParams.get('order') || 'desc'
    let filter = context.url.searchParams.get('filter') || ''

    let row = await getWebhookRequestPayload(context.db, id)
    if (!row) {
      return new Response('Not Found', { status: 404 })
    }

    await resetWebhookRequestCallback(context.db, id)

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

    await updateWebhookRequestHermesStatus(context.db, id, hermesStatusText)

    webhookChannel.broadcast('invalidate')

    let params = new URLSearchParams()
    if (offset !== '0') params.set('offset', String(offset))
    params.set('sort', String(sort))
    params.set('order', String(order))
    if (filter) params.set('filter', String(filter))
    let qs = params.toString()

    return new Response(null, {
      status: 303,
      headers: { Location: system.webhookRequests.href() + (qs ? '?' + qs : '') },
    })
  },
})
