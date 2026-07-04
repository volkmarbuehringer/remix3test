import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { webhookRequestsRoute, webhookRequestsEventsRoute } from '../routes.ts'
import type { WebhookRequestRow } from '../data/webhook-requests.ts'
import { table } from './mixins/admin-table.ts'
import { sortArrow, buildEditUrl } from './mixins/admin-urls.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { ConnectionIndicator } from '../assets/connection-indicator.tsx'
import { ConfirmDelete } from '../assets/confirm-delete.tsx'
import { WebhookComposer } from '../assets/webhook-composer.tsx'

const BASE = webhookRequestsRoute.href()

interface WebhookRequestsPageProps {
  rows: WebhookRequestRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
  editRow?: WebhookRequestRow | null
  editingOffset?: string
  editingSort?: string
  editingOrder?: string
  editingFilter?: string
}

function buildUrl(overrides: Record<string, string | undefined>): string {
  let params = new URLSearchParams()
  if (overrides.offset && overrides.offset !== '0') params.set('offset', overrides.offset)
  params.set('sort', overrides.sort ?? 'created_at')
  params.set('order', overrides.order ?? 'desc')
  if (overrides.filter) params.set('filter', overrides.filter)
  let qs = params.toString()
  return BASE + (qs ? '?' + qs : '')
}

function fmtDate(ts: number | string): string {
  return new Date(Number(ts)).toLocaleString('de-DE')
}

function is2xx(s: string): boolean {
  let n = Number(s)
  return !Number.isNaN(n) && n >= 200 && n < 300
}

function truncatePayload(payload: Record<string, unknown>): string {
  let text = JSON.stringify(payload)
  if (text.length > 100) return text.slice(0, 100) + '...'
  return text
}

export function WebhookRequestsPage(handle: Handle<WebhookRequestsPageProps>) {
  return () => {
    let p = handle.props
    let curSort = p.sortColumn
    let curOrder = p.sortDirection
    let curOffset = p.offset
    let curFilter = p.filter ?? ''
    let editRow = p.editRow
    let hasSidebar = !!editRow

    let headerContent = (
      <div mix={headerRow}>
        <h1 mix={table.title}>Webhook Requests</h1>
        <div mix={headerActions}>
          <a href="/webhook-requests/create" mix={composeBtn}>Erstellen</a>
          <ConnectionIndicator url={webhookRequestsEventsRoute.href()} reloadMode="window" skipReloadParams={['editing']} />
        </div>
      </div>
    )

    let gridSection = (
      <div mix={hasSidebar ? table.minWidth0 : undefined}>
        <ConfirmDelete />
        <form method="GET" action={BASE} mix={table.filterBar}>
          <input type="text" name="filter" placeholder="Filter (Payload)" value={curFilter} mix={table.filterInput} />
          <input type="hidden" name="sort" value={curSort} />
          <input type="hidden" name="order" value={curOrder} />
          <input type="hidden" name="offset" value="0" />
          <button type="submit" mix={table.searchBtn}>Suchen</button>
          {curFilter && (
            <a href={BASE} mix={table.clearLink}>Zurücksetzen</a>
          )}
        </form>

        <div mix={table.wrap}>
          <table mix={table.table}>
            <thead>
              <tr>
                {(
                  [
                    ['created_at', 'Zeit', 'auto'],
                    ['source_ip', 'Quelle', '130px'],
                    ['hermes_status', 'Status', '70px'],
                    ['callback_received_at', 'Callback empfangen', '145px'],
                    ['', 'Callback', '100px'],
                    ['', 'Payload', 'auto'],
                    ['', 'Aktion', '150px'],
                  ] as [string, string, string][]
                ).map(([field, label, w]) => (
                  <th key={field || label} style={w !== 'auto' ? { width: w } : undefined} mix={field ? table.thSortable : table.th}>
                    {field ? (
                      <a
                        href={buildUrl({ sort: field, order: field === curSort ? (curOrder === 'asc' ? 'desc' : 'asc') : 'desc', offset: '0', filter: curFilter || undefined })}
                        mix={table.sortLink}
                      >
                        {label}
                        <span mix={field === curSort ? table.sortArrowActive : table.sortArrow}>{sortArrow(field, curSort, curOrder)}</span>
                      </a>
                    ) : (
                      label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.rows.length === 0 ? (
                <tr>
                    <td colspan={7} mix={table.empty}>Noch keine Webhook-Requests.</td>
                </tr>
              ) : (
                p.rows.map((row) => (
                  <tr key={row.id} mix={[table.row, editRow?.id === row.id ? table.editingRow : undefined]}>
                    <td mix={table.td}>{fmtDate(row.created_at)}</td>
                    <td mix={table.td}>{row.source_ip}</td>
                    <td mix={table.td}><span mix={!row.hermes_status ? statusBadgeNeutral : row.hermes_status === 'error' ? statusBadgeError : is2xx(row.hermes_status) ? statusBadgeOk : statusBadgeError}>{row.hermes_status ?? '-'}</span></td>
                    <td mix={table.td}>{row.callback_received_at ? fmtDate(row.callback_received_at) : <span mix={statusBadgeNeutral}>-</span>}</td>
                    <td mix={table.td}>{row.callback_response ? <code mix={codeStyle} title={JSON.stringify(row.callback_response)}>{JSON.stringify(row.callback_response)}</code> : <span mix={statusBadgeNeutral}>-</span>}</td>
                    <td mix={table.td} title={JSON.stringify(row.payload)}><code mix={codeStyle}>{truncatePayload(row.payload)}</code></td>
                    <td mix={table.td}>
                      <div mix={table.btnGroup}>
                        <a
                          href={buildEditUrl(BASE, row.id, curOffset, curSort, curOrder, curFilter)}
                          mix={table.editBtn}
                        >
                          Bearbeiten
                        </a>
                        <form method="POST" action={`${BASE}/${row.id}/resend?offset=${curOffset}&sort=${curSort}&order=${curOrder}&filter=${encodeURIComponent(curFilter)}`} data-confirm="Resend wirklich ausführen?" mix={inlineForm}>
                          <CsrfTokenInput />
                          <button type="submit" mix={actionBtn}>Resenden</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {p.rows.length > 0 && (
          <div mix={table.pagination}>
            <span mix={table.paginationInfo}>
              ab Zeile {curOffset + 1}
            </span>
            <div mix={table.flexGapSm}>
              {curOffset > 0 ? (
                <a
                  href={buildUrl({ offset: String(p.prevOffset), sort: curSort, order: curOrder, filter: curFilter || undefined })}
                  mix={table.pageLink}
                >
                  Zurück
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>Zurück</span>
              )}
              {p.hasMore ? (
                <a
                  href={buildUrl({ offset: String(p.nextOffset), sort: curSort, order: curOrder, filter: curFilter || undefined })}
                  mix={table.pageLink}
                >
                  Vor
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>Vor</span>
              )}
            </div>
          </div>
        )}
      </div>
    )

    let editPanel = hasSidebar && editRow ? (
      <div mix={table.stickyPanel}>
        <WebhookComposer
          initialPayload={JSON.stringify(editRow.payload)}
          editId={editRow.id}
          _offset={p.editingOffset ?? String(curOffset)}
          _sort={p.editingSort ?? curSort}
          _order={p.editingOrder ?? curOrder}
          _filter={p.editingFilter ?? curFilter}
        />
      </div>
    ) : null

    return (
      <div mix={page}>
        {headerContent}
        <div mix={hasSidebar ? table.twoColumn : undefined}>
          {gridSection}
          {editPanel}
        </div>
      </div>
    )
  }
}

const page = css({ maxWidth: '1000px', margin: '0 auto', padding: theme.space.xl })

const headerActions = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
})

const composeBtn = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  backgroundColor: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  textDecoration: 'none',
  '&:hover': {
    backgroundColor: theme.colors.action.primary.backgroundHover,
  },
})

const headerRow = css({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: theme.space.md,
})

const statusBadgeOk = css({
  fontSize: theme.fontSize.xs, padding: `2px 8px`, borderRadius: theme.radius.sm,
  backgroundColor: '#22c55e', color: '#fff', fontWeight: theme.fontWeight.semibold,
})

const statusBadgeNeutral = css({
  fontSize: theme.fontSize.xs, padding: `2px 8px`, borderRadius: theme.radius.sm,
  backgroundColor: '#6b7280', color: '#fff', fontWeight: theme.fontWeight.semibold,
})

const statusBadgeError = css({
  fontSize: theme.fontSize.xs, padding: `2px 8px`, borderRadius: theme.radius.sm,
  backgroundColor: '#ef4444', color: '#fff', fontWeight: theme.fontWeight.semibold,
})

const codeStyle = css({
  fontSize: theme.fontSize.xs, backgroundColor: theme.surface.lvl2,
  padding: '2px 6px', borderRadius: theme.radius.sm,
})

const inlineForm = css({
  display: 'inline-flex',
})

const actionBtn = css({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: theme.space.xs, minWidth: '28px', minHeight: '28px',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: `0 ${theme.radius.md} ${theme.radius.md} 0`,
  fontSize: theme.fontSize.xs, cursor: 'pointer',
  fontWeight: theme.fontWeight.semibold,
  '&:hover': { opacity: 0.9 },
})
