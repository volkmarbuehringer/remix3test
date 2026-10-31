import { type RemixNode, type Handle, css } from 'remix/component'
import { getContext } from 'remix/middleware/async-context'
import { currentRequestTargetsFrame } from '../utils/frame-target.ts'
import { theme } from '../ui/theme/theme.ts'

import { Layout } from './layout.tsx'
import { FrameShell } from './frame-shell.tsx'
import { NavLink } from './nav-link.tsx'
import { formatRelativeTimeDE } from '../utils/date-utils.ts'
import { routes, frames } from '../routes.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { ConfirmDelete } from '../ui/confirm-delete.browser.tsx'
import { ListNameEdit } from '../actions/lists/public/list-name-edit.tsx'
import { ListsSearch } from '../actions/lists/public/lists-search.tsx'
import { ListsSidebarKeyboard } from '../actions/lists/public/lists-sidebar-keyboard.tsx'
import { ListsRowActions } from '../actions/lists/public/lists-row-actions.tsx'
import { UNTITLED_LIST_LABEL } from '../actions/lists/public/sidebar-sync.ts'
import {
  shellStyle,
  sidebarStyle,
  navStyle,
  navLinkStyle,
  navActiveStyle,
  contentStyle,
  shellResponsiveStyle,
  sidebarToggleStyle,
} from './sidebar-layout.tsx'
import { SidebarToggle } from './layout/sidebar-toggle.browser.tsx'
import { Glyph } from './theme/glyph/glyph.tsx'

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
  /** Total matching lists (not just the current page), when known. */
  total?: number | undefined
}

const frameTarget = frames.listsContent

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

const sidebarFormStyle = css({
  margin: 0,
  marginBottom: theme.space.xs,
})

const searchFormStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.xs,
})

const sidebarControlsRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.xs,
  flexWrap: 'wrap',
  marginTop: theme.space.xs,
})

const sidebarSelectStyle = css({
  flex: '1 1 84px',
  minWidth: 0,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border.default}`,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.xxs,
})

const sidebarResultCountStyle = css({
  flexBasis: '100%',
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
})

const emptyStateStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: theme.space.xs,
  padding: `${theme.space.sm} 0`,
})

const emptyCtaStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '44px',
  padding: `0 ${theme.space.sm}`,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.border.strong}`,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  textDecoration: 'none',
})

const countRingStyle = css({
  width: '14px',
  height: '14px',
  flexShrink: 0,
  borderRadius: theme.radius.full,
  border: `1px solid ${theme.colors.border.default}`,
})

const searchInputStyle = css({
  flex: 1,
  minWidth: 0,
  padding: `${theme.space.xs} ${theme.space.sm}`,
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
})

const searchButtonStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: '28px',
  height: '28px',
  padding: 0,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.sm,
  background: theme.surface.lvl0,
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  '&:hover': {
    background: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
})

function isFrameRequest(): boolean {
  return currentRequestTargetsFrame(frameTarget)
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
    pagination?: PaginationState | undefined
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
    // Blocking: the shell content must be in the initial HTML so a
    // JavaScript-disabled browser sees the list page (see app/ui/frame-shell.tsx).
    return <FrameShell name={frameTarget} blocking />
  }
}

/**
 * The active sidebar search term from the current frame URL. List links and
 * pagination links must carry it forward, otherwise paging out of a filtered
 * result set silently shows unfiltered lists (the admin grid already preserves
 * its filter across pagination).
 */
function currentFilter(): string | null {
  return new URL(getContext().request.url).searchParams.get('filter')
}

function currentSort(): 'recent' | 'name' | 'count' {
  let value = new URL(getContext().request.url).searchParams.get('sort')
  return value === 'name' || value === 'count' ? value : 'recent'
}

function currentSize(): string | null {
  let value = new URL(getContext().request.url).searchParams.get('size')
  if (value === 'all') return 'all'
  if (value && /^[0-9]+$/.test(value)) return value
  return null
}

/** Sidebar view state that must survive search, pagination and list links. */
function appendSidebarParams(params: URLSearchParams) {
  let filter = currentFilter()
  if (filter) params.set('filter', filter)
  let sort = currentSort()
  if (sort !== 'recent') params.set('sort', sort)
  let size = currentSize()
  if (size) params.set('size', size)
}

/**
 * Append the current sidebar state to a form action. POST forms do not pick up
 * the page query automatically, so the copy/delete controllers otherwise see
 * an empty URL and redirect back to an unfiltered first page.
 */
function withSidebarState(href: string): string {
  let params = new URLSearchParams()
  let offset = new URL(getContext().request.url).searchParams.get('offset')
  if (offset) params.set('offset', offset)
  appendSidebarParams(params)
  let query = params.toString()
  if (!query) return href
  return href + (href.includes('?') ? '&' : '?') + query
}

function buildListHref(listId: number, pagination?: PaginationState): string {
  let params = new URLSearchParams()
  params.set('load', String(listId))
  appendSidebarParams(params)
  if (pagination && pagination.offset > 0) {
    params.set('offset', String(pagination.offset))
  }
  return routes.lists.index.href() + '?' + params.toString()
}

function buildPageHref(
  offset: number,
  _pagination: PaginationState,
  activeId: number | null,
): string {
  let params = new URLSearchParams()
  params.set('offset', String(offset))
  let loadParam = new URL(getContext().request.url).searchParams.get('load')
  // Carry the open list across pagination too. A list opened by the default
  // "most recent" rule has no `load` in the URL, so fall back to the active id
  // or paging would reset the editor to the new-list form.
  if (loadParam) {
    params.set('load', loadParam)
  } else if (activeId != null) {
    params.set('load', String(activeId))
  }
  appendSidebarParams(params)
  return routes.lists.index.href() + '?' + params.toString()
}

function ListsLayout(
  handle: Handle<{
    activeItem: ListsNavItem
    sidebarEntries: ListSidebarEntry[]
    pagination?: PaginationState | undefined
    children?: RemixNode
  }>,
) {
  return () => {
    let { activeItem, sidebarEntries, pagination, children } = handle.props
    let activeListId =
      typeof activeItem === 'string' && activeItem.startsWith('list:')
        ? Number(activeItem.slice(5))
        : null
    let filterValue = currentFilter() ?? ''
    let pageLimit = pagination?.limit ?? 15
    let sizeValue = currentSize() ?? (pageLimit >= 100 ? 'all' : String(pageLimit))
    let sizeOptions =
      sizeValue === 'all' || ['15', '30', '50'].includes(sizeValue)
        ? ['15', '30', '50']
        : ['15', '30', '50', sizeValue].toSorted((a, b) => Number(a) - Number(b))
    let resultCount = pagination?.total ?? sidebarEntries.length
    let resultLabel = filterValue
      ? `${resultCount} Treffer`
      : `${resultCount} ${resultCount === 1 ? 'Liste' : 'Listen'}`
    return (
      <div
        mix={[
          shellStyle,
          shellAlignStretchStyle,
          shellFullHeightStyle,
          shellResponsiveStyle,
          listsShellResponsiveStyle,
          listsSidebarColumnsStyle,
        ]}
      >
        <aside
          id="sidebar-shell-nav"
          mix={[
            sidebarStyle,
            compactSidebarStyle,
            sidebarScrollContainerStyle,
            listsSidebarResponsiveStyle,
          ]}
        >
          <nav mix={[navStyle, navScrollStyle]}>
            {/*
              A real GET form (not a JS-driven URL builder): the browser
              serializes `filter` and the hidden `load` id into /lists, so search
              works without JS. The lists frame reloads on submit with JS.
            */}
            <form
              method="get"
              action={routes.lists.index.href()}
              data-rmx-target={frameTarget}
              data-rmx-reset-focus="manual"
              data-lists-search="true"
              mix={sidebarFormStyle}
            >
              <div mix={searchFormStyle}>
                <input
                  id="lists-sidebar-search"
                  type="search"
                  name="filter"
                  defaultValue={filterValue}
                  placeholder="Listen oder Einträge suchen…"
                  aria-label="Listen und Einträge suchen"
                  mix={searchInputStyle}
                />
                {activeListId !== null ? (
                  <input type="hidden" name="load" value={activeListId} />
                ) : null}
                <ListsSearch />
                <button
                  type="submit"
                  aria-label="Listen und Einträge suchen"
                  title="Suchen"
                  mix={searchButtonStyle}
                >
                  <Glyph name="search" width={14} height={14} />
                </button>
              </div>
              <div mix={sidebarControlsRowStyle}>
                <select
                  name="sort"
                  data-lists-sidebar-select
                  defaultValue={currentSort()}
                  aria-label="Listen sortieren"
                  title="Sortierung der Seitenleiste"
                  mix={sidebarSelectStyle}
                >
                  <option value="recent">Zuletzt geändert</option>
                  <option value="name">Name A–Z</option>
                  <option value="count">Meiste Einträge</option>
                </select>
                <select
                  name="size"
                  data-lists-sidebar-select
                  defaultValue={sizeValue}
                  aria-label="Listen pro Seite"
                  title="Anzahl der Listen pro Seite"
                  mix={sidebarSelectStyle}
                >
                  {sizeOptions.map((value) => (
                    <option key={value} value={value}>
                      {value} pro Seite
                    </option>
                  ))}
                  <option value="all">Alle (max. 100)</option>
                </select>
                <span
                  mix={sidebarResultCountStyle}
                  data-sidebar-result-count
                  title={
                    pagination?.total != null
                      ? `${sidebarEntries.length} von ${pagination.total} sichtbar`
                      : undefined
                  }
                >
                  {resultLabel}
                </span>
              </div>
            </form>
            <NavLink
              key="new"
              href={routes.lists.index.href() + '?new=1'}
              target={frameTarget}
              active={activeItem === 'new'}
              mix={[
                navLinkStyle,
                compactNavLinkStyle,
                newListEntryStyle,
                activeItem === 'new' && navActiveStyle,
              ].filter(Boolean)}
            >
              <span mix={newListPlusStyle} aria-hidden="true">
                +
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
              let displayName = noDescription ? UNTITLED_LIST_LABEL : entry.label
              return (
                <div
                  key={entry.id}
                  mix={entryRowStyle}
                  draggable="true"
                  data-list-id={listId ?? undefined}
                  data-list-untitled={noDescription ? '' : undefined}
                  data-updated-at={entry.updatedAt ?? undefined}
                >
                  <NavLink
                    href={href}
                    target={frameTarget}
                    active={activeItem === entry.id}
                    mix={[
                      navLinkStyle,
                      compactNavLinkStyle,
                      entryNavLinkStyle,
                      activeItem === entry.id && navActiveStyle,
                    ].filter(Boolean)}
                    title={displayName}
                  >
                    <span mix={nameColumnStyle}>
                      <span
                        mix={[noDescription ? descEmptyStyle : undefined, truncateStyle].filter(
                          Boolean,
                        )}
                        data-list-name
                      >
                        {displayName}
                      </span>
                      {entry.updatedAt != null && (
                        <span mix={updatedAtStyle} data-list-updated-at>
                          {formatRelativeTimeDE(entry.updatedAt)}
                        </span>
                      )}
                    </span>
                    <span
                      mix={countBadgeStyle}
                      data-list-count
                      title={
                        entry.doneCount != null
                          ? `${entry.doneCount} von ${entry.count} erledigt`
                          : `${entry.count} Eintr${entry.count !== 1 ? 'äge' : 'ag'}`
                      }
                      aria-label={
                        entry.doneCount != null
                          ? `${entry.doneCount} von ${entry.count} erledigt`
                          : `${entry.count} Eintr${entry.count !== 1 ? 'äge' : 'ag'}`
                      }
                    >
                      {entry.doneCount != null && (
                        <span
                          aria-hidden="true"
                          mix={countRingStyle}
                          style={{
                            background: `conic-gradient(${theme.colors.success.background} ${
                              entry.count > 0
                                ? Math.round((entry.doneCount / entry.count) * 100)
                                : 0
                            }%, ${theme.colors.border.default} 0)`,
                          }}
                        />
                      )}
                      {entry.doneCount != null ? `${entry.doneCount}/${entry.count}` : entry.count}
                    </span>
                  </NavLink>
                  {listId !== null && (
                    <>
                      {/*
                        One visible action trigger per row. The old hover
                        cluster overlaid the count badge and clipped the name;
                        the menu is an inline second flex line, so it cannot be
                        clipped by the scrolling <nav> either. The trigger is
                        deliberately always visible (not hover-only): hover is
                        unavailable to touch and keyboard users.
                      */}
                      <button
                        type="button"
                        draggable="false"
                        data-list-menu-button
                        aria-expanded="false"
                        aria-controls={`list-row-menu-${listId}`}
                        aria-label={`Weitere Aktionen für "${displayName}"`}
                        title="Weitere Aktionen"
                        mix={listMenuButtonStyle}
                      >
                        <span aria-hidden="true">⋯</span>
                      </button>
                      <div
                        id={`list-row-menu-${listId}`}
                        data-list-menu
                        role="group"
                        aria-label={`Aktionen für "${displayName}"`}
                        draggable="false"
                        mix={listMenuStyle}
                      >
                        <button
                          type="button"
                          draggable="false"
                          data-list-rename-btn
                          mix={listMenuItemStyle}
                          aria-label={`Liste "${displayName}" umbenennen`}
                        >
                          Umbenennen
                        </button>
                        <button
                          type="button"
                          draggable="false"
                          data-list-copy-here-btn
                          mix={listMenuItemStyle}
                          aria-label={`Elemente der geöffneten Liste in "${displayName}" kopieren`}
                          title="Elemente der geöffneten Liste hierher kopieren"
                        >
                          Elemente hierher kopieren
                        </button>
                        <form
                          method="POST"
                          action={withSidebarState(routes.lists.copy.href({ id: listId }))}
                          data-rmx-target={frameTarget}
                          mix={listMenuFormStyle}
                        >
                          <CsrfTokenInput />
                          <button
                            type="submit"
                            draggable="false"
                            data-list-copy-btn
                            mix={listMenuItemStyle}
                            aria-label={`Liste "${displayName}" duplizieren`}
                          >
                            Duplizieren
                          </button>
                        </form>
                        <form
                          method="POST"
                          action={withSidebarState(routes.lists.destroy.href({ id: listId }))}
                          data-rmx-target={frameTarget}
                          data-confirm={`"${displayName}" löschen?`}
                          mix={listMenuFormStyle}
                        >
                          <CsrfTokenInput />
                          <button
                            type="submit"
                            draggable="false"
                            data-list-delete-btn
                            mix={[listMenuItemStyle, listMenuDeleteStyle]}
                            aria-label={`Liste "${displayName}" löschen`}
                          >
                            Löschen
                          </button>
                        </form>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
            <ListNameEdit />
            <ListsSidebarKeyboard />
            <ListsRowActions />
            {sidebarEntries.length === 0 && (
              <div mix={emptyStateStyle}>
                <p mix={emptyHintStyle}>
                  {filterValue ? 'Keine Treffer' : 'Keine gespeicherten Listen'}
                </p>
                {!filterValue && (
                  <NavLink
                    href={routes.lists.index.href() + '?new=1'}
                    target={frameTarget}
                    mix={emptyCtaStyle}
                    data-lists-empty-cta
                  >
                    + Erste Liste erstellen
                  </NavLink>
                )}
              </div>
            )}
          </nav>
          {/* Kept outside the scrolling <nav> so the controls stay pinned to the
              bottom of the sidebar instead of scrolling out of / clipping at the
              panel edge. */}
          {pagination && sidebarEntries.length > 0 && (
            <div mix={paginationStyle}>
              {pagination.offset > 0 ? (
                <NavLink
                  href={buildPageHref(
                    pagination.offset - pagination.limit,
                    pagination,
                    activeListId,
                  )}
                  target={frameTarget}
                  mix={paginationBtnStyle}
                  aria-label="Vorherige Seite"
                  title="Vorherige Seite"
                >
                  ←
                </NavLink>
              ) : (
                <span mix={paginationBtnDisabledStyle} aria-hidden="true">
                  ←
                </span>
              )}
              <span mix={pageIndicatorStyle}>
                Seite {Math.floor(pagination.offset / pagination.limit) + 1}
              </span>
              {pagination.hasMore ? (
                <NavLink
                  href={buildPageHref(
                    pagination.offset + pagination.limit,
                    pagination,
                    activeListId,
                  )}
                  target={frameTarget}
                  mix={paginationBtnStyle}
                  aria-label="Nächste Seite"
                  title="Nächste Seite"
                >
                  →
                </NavLink>
              ) : (
                <span mix={paginationBtnDisabledStyle} aria-hidden="true">
                  →
                </span>
              )}
            </div>
          )}
        </aside>
        <section mix={contentStyle}>
          <button
            id="sidebar-shell-toggle"
            type="button"
            aria-expanded="false"
            aria-controls="sidebar-shell-nav"
            mix={sidebarToggleStyle}
          >
            <Glyph name="menu" width={16} height={16} /> Listen
          </button>
          {children}
        </section>
        {/*
          The confirm dialog is fixed-position. Mounting it inside the sticky
          sidebar trapped it in that stacking context: after a list-to-list
          drag, the editor section painted above the dialog and swallowed its
          clicks. Keeping it as a direct child of the page grid preserves the
          viewport-wide overlay.
        */}
        <ConfirmDelete />
        <SidebarToggle />
      </div>
    )
  }
}

const countBadgeStyle = css({
  marginLeft: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
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
  // The inline action menu wraps onto its own line inside the row.
  flexWrap: 'wrap',
  alignItems: 'center',
  rowGap: '2px',
  position: 'relative',
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '-2px',
  },
})

/**
 * One 44px action trigger per row, sized for touch. It sits beside the link
 * (not over it), so the row name and count badge stay visible while closed.
 */
const listMenuButtonStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: '44px',
  height: '44px',
  padding: 0,
  border: 'none',
  borderRadius: theme.radius.sm,
  background: 'transparent',
  color: theme.colors.text.secondary,
  cursor: 'pointer',
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.md,
  lineHeight: 1,
  ':hover': {
    background: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
  '&[aria-expanded="true"]': {
    background: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '-2px',
  },
})

/**
 * Inline menu: a second flex line inside the row. Rendering it inline (rather
 * than position: absolute) keeps it out of the sidebar scroller's clip. It is
 * display: none while closed, which also removes its buttons from the tab order.
 */
const listMenuStyle = css({
  flexBasis: '100%',
  display: 'none',
  gridTemplateColumns: '1fr',
  gap: '2px',
  paddingBottom: theme.space.xs,
  '&[data-list-menu-open]': {
    display: 'grid',
  },
})

const listMenuFormStyle = css({
  margin: 0,
  padding: 0,
  display: 'flex',
})

const listMenuItemStyle = css({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  minHeight: '44px',
  padding: `0 ${theme.space.sm}`,
  border: 'none',
  borderRadius: theme.radius.sm,
  background: 'transparent',
  color: theme.colors.text.secondary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  textAlign: 'left',
  cursor: 'pointer',
  ':hover': {
    background: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '-2px',
  },
})

const listMenuDeleteStyle = css({
  color: theme.colors.action.danger.border,
  ':hover': {
    background: theme.colors.action.danger.background,
    color: theme.colors.action.danger.foreground,
  },
})

/**
 * Reclaims the sidebar's horizontal padding so the saved-list rows (name +
 * count badge) get the width instead of empty gutters.
 */
const compactSidebarStyle = css({
  paddingLeft: theme.space.xs,
  paddingRight: theme.space.xs,
})

/**
 * Tighter rhythm than the shared `navLinkStyle` so more saved lists fit in the
 * sidebar before it scrolls and each row has more horizontal room.
 */
const compactNavLinkStyle = css({
  paddingTop: theme.space.xs,
  paddingBottom: theme.space.xs,
  paddingLeft: theme.space.xs,
  paddingRight: theme.space.xs,
})

const entryNavLinkStyle = css({
  flex: 1,
  minWidth: 0,
})

/**
 * The "Neue Liste" entry is an action, not a saved row: a dashed outline, a
 * leading plus and an accent label separate it from the list rows below so it
 * can't be mistaken for one of them.
 */
const newListEntryStyle = css({
  gap: theme.space.xs,
  marginBottom: theme.space.xs,
  border: `1px dashed ${theme.colors.border.strong}`,
  borderRadius: theme.radius.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.focus.ring,
})

const newListPlusStyle = css({
  fontSize: theme.fontSize.md,
  lineHeight: 1,
  fontWeight: theme.fontWeight.bold,
})

const nameColumnStyle = css({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  flex: 1,
})

const updatedAtStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  lineHeight: 1.3,
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
  gap: theme.space.xs,
  padding: `${theme.space.sm} calc(${theme.space.xs} + 3px)`,
  borderTop: `1px solid ${theme.colors.border.default}`,
  // Pin the pagination to the bottom of the full-height sidebar so there is no
  // empty space below it; a short list leaves the free space above it instead.
  marginTop: 'auto',
})

const paginationBtnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
  whiteSpace: 'nowrap',
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
  flexShrink: 0,
  whiteSpace: 'nowrap',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  opacity: 0.5,
})

const pageIndicatorStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  whiteSpace: 'nowrap',
})

/**
 * Phone layout for the /lists shell. The custom full-height grid used to omit
 * any responsive overrides, so on phones the fixed 220px sidebar column left the
 * editor in a ~60px sliver. On <=768px the shell drops the viewport-height
 * constraint and the sidebar becomes a toggleable panel above the editor; the
 * top-level Layout page container already scrolls.
 */
const listsShellResponsiveStyle = css({
  '@media (max-width: 768px)': {
    height: 'auto',
    gridTemplateRows: 'auto',
  },
})

/**
 * /lists is a list-of-lists navigator, so its sidebar needs more room than the
 * shared 220px shell column: the row name is the only thing that identifies a
 * list and it was truncating after ~15 characters. Adaptive, and scoped to
 * desktop so it cannot fight the single-column phone layout.
 */
const listsSidebarColumnsStyle = css({
  '@media (min-width: 769px)': {
    gridTemplateColumns: 'clamp(220px, 24vw, 300px) minmax(0, 1fr)',
  },
})

/** Phone panel for the saved-lists sidebar: hidden until the "Listen" toggle
 *  adds the is-open class (wired by the shared SidebarToggle client entry). */
const listsSidebarResponsiveStyle = css({
  '@media (max-width: 768px)': {
    display: 'none',
    position: 'static',
    maxHeight: '70vh',
    '&.is-open': {
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    },
  },
})
