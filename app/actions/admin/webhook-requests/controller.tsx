import { createAction, createController } from 'remix/router'

import { system, routes } from '../../../routes.ts'
import {
  getWebhookRequest,
  getWebhookRequestPayload,
  listWebhookRequests,
  parseWebhookRequestPayload,
  resetWebhookRequestCallback,
  updateWebhookRequestHermesStatus,
  updateWebhookRequestPayload,
  WEBHOOK_REQUESTS_PAGE_SIZE,
  WEBHOOK_REQUESTS_SORTABLE_FIELDS,
  type WebhookRequestRow,
} from '../../../data/webhook-requests.ts'
import { logAdminAction } from '../../../data/audit-log.ts'
import { webhookChannel } from '../../../utils/sse-events.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { requireAdminSseAuth } from '../../../middleware/sse-auth.ts'
import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { AdminWebhookRequestsPage } from '../../../ui/admin-webhook-requests-page.tsx'
import { getAdminIdentity } from '../../../utils/context.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'
import { parseSort } from '../../../utils/sort-params.ts'
import {
  gridStateDirection,
  gridStateFromFormData,
  gridStateFromURL,
  gridStateToParams,
} from '../../../utils/grid-state.ts'
import type { AppContext } from '../../../types/context.ts'

const HERMES_TIMEOUT_MS = 3_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface PageData {
  rows: WebhookRequestRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  pageSize: number
}

function hermesUrl(): string {
  return process.env.HERMES_URL ?? 'http://127.0.0.1:8644/webhooks/app-webhook'
}

function is2xx(status: string): boolean {
  let n = Number(status)
  return Number.isFinite(n) && n >= 200 && n < 300
}

/** Index URL with the current grid state, used for PRG redirects. */
function gridUrl(url: URL): string {
  let params = gridStateToParams(gridStateFromURL(url))
  let qs = params.toString()
  return routes.admin.webhookRequests.index.href() + (qs ? '?' + qs : '')
}

function redirectToGrid(url: URL): Response {
  return new Response(null, { status: 303, headers: { Location: gridUrl(url) } })
}

interface GridOverrides {
  offset?: number | undefined
  column?: string | undefined
  direction?: 'asc' | 'desc' | undefined
  filter?: string | undefined
  pageSize?: number | undefined
}

/**
 * Grid state submitted with the composer form. Used on the validation-error
 * re-render and the success redirect so the user keeps their place instead of
 * snapping back to page 1 with the default sort.
 */
function gridOverridesFromForm(formData: FormData): GridOverrides {
  let state = gridStateFromFormData(formData)
  let column = WEBHOOK_REQUESTS_SORTABLE_FIELDS.includes(state.sort) ? state.sort : undefined
  return {
    offset: Math.max(0, Number(state.offset) || 0),
    column,
    direction: gridStateDirection(state),
    filter: state.filter || undefined,
  }
}

async function loadPageData(
  context: Pick<AppContext, 'db' | 'url' | 'session'>,
  overrides: GridOverrides = {},
): Promise<PageData> {
  let pageSize = overrides.pageSize ?? getPageSize(context.session, WEBHOOK_REQUESTS_PAGE_SIZE)
  let offset = overrides.offset ?? Math.max(0, Number(context.url.searchParams.get('offset')) || 0)
  let filter = overrides.filter ?? context.url.searchParams.get('filter') ?? undefined

  let column: string
  let direction: 'asc' | 'desc'
  if (overrides.column) {
    column = overrides.column
    direction = overrides.direction ?? 'desc'
  } else {
    let parsed = parseSort(context.url, {
      allowedColumns: WEBHOOK_REQUESTS_SORTABLE_FIELDS,
      defaultColumn: 'created_at',
      defaultDirection: 'desc',
    })
    column = parsed.column
    direction = parsed.direction
  }

  let { rows, hasMore } = await listWebhookRequests(context.db, {
    offset,
    column,
    direction,
    filter,
    pageSize,
  })

  return {
    rows,
    offset,
    hasMore,
    prevOffset: Math.max(0, offset - pageSize),
    nextOffset: offset + pageSize,
    sortColumn: column,
    sortDirection: direction,
    filter,
    pageSize,
  }
}

interface IndexRenderOptions {
  editRow?: WebhookRequestRow | null
  viewRow?: WebhookRequestRow | null
  formError?: string | undefined
  editingPayload?: string | undefined
  grid?: GridOverrides | undefined
}

async function renderIndexPage(
  context: Pick<AppContext, 'db' | 'render' | 'url' | 'session'>,
  overrides: IndexRenderOptions = {},
): Promise<Response> {
  let grid = overrides.grid ?? {}
  let data = await loadPageData(context, grid)

  let editRow = overrides.editRow ?? null
  let viewRow = overrides.viewRow ?? null
  if (!overrides.editRow && !overrides.viewRow) {
    let editingParam = context.url.searchParams.get('editing')
    if (editingParam && UUID_RE.test(editingParam)) {
      editRow = (await getWebhookRequest(context.db, editingParam)) ?? null
    } else {
      let viewingParam = context.url.searchParams.get('viewing')
      if (viewingParam && UUID_RE.test(viewingParam)) {
        viewRow = (await getWebhookRequest(context.db, viewingParam)) ?? null
      }
    }
  }

  let editingOffset = String(grid.offset ?? (context.url.searchParams.get('offset') || '0'))
  let editingSort = grid.column ?? (context.url.searchParams.get('sort') || 'created_at')
  let editingOrder = grid.direction ?? (context.url.searchParams.get('order') || 'desc')
  let editingFilter = grid.filter ?? (context.url.searchParams.get('filter') || '')

  return renderAdminPage(
    context.render,
    'webhooks',
    <AdminWebhookRequestsPage
      {...data}
      editRow={editRow}
      viewRow={viewRow}
      formError={overrides.formError}
      editingPayload={overrides.editingPayload}
      editingOffset={editingOffset}
      editingSort={editingSort}
      editingOrder={editingOrder}
      editingFilter={editingFilter}
    />,
  )
}

export const webhookRequests = createController(routes.admin.webhookRequests, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      return renderIndexPage(context)
    },

    // GET /admin/webhook-requests/:id mirrors ?editing=<id> (form action ==
    // frame src). A missing row PRGs back to the grid instead of 404ing.
    async show(context) {
      let id = context.params.id
      if (!id || !UUID_RE.test(id)) return redirectToGrid(context.url)

      let editRow = (await getWebhookRequest(context.db, id)) ?? null
      if (!editRow) return redirectToGrid(context.url)

      return renderIndexPage(context, { editRow })
    },

    async update(context) {
      let id = context.params.id
      if (!id || !UUID_RE.test(id)) {
        context.session.flash('error', 'Ungültige Webhook-ID.')
        return redirectToGrid(context.url)
      }

      let rawPayload = context.formData.get('payload')
      let parsed = parseWebhookRequestPayload(rawPayload)
      if (!parsed.ok) {
        let editRow = (await getWebhookRequest(context.db, id)) ?? null
        return renderIndexPage(context, {
          editRow,
          formError: parsed.message,
          editingPayload: typeof rawPayload === 'string' ? rawPayload : undefined,
          grid: gridOverridesFromForm(context.formData),
        })
      }

      let updated = false
      try {
        updated = await updateWebhookRequestPayload(context.db, id, JSON.stringify(parsed.payload))
      } catch (error) {
        if (process.env.NODE_ENV !== 'test') {
          console.error('Failed to update webhook request: ' + String(error))
        }
        context.session.flash('error', 'Fehler beim Speichern.')
        return redirectToGrid(context.url)
      }

      if (!updated) {
        context.session.flash('error', 'Webhook nicht gefunden.')
        return redirectToGrid(context.url)
      }

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'update',
          target_type: 'webhook_requests',
          target_id: id,
        })
      }

      webhookChannel.broadcast('invalidate')
      context.session.flash('success', 'Webhook gespeichert.')

      let params = gridStateToParams(gridStateFromFormData(context.formData))
      params.set('editing', id)
      return new Response(null, {
        status: 303,
        headers: { Location: routes.admin.webhookRequests.index.href() + '?' + params.toString() },
      })
    },

    // The frame commits the POST resend action path as its src; a reload of that
    // path must resolve instead of 404ing.
    async resendResolve(context) {
      return redirectToGrid(context.url)
    },

    async resend(context) {
      let id = context.params.id
      if (!id || !UUID_RE.test(id)) {
        context.session.flash('error', 'Ungültige Webhook-ID.')
        return redirectToGrid(context.url)
      }

      let row = await getWebhookRequestPayload(context.db, id)
      if (!row) {
        context.session.flash('error', 'Webhook nicht gefunden.')
        return redirectToGrid(context.url)
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

      let authIdentity = getAdminIdentity(context.auth)
      if (authIdentity) {
        await logAdminAction(context.db, {
          admin_user_id: authIdentity.id,
          admin_email: authIdentity.email,
          action_type: 'resend',
          target_type: 'webhook_requests',
          target_id: id,
          details: { status: hermesStatusText },
        })
      }

      webhookChannel.broadcast('invalidate')

      if (is2xx(hermesStatusText)) {
        context.session.flash('success', 'Webhook an Hermes gesendet.')
      } else {
        context.session.flash(
          'error',
          'Senden an Hermes fehlgeschlagen (' + hermesStatusText + ').',
        )
      }

      let params = gridStateToParams(gridStateFromURL(context.url))
      let qs = params.toString()
      return new Response(null, {
        status: 303,
        headers: {
          Location: routes.admin.webhookRequests.index.href() + (qs ? '?' + qs : ''),
        },
      })
    },
  },
})

export const webhookRequestsEvents = createController(routes.admin.webhookRequests.events, {
  middleware: [requireAdminSseAuth()],
  actions: {
    index(context) {
      return webhookChannel.subscribe(context.request)
    },
  },
})

// ── Legacy top-level viewer URLs ──

function legacyViewerRedirect(context: { url: URL }): Response {
  return new Response(null, {
    status: 308,
    headers: { Location: '/admin' + context.url.pathname + context.url.search },
  })
}

export const webhookRequestsLegacyRoot = createAction(system.webhookRequestsLegacyRoot, {
  handler: (context) => legacyViewerRedirect(context),
})

export const webhookRequestsLegacy = createAction(system.webhookRequestsLegacy, {
  handler: (context) => legacyViewerRedirect(context),
})
