import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import type { Database } from 'remix/data-table'

import { logAdminAction } from '../../../data/audit-log.ts'
import { messages } from '../../../data/schema.ts'
import { listMessages, type AdminMessageRow } from '../../../data/admin-messages.ts'
import {
  adminChannel,
  messageRateLimiter,
  broadcastInvalidate,
} from '../../../utils/messages-sse.ts'
import { requireAuth } from '../../../middleware/auth.ts'
import { requireAdmin } from '../../../middleware/admin.ts'
import { routes } from '../../../routes.ts'
import type { AppContext } from '../../../types/context.ts'
import { getCurrentUser } from '../../../utils/context.ts'

import { renderAdminPage } from '../../../ui/admin-layout.tsx'
import { AdminMessagesPage } from '../../../ui/admin-messages-page.tsx'
import { renderGridFormError, type AdminGridErrorState } from '../../../ui/admin-grid-error.tsx'
import { parseId } from '../../../utils/ids.ts'
import { getPageSize } from '../../../utils/get-page-size.ts'
import { gridStateFromFormData } from '../../../utils/grid-state.ts'
import { parseSort } from '../../../utils/sort-params.ts'
import { issuesToFieldErrors, readFormFieldValues } from '../../../utils/schema-utils.ts'

// The compose form carries the grid state as hidden inputs so a rejected
// submission can re-render the exact view the admin was looking at.
const MESSAGES_FORM_KEYS = ['content', '_offset', '_sort', '_order', '_filter'] as const

const messageSchema = f.object({
  content: f.field(s.defaulted(s.string(), '')),
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
})

const EMPTY_CONTENT_ERROR = 'Nachricht darf nicht leer sein.'
const RATE_LIMIT_ERROR = 'Bitte kurz warten, bevor du eine weitere Nachricht sendest.'

function sanitizeContent(content: string): string {
  return content
    .slice(0, 1000)
    .replace(/[<>'"&]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
}

const MESSAGES_PAGE_LIMIT = 10

/** Sortable columns (whitelisted; the SQL expressions are the keys of
 *  SORT_EXPRS in ../data/admin-messages.ts). */
const SORTABLE_FIELDS = ['id', 'sender_name', 'content', 'created_at'] as const

/** Clamps a query/form offset to a non-negative integer. */
function parseOffset(raw: string | null | undefined): number {
  let value = Number(raw ?? '')
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/** Clamps a query/form filter to a bounded string (optional). */
function parseFilter(raw: string | null | undefined): string | undefined {
  let value = raw?.trim() ?? ''
  return value ? value.slice(0, 200) : undefined
}

// -- Grid state read back from the compose/delete forms --

function gridOffset(raw: Record<string, string>): number {
  return Math.max(0, Number(raw._offset) || 0)
}

function gridSortColumn(raw: Record<string, string>): string {
  let col = raw._sort
  return col && (SORTABLE_FIELDS as readonly string[]).includes(col) ? col : 'created_at'
}

function gridSortDirection(raw: Record<string, string>): 'asc' | 'desc' {
  return raw._order === 'asc' ? 'asc' : 'desc'
}

function gridFilter(raw: Record<string, string>): string | undefined {
  return raw._filter || undefined
}

/**
 * Post/redirect/GET target that preserves a non-default grid state.
 *
 * Defaults (offset 0, sort created_at, order desc) are omitted so the common
 * success redirect stays a bare /admin/messages while a filtered, sorted, or
 * paged view survives sending/deleting.
 */
function messagesGridUrl(formData: FormData): string {
  let state = gridStateFromFormData(formData)
  let params = new URLSearchParams()
  let offset = Number(state.offset) || 0
  if (offset > 0) params.set('offset', String(offset))
  if (state.sort && state.sort !== 'created_at') params.set('sort', state.sort)
  if (state.order && state.order !== 'desc') params.set('order', state.order)
  if (state.filter) params.set('filter', state.filter)
  let qs = params.toString()
  return routes.admin.messages.index.href() + (qs ? '?' + qs : '')
}

async function loadMessagesGrid(
  db: Database,
  opts: {
    offset: number
    column: string
    direction: 'asc' | 'desc'
    filter?: string | undefined
    pageSize: number
  },
): Promise<{ rows: AdminMessageRow[]; hasMore: boolean }> {
  let rows = await listMessages(
    db,
    opts.pageSize + 1,
    opts.offset,
    opts.filter,
    opts.column,
    opts.direction,
  )
  let hasMore = rows.length > opts.pageSize
  if (hasMore) rows.pop()
  return { rows, hasMore }
}

async function renderMessagesPage(
  context: Pick<AppContext, 'db' | 'render' | 'session' | 'url'>,
  opts: { offset: number; filter?: string | undefined; column: string; direction: 'asc' | 'desc' },
): Promise<Response> {
  let effectivePageSize = getPageSize(context.session, MESSAGES_PAGE_LIMIT)

  let { rows, hasMore } = await loadMessagesGrid(context.db, {
    offset: opts.offset,
    column: opts.column,
    direction: opts.direction,
    filter: opts.filter,
    pageSize: effectivePageSize,
  })

  return renderAdminPage(
    context.render,
    'messages',
    <AdminMessagesPage
      messages={rows}
      offset={opts.offset}
      hasMore={hasMore}
      pageSize={effectivePageSize}
      prevOffset={Math.max(0, opts.offset - effectivePageSize)}
      nextOffset={opts.offset + effectivePageSize}
      filter={opts.filter}
      sortColumn={opts.column}
      sortDirection={opts.direction}
    />,
  )
}

type MessagesRenderContext = {
  db: Database
  render: Parameters<typeof renderAdminPage>[0]
}

/**
 * Re-render the messages page with a validation/rate-limit error (Pattern 1
 * direct re-render).
 *
 * A compose failure must never be a bare 400/429: the frame transport treats a
 * non-OK response as an unrecoverable error card, losing the typed message.
 * renderGridFormError returns the fragment at status 200 with the submitted
 * text and per-field/per-form errors preserved, so the compose box stays usable.
 */
async function renderMessagesError(
  context: MessagesRenderContext,
  opts: {
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
  return renderGridFormError<AdminMessageRow>({
    render: context.render,
    activeItem: 'messages',
    loadRows: () =>
      loadMessagesGrid(context.db, {
        offset: opts.offset,
        column: opts.column,
        direction: opts.direction,
        filter: opts.filter,
        pageSize: opts.pageSize,
      }),
    buildPage: (page) => (
      <AdminMessagesPage
        messages={page.rows}
        offset={page.offset}
        hasMore={page.hasMore}
        pageSize={page.pageSize}
        prevOffset={Math.max(0, page.offset - page.pageSize)}
        nextOffset={page.offset + page.pageSize}
        filter={page.filter}
        sortColumn={page.sortColumn}
        sortDirection={page.sortDirection}
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

export default createController(routes.admin.messages, {
  middleware: [requireAuth(), requireAdmin()],

  actions: {
    async index(context) {
      let offset = parseOffset(context.url.searchParams.get('offset'))
      let filter = parseFilter(context.url.searchParams.get('filter'))
      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_FIELDS,
        defaultColumn: 'created_at',
        defaultDirection: 'desc',
      })
      return renderMessagesPage(context, { offset, filter, column, direction })
    },

    // The frame commits the POST delete form action path (form action == frame
    // src) as its address after submission, and the live ConnectionIndicator
    // reloads it on invalidate. Render the list so that GET of the action path
    // resolves instead of falling to a 404 (POST-only route).
    async destroyResolve(context) {
      let offset = parseOffset(context.url.searchParams.get('offset'))
      let filter = parseFilter(context.url.searchParams.get('filter'))
      let { column, direction } = parseSort(context.url, {
        allowedColumns: SORTABLE_FIELDS,
        defaultColumn: 'created_at',
        defaultDirection: 'desc',
      })
      return renderMessagesPage(context, { offset, filter, column, direction })
    },

    async action(context) {
      let db = context.db
      let formData = context.formData
      let effectivePageSize = getPageSize(context.session, MESSAGES_PAGE_LIMIT)

      let rawValues = readFormFieldValues(MESSAGES_FORM_KEYS, formData)
      let parseResult = s.parseSafe(messageSchema, formData)

      // Grid state for the re-render, shared by every failure path.
      let gridOpts = {
        formValues: { content: rawValues.content ?? '' },
        offset: gridOffset(rawValues),
        column: gridSortColumn(rawValues),
        direction: gridSortDirection(rawValues),
        filter: gridFilter(rawValues),
        pageSize: effectivePageSize,
      }

      if (!parseResult.success) {
        return renderMessagesError(context, {
          ...gridOpts,
          fieldErrors: issuesToFieldErrors(parseResult.issues),
        })
      }

      // Characters such as < > & ' " are stripped as defense in depth; when
      // that leaves nothing, reject with an inline error instead of a bare 400
      // that would lose the input and break the frame render.
      let content = sanitizeContent(parseResult.value.content)
      if (!content) {
        return renderMessagesError(context, {
          ...gridOpts,
          fieldErrors: { content: EMPTY_CONTENT_ERROR },
        })
      }

      let user = getCurrentUser()

      if (!messageRateLimiter.attempt(user.id)) {
        return renderMessagesError(context, { ...gridOpts, formError: RATE_LIMIT_ERROR })
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

      logAdminAction(context.db, {
        admin_user_id: user.id,
        admin_email: user.email,
        action_type: 'create',
        target_type: 'messages',
        target_id: row.id as number,
        details: { content_preview: content.slice(0, 100) },
      })

      context.session.flash('success', 'Nachricht gesendet.')
      broadcastInvalidate()

      return redirect(messagesGridUrl(formData))
    },

    async destroy(context) {
      let db = context.db
      let { params } = context
      let messageId = parseId(params.id)

      if (messageId === undefined || messageId < 1) {
        return new Response('Invalid message ID', { status: 400 })
      }

      await db.delete(messages, { id: messageId })

      let user = getCurrentUser()
      logAdminAction(context.db, {
        admin_user_id: user.id,
        admin_email: user.email,
        action_type: 'destroy',
        target_type: 'messages',
        target_id: messageId,
      })

      context.session.flash('success', 'Nachricht gelöscht.')
      broadcastInvalidate()

      // Preserve the current grid state (offset, sort, order, filter) so the
      // post-delete redirect lands back on the same view.
      return redirect(messagesGridUrl(context.formData))
    },

    subscribe(context) {
      return adminChannel.subscribe(context.request)
    },
  },
})
