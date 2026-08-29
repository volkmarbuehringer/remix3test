import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'
import { rotatedGlyphCss } from './mixins/icon.ts'
import { table } from './mixins/admin-table.ts'
import { formatTimestamp } from './mixins/admin-urls.ts'

import { routes } from '../routes.ts'
import { getSelfFrameTarget } from '../utils/frame-target.ts'
import { RestfulForm } from './restful-form.tsx'
import { GridStateHiddenInputs } from './grid-state-hidden.tsx'
import { ConfirmDelete } from './confirm-delete.browser.tsx'

const ADMIN_BASE = routes.admin.chatlog.index.href()

interface ChatLogPageProps {
  conversations: Array<{
    id: string
    created_at: number
    updated_at: number
  }>
  offset: number
  hasMore: boolean
  pageSize: number
  prevOffset: number
  nextOffset: number
}

// ── Styles ──

const descriptionStyle = css({
  margin: `0 0 ${theme.space.lg}`,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
})

const rowActionsStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
})

const iconActionStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  padding: 0,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  textDecoration: 'none',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
})

const iconActionDangerStyle = css({
  color: theme.colors.action.danger.background,
  borderColor: 'transparent',
  '&:hover': {
    background: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
  },
})

const conversationLinkStyle = css({
  color: theme.colors.action.primary.background,
  textDecoration: 'none',
  fontWeight: theme.fontWeight.semibold,
  '&:hover': { textDecoration: 'underline' },
})

const emptyStateStyle = css({
  textAlign: 'center',
  padding: theme.space.xxl,
  color: theme.colors.text.muted,
})

const pageBadgeStyle = css({
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.full,
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  whiteSpace: 'nowrap',
})

const colActionsWidth = css({ width: '120px' })

// ── Component ──

function shortThreadId(id: string): string {
  return id.length > 10 ? id.slice(0, 10) + '…' : id
}

export function ChatLogPage(handle: Handle<ChatLogPageProps>) {
  return () => {
    let { conversations, offset, hasMore, pageSize, prevOffset, nextOffset } = handle.props
    let pageStart = conversations.length > 0 ? offset + 1 : 0
    let pageEnd = offset + conversations.length
    let currentPage = pageSize > 0 ? Math.floor(offset / pageSize) + 1 : 0

    return (
      <div mix={table.page}>
        <ConfirmDelete />
        <h2 mix={table.title}>Chat-Konversationen</h2>
        <p mix={descriptionStyle}>Gespeicherte Support-Konversationen einsehen und verwalten.</p>

        <div mix={table.wrap} data-chatlog-table="true">
          {conversations.length === 0 ? (
            <div mix={emptyStateStyle}>Noch keine Konversationen gespeichert.</div>
          ) : (
            <table mix={table.table}>
              <colgroup>
                <col />
                <col mix={css({ width: '155px' })} />
                <col mix={css({ width: '155px' })} />
                <col mix={colActionsWidth} />
              </colgroup>
              <thead>
                <tr>
                  <th mix={table.th}>Konversation</th>
                  <th mix={table.th}>Erstellt</th>
                  <th mix={table.th}>Aktualisiert</th>
                  <th mix={table.th}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((conv) => {
                  let detailHref = routes.admin.chatlog.fragments.detail.href({ id: conv.id })
                  return (
                    <tr key={conv.id} mix={table.row}>
                      <td mix={table.td} title={conv.id}>
                        <a
                          href={detailHref}
                          data-rmx-target={getSelfFrameTarget()}
                          mix={conversationLinkStyle}
                        >
                          #{shortThreadId(conv.id)}
                        </a>
                      </td>
                      <td mix={table.td} title={formatTimestamp(conv.created_at)}>
                        {formatTimestamp(conv.created_at)}
                      </td>
                      <td mix={table.td} title={formatTimestamp(conv.updated_at)}>
                        {formatTimestamp(conv.updated_at)}
                      </td>
                      <td mix={table.actionCell}>
                        <div mix={rowActionsStyle}>
                          <a
                            href={detailHref}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={iconActionStyle}
                            aria-label="Detail anzeigen"
                            title="Detail anzeigen"
                          >
                            <Glyph name="eye" width={14} height={14} />
                          </a>

                          <RestfulForm
                            method="POST"
                            action={routes.admin.chatlog.destroy.href({ id: conv.id })}
                            data-delete-form={conv.id}
                            data-confirm={`Konversation #${conv.id} löschen?`}
                            data-rmx-target={getSelfFrameTarget()}
                            mix={css({ margin: 0, padding: 0 })}
                          >
                            <GridStateHiddenInputs
                              state={{ offset: String(offset), sort: '', order: '', filter: '' }}
                            />
                            <button
                              type="submit"
                              mix={[iconActionStyle, iconActionDangerStyle]}
                              aria-label="Löschen"
                              title="Löschen"
                            >
                              <Glyph name="trash" width={14} height={14} />
                            </button>
                          </RestfulForm>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {(offset > 0 || hasMore) && (
          <div mix={table.pagination}>
            <span mix={css({ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' })}>
              {conversations.length > 0 ? (
                <span mix={table.paginationInfo}>
                  Zeige {pageStart}–{pageEnd}
                </span>
              ) : null}
              {currentPage > 0 ? (
                <span mix={pageBadgeStyle} aria-label={`Seite ${currentPage}`}>
                  Seite {currentPage}
                </span>
              ) : null}
            </span>
            <div mix={table.flexGapSm}>
              {offset > 0 ? (
                <a
                  href={`${ADMIN_BASE}?offset=${prevOffset}`}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                >
                  <Glyph name="chevronRight" width={14} height={14} mix={rotatedGlyphCss} /> Zurück
                </a>
              ) : null}
              {hasMore ? (
                <a
                  href={`${ADMIN_BASE}?offset=${nextOffset}`}
                  data-rmx-target={getSelfFrameTarget()}
                  mix={table.pageLink}
                >
                  Weiter <Glyph name="chevronRight" width={14} height={14} />
                </a>
              ) : null}
            </div>
          </div>
        )}
      </div>
    )
  }
}
