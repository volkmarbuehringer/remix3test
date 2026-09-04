import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { system } from '../routes.ts'
import type { WebhookRequestRow } from '../data/webhook-requests.ts'
import { table } from './mixins/admin-table.ts'
import { sortArrow, buildEditUrl } from './mixins/admin-urls.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { ConnectionIndicator } from '../ui/connection-indicator.browser.tsx'
import { ConfirmDelete } from '../ui/confirm-delete.browser.tsx'
import { WebhookComposer } from '../actions/webhook-requests/public/webhook-composer.tsx'

const BASE = system.webhookRequests.href()

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
  viewRow?: WebhookRequestRow | null
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
  if (overrides.viewing) params.set('viewing', overrides.viewing)
  let qs = params.toString()
  return BASE + (qs ? '?' + qs : '')
}

function fmtDate(ts: number | string): string {
  return new Date(Number(ts)).toLocaleString('de-DE')
}

function relTime(ts: number | string): string {
  let diffSec = Math.round((Date.now() - Number(ts)) / 1000)
  let rtf = new Intl.RelativeTimeFormat('de-DE', { numeric: 'auto' })
  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, 'second')
  let diffMin = Math.round(diffSec / 60)
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute')
  let diffHr = Math.round(diffMin / 60)
  if (Math.abs(diffHr) < 24) return rtf.format(-diffHr, 'hour')
  let diffDay = Math.round(diffHr / 24)
  if (Math.abs(diffDay) < 30) return rtf.format(-diffDay, 'day')
  return fmtDate(ts)
}

function is2xx(s: string): boolean {
  let n = Number(s)
  return !Number.isNaN(n) && n >= 200 && n < 300
}

function statusBadgeMix(status: string | null) {
  if (!status) return statusBadgeNeutral
  if (status === 'error') return statusBadgeError
  return is2xx(status) ? statusBadgeOk : statusBadgeError
}

function truncatePayload(payload: Record<string, unknown>): string {
  let text = JSON.stringify(payload)
  if (text.length > 100) return text.slice(0, 100) + '...'
  return text
}

function pretty(value: unknown): string {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

export function WebhookRequestsPage(handle: Handle<WebhookRequestsPageProps>) {
  return () => {
    let p = handle.props
    let curSort = p.sortColumn
    let curOrder = p.sortDirection
    let curOffset = p.offset
    let curFilter = p.filter ?? ''
    let editRow = p.editRow
    let viewRow = p.viewRow ?? null
    let hasSidebar = !!editRow || !!viewRow

    let gridReturnUrl = buildUrl({
      offset: String(curOffset),
      sort: curSort,
      order: curOrder,
      filter: curFilter || undefined,
    })

    let headerContent = (
      <div mix={headerRow}>
        <h1 mix={table.title}>Webhook Requests</h1>
        <div mix={headerActions}>
          <a href={system.webhookRequestCreate.index.href()} mix={composeBtn}>
            Erstellen
          </a>
          <ConnectionIndicator
            url={system.webhookRequestEvents.href()}
            reloadMode="window"
            skipReloadParams={['editing', 'viewing']}
          />
        </div>
      </div>
    )

    let gridSection = (
      <div mix={hasSidebar ? table.minWidth0 : undefined}>
        <ConfirmDelete />
        <form method="GET" action={BASE} mix={table.filterBar}>
          <input
            type="text"
            name="filter"
            placeholder="Filter (Payload)"
            value={curFilter}
            mix={table.filterInput}
          />
          <input type="hidden" name="sort" value={curSort} />
          <input type="hidden" name="order" value={curOrder} />
          <input type="hidden" name="offset" value="0" />
          <button type="submit" mix={table.searchBtn}>
            Suchen
          </button>
          {curFilter && (
            <a
              href={buildUrl({ offset: '0', sort: curSort, order: curOrder, filter: undefined })}
              mix={table.clearLink}
            >
              Zurücksetzen
            </a>
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
                  <th
                    key={field || label}
                    style={w !== 'auto' ? { width: w } : undefined}
                    mix={field ? table.thSortable : table.th}
                  >
                    {field ? (
                      <a
                        href={buildUrl({
                          sort: field,
                          order: field === curSort ? (curOrder === 'asc' ? 'desc' : 'asc') : 'desc',
                          offset: '0',
                          filter: curFilter || undefined,
                        })}
                        mix={table.sortLink}
                      >
                        {label}
                        <span mix={field === curSort ? table.sortArrowActive : table.sortArrow}>
                          {sortArrow(field, curSort, curOrder)}
                        </span>
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
                  <td colspan={7} mix={table.empty}>
                    {curFilter ? (
                      <div mix={emptyStack}>
                        <span>Keine Treffer für „{curFilter}“.</span>
                        <a
                          href={buildUrl({
                            offset: '0',
                            sort: curSort,
                            order: curOrder,
                            filter: undefined,
                          })}
                          mix={emptyCta}
                        >
                          Filter zurücksetzen
                        </a>
                      </div>
                    ) : (
                      <div mix={emptyStack}>
                        <span>Noch keine Webhook-Requests.</span>
                        <a href={system.webhookRequestCreate.index.href()} mix={emptyCta}>
                          Ersten Request erstellen
                        </a>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                p.rows.map((row) => (
                  <tr
                    key={row.id}
                    mix={[
                      table.row,
                      editRow?.id === row.id || viewRow?.id === row.id
                        ? table.editingRow
                        : undefined,
                    ]}
                  >
                    <td mix={table.td} title={fmtDate(row.created_at)}>
                      {relTime(row.created_at)}
                    </td>
                    <td mix={table.td}>{row.source_ip}</td>
                    <td mix={table.td}>
                      {row.hermes_status ? (
                        <span mix={statusBadgeMix(row.hermes_status)}>{row.hermes_status}</span>
                      ) : (
                        <span mix={mutedDash}>—</span>
                      )}
                    </td>
                    <td
                      mix={table.td}
                      title={
                        row.callback_received_at ? fmtDate(row.callback_received_at) : undefined
                      }
                    >
                      {row.callback_received_at ? (
                        relTime(row.callback_received_at)
                      ) : (
                        <span mix={mutedDash}>—</span>
                      )}
                    </td>
                    <td mix={table.td} title={JSON.stringify(row.callback_response)}>
                      {row.callback_response ? (
                        <code mix={codeStyle}>{JSON.stringify(row.callback_response)}</code>
                      ) : (
                        <span mix={mutedDash}>—</span>
                      )}
                    </td>
                    <td mix={table.td}>
                      <a
                        href={buildUrl({
                          offset: String(curOffset),
                          sort: curSort,
                          order: curOrder,
                          filter: curFilter || undefined,
                          viewing: row.id,
                        })}
                        mix={payloadLink}
                        title="Details anzeigen"
                      >
                        <code mix={codeStyle}>{truncatePayload(row.payload)}</code>
                      </a>
                    </td>
                    <td mix={table.td}>
                      <div mix={table.btnGroup}>
                        <a
                          href={buildEditUrl(BASE, row.id, curOffset, curSort, curOrder, curFilter)}
                          mix={table.editBtn}
                        >
                          Bearbeiten
                        </a>
                        <form
                          method="POST"
                          action={`${BASE}/${row.id}/resend?offset=${curOffset}&sort=${curSort}&order=${curOrder}&filter=${encodeURIComponent(curFilter)}`}
                          data-confirm="Resend wirklich ausführen?"
                          mix={inlineForm}
                        >
                          <CsrfTokenInput />
                          <button type="submit" mix={actionBtn}>
                            Resenden
                          </button>
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
              Zeile {curOffset + 1}–{curOffset + p.rows.length}
            </span>
            <div mix={table.flexGapSm}>
              {curOffset > 0 ? (
                <a
                  href={buildUrl({
                    offset: String(p.prevOffset),
                    sort: curSort,
                    order: curOrder,
                    filter: curFilter || undefined,
                  })}
                  mix={table.pageLink}
                >
                  Zurück
                </a>
              ) : (
                <span mix={table.pageLinkDisabled}>Zurück</span>
              )}
              {p.hasMore ? (
                <a
                  href={buildUrl({
                    offset: String(p.nextOffset),
                    sort: curSort,
                    order: curOrder,
                    filter: curFilter || undefined,
                  })}
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

    let editPanel = editRow ? (
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

    let viewPanel =
      !editRow && viewRow ? (
        <div mix={table.stickyPanel}>
          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Request-Details</span>
              <div mix={table.spacer} />
              <a href={gridReturnUrl} mix={panelClose}>
                Schließen
              </a>
            </div>
            <div mix={table.panelBody}>
              <dl mix={metaGrid}>
                <div>
                  <dt mix={metaLabel}>Zeit</dt>
                  <dd mix={metaValue}>{fmtDate(viewRow.created_at)}</dd>
                </div>
                <div>
                  <dt mix={metaLabel}>Quelle</dt>
                  <dd mix={metaValue}>{viewRow.source_ip}</dd>
                </div>
                <div>
                  <dt mix={metaLabel}>Hermes-Status</dt>
                  <dd mix={metaValue}>
                    {viewRow.hermes_status ? (
                      <span mix={statusBadgeMix(viewRow.hermes_status)}>
                        {viewRow.hermes_status}
                      </span>
                    ) : (
                      <span mix={mutedDash}>—</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt mix={metaLabel}>Callback empfangen</dt>
                  <dd mix={metaValue}>
                    {viewRow.callback_received_at ? fmtDate(viewRow.callback_received_at) : '—'}
                  </dd>
                </div>
              </dl>

              <section mix={detailSection}>
                <h2 mix={detailTitle}>Payload</h2>
                <pre mix={preJson}>{JSON.stringify(viewRow.payload, null, 2)}</pre>
              </section>

              <section mix={detailSection}>
                <h2 mix={detailTitle}>Headers</h2>
                <pre mix={preJson}>{JSON.stringify(viewRow.headers, null, 2)}</pre>
              </section>

              <section mix={detailSection}>
                <h2 mix={detailTitle}>Callback-Antwort</h2>
                {viewRow.callback_response != null ? (
                  <pre mix={preJson}>{pretty(viewRow.callback_response)}</pre>
                ) : (
                  <p mix={mutedDash}>—</p>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null

    return (
      <div mix={page}>
        {headerContent}
        <div mix={hasSidebar ? table.twoColumn : undefined}>
          {gridSection}
          {editPanel ?? viewPanel}
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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.space.md,
})

const statusBadgeOk = css({
  fontSize: theme.fontSize.xs,
  padding: `2px 8px`,
  borderRadius: theme.radius.full,
  backgroundColor: theme.colors.success.background,
  color: theme.colors.success.foreground,
  fontWeight: theme.fontWeight.semibold,
})

const statusBadgeNeutral = css({
  fontSize: theme.fontSize.xs,
  padding: `2px 8px`,
  borderRadius: theme.radius.full,
  backgroundColor: theme.colors.action.secondary.background,
  color: theme.colors.action.secondary.foreground,
  fontWeight: theme.fontWeight.semibold,
})

const statusBadgeError = css({
  fontSize: theme.fontSize.xs,
  padding: `2px 8px`,
  borderRadius: theme.radius.full,
  backgroundColor: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  fontWeight: theme.fontWeight.semibold,
})

const codeStyle = css({
  fontSize: theme.fontSize.xs,
  backgroundColor: theme.surface.lvl2,
  padding: '2px 6px',
  borderRadius: theme.radius.sm,
})

const mutedDash = css({
  color: theme.colors.text.muted,
})

const payloadLink = css({
  display: 'block',
  color: 'inherit',
  textDecoration: 'none',
  cursor: 'pointer',
  '&:hover': { opacity: 0.75 },
})

const emptyStack = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.space.xs,
})

const emptyCta = css({
  display: 'inline-flex',
  padding: `${theme.space.xs} ${theme.space.md}`,
  backgroundColor: theme.colors.action.secondary.background,
  color: theme.colors.action.secondary.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
  textDecoration: 'none',
  '&:hover': { opacity: 0.9 },
})

const panelClose = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  '&:hover': { color: theme.colors.text.primary, textDecoration: 'underline' },
})

const metaGrid = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: theme.space.sm,
  margin: `0 0 ${theme.space.md}`,
})

const metaLabel = css({
  fontSize: theme.fontSize.xxs,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: theme.colors.text.muted,
  fontWeight: theme.fontWeight.semibold,
  marginBottom: '2px',
})

const metaValue = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

const detailSection = css({
  marginBottom: theme.space.md,
})

const detailTitle = css({
  margin: `0 0 ${theme.space.xs}`,
  fontSize: theme.fontSize.xs,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: theme.colors.text.muted,
  fontWeight: theme.fontWeight.semibold,
})

const preJson = css({
  margin: 0,
  padding: theme.space.sm,
  background: theme.surface.lvl0,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.primary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: '320px',
  overflowY: 'auto',
})

const inlineForm = css({
  display: 'inline-flex',
})

const actionBtn = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.space.xs,
  minWidth: '28px',
  minHeight: '28px',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: `0 ${theme.radius.md} ${theme.radius.md} 0`,
  fontSize: theme.fontSize.xs,
  cursor: 'pointer',
  fontWeight: theme.fontWeight.semibold,
  '&:hover': { opacity: 0.9 },
})
