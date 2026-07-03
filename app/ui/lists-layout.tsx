import { type RemixNode, type Handle, css, Frame } from 'remix/ui'
import { getContext } from 'remix/middleware/async-context'
import { theme } from '../lib/theme.ts'

import { Layout, tooltipAnchorStyle } from './layout.tsx'
import { Breadcrumbs, getBreadcrumbs } from './breadcrumbs.tsx'
import { NavLink } from './nav-link.tsx'
import { routes, frames } from '../routes.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { ConfirmDelete } from '../assets/confirm-delete.tsx'
import { ListNameEdit } from '../assets/list-name-edit.tsx'
import { ListsSearch } from '../assets/lists-search.tsx'
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
  updatedAt?: number
}

export type ListInitialState = {
  id: number
  description: string
  items: Array<{ id: string; label: string }>
  updated_at: number
} | null

export type PaginationState = {
  offset: number
  hasMore: boolean
  limit: number
}

const frameTarget = frames.listsContent

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
    <ShellOrFragment activeItem={activeItem} sidebarEntries={sidebarEntries} pagination={pagination}>
      {content}
    </ShellOrFragment>,
    init,
  )
}

function ShellOrFragment(handle: Handle<{
  activeItem: ListsNavItem
  sidebarEntries: ListSidebarEntry[]
  pagination?: PaginationState
  children?: RemixNode
}>) {
  return () => {
    let { activeItem, sidebarEntries, pagination, children } = handle.props
    if (isFrameRequest()) {
      return <ListsLayout activeItem={activeItem} sidebarEntries={sidebarEntries} pagination={pagination}>{children}</ListsLayout>
    }
    if (getContext().request.method !== 'GET') {
      return (
        <Layout>
          <ListsLayout activeItem={activeItem} sidebarEntries={sidebarEntries} pagination={pagination}>{children}</ListsLayout>
        </Layout>
      )
    }
    return (
      <Layout>
        <Frame name={frameTarget} src={getContext().request.url} />
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

function ListsLayout(handle: Handle<{
  activeItem: ListsNavItem
  sidebarEntries: ListSidebarEntry[]
  pagination?: PaginationState
  children?: RemixNode
}>) {
  return () => {
    let { activeItem, sidebarEntries, pagination, children } = handle.props
    return (
          <div mix={shellStyle}>
        <aside mix={sidebarStyle}>
          <div mix={sidebarHeaderStyle}>
            <span mix={headerIconWrapStyle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <line x1="9" y1="12" x2="15" y2="12" />
                <line x1="9" y1="16" x2="13" y2="16" />
              </svg>
            </span>
            <span>Listen</span>
          </div>
          <div mix={headerDividerStyle} />
          <nav mix={navStyle}>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
              Neue Liste
            </NavLink>
            {sidebarEntries.map((entry) => {
              let listId = typeof entry.id === 'string' && entry.id.startsWith('list:')
                ? Number(entry.id.slice(5))
                : null
              let href = listId !== null ? buildListHref(listId, pagination) : routes.lists.index.href()
              let noDescription = !entry.label.trim()
              let displayName = noDescription ? `Liste #${listId}` : entry.label
              return (
                <div key={entry.id} mix={entryRowStyle} data-list-id={listId ?? undefined} data-updated-at={entry.updatedAt ?? undefined}>
                  <NavLink
                    href={href}
                    target={frameTarget}
                    active={activeItem === entry.id}
                    mix={[navLinkStyle, entryNavLinkStyle, tooltipAnchorStyle, activeItem === entry.id && navActiveStyle].filter(Boolean)}
                    dataTooltip={displayName}
                  >
                    <span mix={navIconStyle}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                        <rect x="9" y="3" width="6" height="4" rx="1" />
                        <line x1="9" y1="12" x2="15" y2="12" />
                        <line x1="9" y1="16" x2="13" y2="16" />
                      </svg>
                    </span>
                    <span mix={[noDescription ? descEmptyStyle : undefined, truncateStyle].filter(Boolean)} data-list-name>
                      {displayName}
                    </span>
                    <span mix={countBadgeStyle} aria-label={`${entry.count} Eintr${entry.count !== 1 ? 'äge' : 'ag'}`}>
                      {entry.count}
                    </span>
                  </NavLink>
                  {listId !== null && (
                    <form
                      method="POST"
                      action={routes.lists.destroy.href({ id: listId })}
                      rmx-target={frameTarget}
                      data-confirm={`"${displayName}" löschen?`}
                      mix={deleteFormStyle}
                    >
                      <CsrfTokenInput />
                      <button type="submit" mix={deleteBtnStyle} aria-label={`Liste "${displayName}" löschen`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </form>
                  )}
                </div>
              )
            })}
            <ListNameEdit />
            <ConfirmDelete />
            {sidebarEntries.length === 0 && (
              <p mix={emptyHintStyle}>Keine gespeicherten Listen</p>
            )}
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
        <section mix={contentStyle}>
          <Breadcrumbs
            items={getBreadcrumbs(
              new URL(getContext().request.url).pathname,
            )}
          />
          {children}
        </section>
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
})

const deleteFormStyle = css({
  margin: 0,
  padding: 0,
  flexShrink: 0,
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
  marginTop: theme.space.sm,
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
