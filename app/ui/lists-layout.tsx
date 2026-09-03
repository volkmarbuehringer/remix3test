import { type RemixNode, type Handle, css, Frame } from 'remix/ui'
import { getContext } from 'remix/middleware/async-context'
import { theme } from '../ui/theme/theme.ts'

import { Layout, tooltipAnchorStyle } from './layout.tsx'
import { NavLink } from './nav-link.tsx'
import { routes, frames } from '../routes.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { ConfirmDelete } from '../ui/confirm-delete.browser.tsx'
import { ListNameEdit } from '../actions/lists/public/list-name-edit.tsx'
import { ListsSearch } from '../actions/lists/public/lists-search.tsx'
import { ListsSidebarKeyboard } from '../actions/lists/public/lists-sidebar-keyboard.tsx'
import { ListsRowActions } from '../actions/lists/public/lists-row-actions.tsx'
import {
  shellStyle,
  sidebarStyle,
  sidebarHeaderStyle,
  headerIconWrapStyle,
  headerDividerStyle,
  navStyle,
  navLinkStyle,
  navIconStyle,
  navActiveStyle,
  groupLabelStyle,
  contentStyle,
} from './sidebar-layout.tsx'

export type ListsNavItem = 'new' | `list:${number}`

export type ListSidebarEntry = {
  id: ListsNavItem
  label: string
  count: number
  doneCount?: number
  updatedAt?: number
}

export type ListInitialState = {
  id: number
  title: string
  description: string
  items: Array<{ id: string; label: string; done?: boolean }>
  updated_at: number
} | null

export type PaginationState = {
  offset: number
  hasMore: boolean
  limit: number
}

const frameTarget = frames.listsContent

/**
 * Slot content for the shell's self-relay frame. Without a fallback the frame
 * is blocking: a non-HTML frame response would fail the whole page render.
 */
const frameFallbackStyle = css({
  padding: '1.5rem',
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  border: `1px solid ${theme.colors.border.default}`,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.sm,
})

/**
 * The shared shell grid top-aligns its columns (align-items: start), which
 * leaves the sidebar and the editor card at different heights. Stretching both
 * columns here makes the two boxes match — the sidebar `aside` and the editor
 * card below both fill the grid row height.
 */
const shellAlignStretchStyle = css({
  alignItems: 'stretch',
})

/**
 * The /lists editor is a full-height page: `pageStyle` (in the top-level
 * Layout) is a definite-height scroll container and the Frame splices this grid
 * in as its direct child, so `height: 100%` bounds the shell to the viewport.
 * Without it the grid grew to its content height (~780px with 5 items) and the
 * element list — sitting after the header/description/add-item controls — was
 * pushed below the fold, so the last elements were unreachable and the list
 * never showed a scrollbar. Bounding the shell lets the editor card fill the
 * viewport and the element list scroll internally.
 */
const shellFullHeightStyle = css({
  height: '100%',
  gridTemplateRows: 'minmax(0, 1fr)',
})

/**
 * The sidebar panel height is fixed (independent of how many lists are on the
 * current page, so it doesn't jump during navigation). It leaves a little free
 * space below the panel — between it and the footer — by using a bottom margin,
 * while the nav still fills the panel and scrolls internally.
 */
const sidebarScrollContainerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: theme.space.lg,
  minHeight: 0,
  overflow: 'hidden',
})

const navScrollStyle = css({
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 'auto',
  minHeight: 0,
  overflowY: 'auto',
})

/**
 * The content column is a flex column; centering its single child (the content-
 * sized editor card) vertically puts the free space above and below the card —
 * never inside it. When the card is taller than the column it is capped by
 * `max-height` on the card and the element list scrolls internally.
 */
const contentVerticalCenterStyle = css({
  justifyContent: 'center',
})

function isFrameRequest(): boolean {
  return getContext().request.headers.get('X-Remix-Target') === frameTarget
}

export function renderListsPage(
  render: (node: RemixNode, init?: ResponseInit) => Response,
  activeItem: ListsNavItem,
  sidebarEntries: ListSidebarEntry[],
  content: RemixNode,
  pagination?: PaginationState,
  init?: ResponseInit,
) {
  return render(
    <ShellOrFragment
      activeItem={activeItem}
      sidebarEntries={sidebarEntries}
      pagination={pagination}
    >
      {content}
    </ShellOrFragment>,
    init,
  )
}

function ShellOrFragment(
  handle: Handle<{
    activeItem: ListsNavItem
    sidebarEntries: ListSidebarEntry[]
    pagination?: PaginationState
    children?: RemixNode
  }>,
) {
  return () => {
    let { activeItem, sidebarEntries, pagination, children } = handle.props
    if (isFrameRequest()) {
      return (
        <ListsLayout
          activeItem={activeItem}
          sidebarEntries={sidebarEntries}
          pagination={pagination}
        >
          {children}
        </ListsLayout>
      )
    }
    if (getContext().request.method !== 'GET') {
      return (
        <Layout>
          <ListsLayout
            activeItem={activeItem}
            sidebarEntries={sidebarEntries}
            pagination={pagination}
          >
            {children}
          </ListsLayout>
        </Layout>
      )
    }
    return (
      <Layout>
        <Frame
          name={frameTarget}
          src={getContext().request.url}
          fallback={<div mix={frameFallbackStyle}>Inhalt wird geladen…</div>}
        />
      </Layout>
    )
  }
}

function buildListHref(listId: number, pagination?: PaginationState): string {
  let params = new URLSearchParams()
  params.set('load', String(listId))
  if (pagination && pagination.offset > 0) {
    params.set('offset', String(pagination.offset))
  }
  return routes.lists.index.href() + '?' + params.toString()
}

function buildPageHref(offset: number, pagination: PaginationState): string {
  let params = new URLSearchParams()
  params.set('offset', String(offset))
  let loadParam = new URL(getContext().request.url).searchParams.get('load')
  if (loadParam) {
    params.set('load', loadParam)
  }
  return routes.lists.index.href() + '?' + params.toString()
}

function ListsLayout(
  handle: Handle<{
    activeItem: ListsNavItem
    sidebarEntries: ListSidebarEntry[]
    pagination?: PaginationState
    children?: RemixNode
  }>,
) {
  return () => {
    let { activeItem, sidebarEntries, pagination, children } = handle.props
    return (
      <div mix={[shellStyle, shellAlignStretchStyle, shellFullHeightStyle]}>
        <aside mix={[sidebarStyle, sidebarScrollContainerStyle]}>
          <div mix={sidebarHeaderStyle}>
            <span mix={headerIconWrapStyle}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <line x1="9" y1="12" x2="15" y2="12" />
                <line x1="9" y1="16" x2="13" y2="16" />
              </svg>
            </span>
            <span>Listen</span>
          </div>
          <div mix={headerDividerStyle} />
          <nav mix={[navStyle, navScrollStyle]}>
            <p mix={groupLabelStyle}>Meine Listen</p>
            <input
              id="lists-sidebar-search"
              type="search"
              defaultValue={new URL(getContext().request.url).searchParams.get('filter') ?? ''}
              placeholder="Suchen…"
              mix={css({
                width: '100%',
                padding: `${theme.space.xs} ${theme.space.sm}`,
                marginBottom: theme.space.sm,
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.border.default}`,
                fontSize: theme.fontSize.xs,
                outline: 'none',
                fontFamily: theme.fontFamily.sans,
                boxSizing: 'border-box',
                backgroundColor: theme.surface.lvl0,
                color: theme.colors.text.primary,
                '&:focus': {
                  borderColor: theme.colors.focus.ring,
                },
                '&::placeholder': {
                  color: theme.colors.text.muted,
                },
              })}
            />
            <ListsSearch />
            <NavLink
              key="new"
              href={routes.lists.index.href()}
              target={frameTarget}
              active={activeItem === 'new'}
              mix={[navLinkStyle, activeItem === 'new' && navActiveStyle].filter(Boolean)}
            >
              <span mix={navIconStyle}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
              Neue Liste
            </NavLink>
            {sidebarEntries.map((entry) => {
              let listId =
                typeof entry.id === 'string' && entry.id.startsWith('list:')
                  ? Number(entry.id.slice(5))
                  : null
              let href =
                listId !== null ? buildListHref(listId, pagination) : routes.lists.index.href()
              let noDescription = !entry.label.trim()
              let displayName = noDescription ? `Liste #${listId}` : entry.label
              return (
                <div
                  key={entry.id}
                  mix={entryRowStyle}
                  data-list-id={listId ?? undefined}
                  data-updated-at={entry.updatedAt ?? undefined}
                >
                  <NavLink
                    href={href}
                    target={frameTarget}
                    active={activeItem === entry.id}
                    mix={[
                      navLinkStyle,
                      entryNavLinkStyle,
                      tooltipAnchorStyle,
                      activeItem === entry.id && navActiveStyle,
                    ].filter(Boolean)}
                    dataTooltip={displayName}
                  >
                    <span mix={navIconStyle}>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                        <rect x="9" y="3" width="6" height="4" rx="1" />
                        <line x1="9" y1="12" x2="15" y2="12" />
                        <line x1="9" y1="16" x2="13" y2="16" />
                      </svg>
                    </span>
                    <span
                      mix={[noDescription ? descEmptyStyle : undefined, truncateStyle].filter(
                        Boolean,
                      )}
                      data-list-name
                    >
                      {displayName}
                    </span>
                    <span
                      mix={countBadgeStyle}
                      data-list-count
                      aria-label={
                        entry.doneCount != null
                          ? `${entry.doneCount} von ${entry.count} erledigt`
                          : `${entry.count} Eintr${entry.count !== 1 ? 'äge' : 'ag'}`
                      }
                    >
                      {entry.doneCount != null ? `${entry.doneCount}/${entry.count}` : entry.count}
                    </span>
                  </NavLink>
                  {listId !== null && (
                    <div mix={rowActionsStyle} data-list-row-actions>
                      <button
                        type="button"
                        data-list-rename-btn
                        data-list-row-action
                        mix={renameBtnStyle}
                        aria-label={`Liste "${displayName}" umbenennen`}
                        title="Umbenennen"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </button>
                      <form
                        method="POST"
                        action={routes.lists.destroy.href({ id: listId })}
                        data-rmx-target={frameTarget}
                        data-confirm={`"${displayName}" löschen?`}
                        data-list-row-action
                        mix={deleteFormStyle}
                      >
                        <CsrfTokenInput />
                        <button
                          type="submit"
                          data-list-delete-btn
                          data-list-row-action
                          mix={deleteBtnStyle}
                          aria-label={`Liste "${displayName}" löschen`}
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )
            })}
            <ListNameEdit />
            <ListsSidebarKeyboard />
            <ListsRowActions />
            <ConfirmDelete />
            {sidebarEntries.length === 0 && <p mix={emptyHintStyle}>Keine gespeicherten Listen</p>}
            {pagination && sidebarEntries.length > 0 && (
              <div mix={paginationStyle}>
                {pagination.offset > 0 ? (
                  <NavLink
                    href={buildPageHref(pagination.offset - pagination.limit, pagination)}
                    target={frameTarget}
                    mix={paginationBtnStyle}
                  >
                    ← Vorherige
                  </NavLink>
                ) : (
                  <span mix={paginationBtnDisabledStyle}>← Vorherige</span>
                )}
                <span mix={pageIndicatorStyle}>
                  Seite {Math.floor(pagination.offset / pagination.limit) + 1}
                </span>
                {pagination.hasMore ? (
                  <NavLink
                    href={buildPageHref(pagination.offset + pagination.limit, pagination)}
                    target={frameTarget}
                    mix={paginationBtnStyle}
                  >
                    Nächste →
                  </NavLink>
                ) : (
                  <span mix={paginationBtnDisabledStyle}>Nächste →</span>
                )}
              </div>
            )}
          </nav>
        </aside>
        <section mix={[contentStyle, contentVerticalCenterStyle]}>{children}</section>
      </div>
    )
  }
}

const countBadgeStyle = css({
  marginLeft: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '20px',
  height: '20px',
  padding: '0 6px',
  background: theme.colors.border.default,
  borderRadius: theme.radius.full,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
})

const descEmptyStyle = css({
  fontStyle: 'italic',
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
})

const emptyHintStyle = css({
  padding: `${theme.space.sm} ${theme.space.md}`,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
})

const entryRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '-2px',
  },
})

const rowActionsStyle = css({
  position: 'absolute',
  right: '8px',
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
  zIndex: 2,
  pointerEvents: 'none',
})

const deleteFormStyle = css({
  margin: 0,
  padding: 0,
  flexShrink: 0,
  display: 'flex',
  opacity: 0,
  pointerEvents: 'none',
  transition: 'opacity 0.12s ease',
})

const deleteBtnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: theme.colors.action.danger.border,
  cursor: 'pointer',
  borderRadius: theme.radius.sm,
  ':hover': {
    background: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
  },
})

const renameBtnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  borderRadius: theme.radius.sm,
  opacity: 0,
  pointerEvents: 'none',
  transition: 'opacity 0.12s ease',
  ':hover': {
    background: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
})

const entryNavLinkStyle = css({
  flex: 1,
  minWidth: 0,
})

const truncateStyle = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

const paginationStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderTop: `1px solid ${theme.colors.border.default}`,
  // Pin the pagination to the bottom of the full-height sidebar so there is no
  // empty space below it; a short list leaves the free space above it instead.
  marginTop: 'auto',
})

const paginationBtnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  fontSize: theme.fontSize.xs,
  borderRadius: theme.radius.sm,
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  ':hover': {
    background: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
})

const paginationBtnDisabledStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  opacity: 0.5,
})

const pageIndicatorStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})
