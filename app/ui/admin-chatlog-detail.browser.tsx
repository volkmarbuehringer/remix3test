import { clientEntry, css, type Handle } from 'remix/ui'

/**
 * Master–detail behaviour for /admin/chatlog.
 *
 * The page always renders the conversation list and a transcript pane. Picking
 * a row loads that thread into the nested `admin-chatlog-detail` frame, so the
 * list — its page, its scroll position, its other entries — never goes away.
 * Before this, the transcript replaced the outer `admin-content` frame and the
 * whole list (plus the page the user was on) was lost on every open.
 *
 * The server render owns the layout contract (`data-chatlog-detail-open` drives
 * the two-column CSS, `?detail=` opens a pane on a fresh document). This entry
 * adds what the server cannot do across frame swap cycles:
 *
 * 1. In-frame transcript loading. Frame navigations come from here rather than
 *    from `data-rmx-target` on the row links, so the pane layout, the history
 *    entry and the focus handling stay in one place. A `data-rmx-target` on the
 *    link would race this: the runtime resolves the target once per click and
 *    falls back to the top frame when the nested frame is not registered yet,
 *    which replaces the list with the transcript again.
 * 2. Persistence across frame reloads. Delete redirects and SSE invalidations
 *    reload the whole admin content frame, which would otherwise collapse an
 *    open transcript. The open thread id — not the URL, which is the list route
 *    — is remembered in sessionStorage and restored on the next render.
 * 3. Focus management. Opening a transcript moves focus into the pane once the
 *    frame settles; dismissing it returns focus to the row that opened it.
 *
 * Progressive enhancement: the row links keep a working `href` to the fragment
 * page, so without JS a transcript still opens (as its own page).
 */

const OPEN_KEY = 'admin-chatlog-detail-open'
const DETAIL_FRAME = 'admin-chatlog-detail'
const PAGE_SELECTOR = '[data-chatlog-page]'
const PANE_SELECTOR = '[data-chatlog-detail-panel]'
const OPEN_SELECTOR = '[data-chatlog-master-detail], ' + PANE_SELECTOR

/** Module-scoped so a re-created entry instance cannot double-register. */
let clickBound = false

/** Module-scoped pane observer; the pane element outlives entry instances. */
let paneObserver: MutationObserver | undefined
let observedPane: HTMLElement | undefined

/** Read the remembered thread id, tolerating disabled/unavailable storage. */
function readOpenId(): string {
  try {
    return sessionStorage.getItem(OPEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function rememberOpenId(id: string): void {
  try {
    if (id) sessionStorage.setItem(OPEN_KEY, id)
    else sessionStorage.removeItem(OPEN_KEY)
  } catch {
    /* storage unavailable */
  }
}

function rowLink(id: string): HTMLAnchorElement | null {
  if (!id) return null
  return document.querySelector<HTMLAnchorElement>(`a[data-chatlog-open="${CSS.escape(id)}"]`)
}

function detailFrame(handle: Handle) {
  return handle.frames.get(DETAIL_FRAME)
}

/** Applies the open/closed layout state. `id === ''` collapses the pane. */
function setOpenState(id: string): void {
  let page = document.querySelector<HTMLElement>(PAGE_SELECTOR)
  if (!page) return

  let row = rowLink(id)
  let open = id !== ''
  page.setAttribute('data-open-id', open ? id : '')

  for (let el of document.querySelectorAll<HTMLElement>(OPEN_SELECTOR)) {
    el.setAttribute('data-chatlog-detail-open', String(open))
  }
  for (let active of document.querySelectorAll('[data-chatlog-row-active]')) {
    active.removeAttribute('data-chatlog-row-active')
  }
  if (open && row) {
    row.closest('tr')?.setAttribute('data-chatlog-row-active', 'true')
  }
}

function collapsePane(returnId: string): void {
  rememberOpenId('')
  setOpenState('')
  rowLink(returnId)?.focus()
}

function focusDetailPane(): void {
  let pane = document.querySelector<HTMLElement>(PANE_SELECTOR)
  if (!pane || pane.getAttribute('data-chatlog-detail-open') !== 'true') return
  pane.focus({ preventScroll: true })
  pane.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

/** Whether the transcript currently rendered in the pane is readable. */
function paneIsMissing(): boolean {
  return (
    document
      .querySelector<HTMLElement>('[data-chatlog-detail="true"]')
      ?.getAttribute('data-chatlog-missing') === 'true'
  )
}

function paneIsOpen(): boolean {
  return (
    document.querySelector<HTMLElement>(PANE_SELECTOR)?.getAttribute('data-chatlog-detail-open') ===
    'true'
  )
}

/** The pane's rendered content — empty until a transcript lands. */
function paneHtml(): string {
  return document.querySelector<HTMLElement>('[data-chatlog-detail="true"]')?.innerHTML ?? ''
}

/**
 * Re-opens the remembered transcript after a frame reload.
 *
 * The server only renders a transcript when the request carried `?detail=`, so
 * after a delete redirect or an SSE invalidate the pane comes back collapsed.
 * The selection is restored here as a frame reload — never a page one.
 *
 * The settle check runs once the reload commits rather than from the mutation
 * observer: a pane already showing the same "not found" fragment (the remembered
 * thread was deleted) produces no DOM mutation at all, so the observer would
 * never fire and the dead transcript would stay open.
 */
async function restoreSelection(handle: Handle): Promise<void> {
  let frame = detailFrame(handle)
  let remembered = readOpenId()

  setOpenState(remembered)
  if (!remembered || !frame) return

  let href = rowLink(remembered)?.getAttribute('href')
  if (!href || href === frame.src) {
    // Already pointed at the remembered thread (a fresh `?detail=` document).
    settleDetailFrame(false)
    return
  }

  frame.src = href
  try {
    await frame.reload()
  } catch {
    /* the pane keeps its previous content on failure */
  }
  settleDetailFrame(true)
}

/**
 * Runs after every transcript load.
 *
 * A thread that no longer exists resolves to the "missing" fragment rather than
 * to a failed request, so the pane marker is the only reliable way to notice it.
 * Dropping the remembered id keeps the next frame reload from re-opening a
 * conversation that is gone.
 */
function settleDetailFrame(contentChanged: boolean): void {
  if (paneIsMissing()) {
    if (paneIsOpen()) collapsePane('')
    return
  }
  if (contentChanged) focusDetailPane()
}

/**
 * Watches the pane for settled frame loads.
 *
 * Listening on the frame handle alone is not enough: the handle resolved at
 * setup can be replaced by the time a transcript lands (the frame re-registers
 * across the hydration that follows a parent frame reload) and then its events
 * never fire. A mutation observer follows the DOM that actually changes.
 */
function watchPaneSettled(): void {
  let pane = document.querySelector<HTMLElement>(PANE_SELECTOR)
  if (!pane) return
  // The pane element is recreated by a parent frame reload. An observer left on
  // the detached old node would silently stop reporting.
  if (paneObserver && observedPane?.isConnected) return
  paneObserver?.disconnect()
  observedPane = pane

  let previousHtml = paneHtml()
  let settleScheduled = false
  paneObserver = new MutationObserver(() => {
    if (settleScheduled) return
    settleScheduled = true
    // Frame content is applied through several mutations; judge the settled DOM.
    queueMicrotask(() => {
      settleScheduled = false
      // The missing/collapse check runs on every batch: a repeated load of the
      // same "not found" fragment produces no DOM change but still has to be
      // noticed. Focus only moves when new content actually landed.
      let changed = paneHtml() !== previousHtml
      previousHtml = paneHtml()
      settleDetailFrame(changed)
    })
  })
  paneObserver.observe(pane, { childList: true, subtree: true, characterData: true })
}

export const AdminChatlogDetail = clientEntry(
  import.meta.url + '#AdminChatlogDetail',
  function AdminChatlogDetail(handle: Handle) {
    handle.queueTask(() => {
      // ── Restore the remembered transcript after a frame reload ──────────
      void restoreSelection(handle)

      // Focus and missing-thread handling run off the pane DOM, which survives
      // the frame handle being replaced across a parent frame reload.
      watchPaneSettled()

      // ── One delegated click listener for the whole page ────────────────
      //
      // Module-scoped so a runtime that re-creates the entry after a frame swap
      // cannot double-register it.
      if (!clickBound && typeof document !== 'undefined') {
        clickBound = true
        document.addEventListener('click', (event) => {
          // A handler closer to the target already dealt with this click.
          if (event.defaultPrevented) return
          let target = event.target as HTMLElement | null

          // Dismiss the transcript without leaving the list.
          let close = target?.closest<HTMLElement>('[data-chatlog-close]')
          if (close) {
            event.stopPropagation()
            collapsePane(close.getAttribute('data-chatlog-return') ?? '')
            return
          }

          let link = target?.closest<HTMLAnchorElement>('a[data-chatlog-open]')
          let id = link?.getAttribute('data-chatlog-open') ?? ''
          if (!link || !id) return

          let current = detailFrame(handle)
          let href = link.getAttribute('href') ?? ''
          if (!current || !href) return

          // Load the transcript into the pane instead of the outer frame.
          event.preventDefault()
          event.stopPropagation()
          current.src = href
          current.reload().catch(() => {
            /* the pane keeps its previous content on failure */
          })
          setOpenState(id)
          rememberOpenId(id)
        })
      }
    })

    return () => <div mix={css({ display: 'none' })} data-chatlog-detail-entry="true" />
  },
)
