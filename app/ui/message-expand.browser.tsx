import { clientEntry, css, type Handle } from 'remix/component'
import { spring } from '@remix-run/ui/animation'
import { prefersReducedMotion } from '../utils/motion.ts'

/**
 * Click-to-expand for the /admin/messages content column.
 *
 * Each message cell renders its full text inside a span that is clamped to two
 * lines purely by CSS (`-webkit-line-clamp`), plus a toggle button
 * (`[data-expand-msg]`). Because the full text is always present in the DOM,
 * expanding only removes the clamp on the sibling span — no server round-trip,
 * no state to reconcile on navigation (a fresh frame render collapses again).
 *
 * A single document-level delegated listener is registered once per page load
 * (module-scoped guard), so it survives frame swaps.
 * After every render a `queueTask` re-scans the cells: it resets each cell to
 * its collapsed default and hides the toggle on messages that already fit
 * within the clamp, so short messages never show a pointless button.
 */
let listenersRegistered = false

function setCollapsed(span: HTMLElement): void {
  span.style.display = ''
  span.style.removeProperty('-webkit-line-clamp')
  span.style.removeProperty('-webkit-box-orient')
  span.style.overflow = ''
  span.setAttribute('data-expanded', 'false')
}

function setExpanded(span: HTMLElement): void {
  span.style.display = 'block'
  span.style.setProperty('-webkit-line-clamp', 'unset')
  span.style.setProperty('-webkit-box-orient', 'unset')
  span.style.overflow = 'visible'
  span.setAttribute('data-expanded', 'true')
}

function syncButton(btn: HTMLButtonElement, expanded: boolean): void {
  btn.setAttribute('aria-expanded', String(expanded))
  btn.textContent = expanded
    ? (btn.getAttribute('data-label-less') ?? 'Weniger')
    : (btn.getAttribute('data-label-more') ?? 'Mehr')
}

// Current height animation per span — cancelled before the next toggle so a
// fast double-toggle retargets instead of stacking animations (guide:
// "Interruptible interactions").
const spanAnimations = new WeakMap<HTMLElement, Animation>()

/**
 * FLIP the clamp toggle's height delta with a spring: measure the span before
 * and after applying the state change, then WAAPI-animate the height from the
 * pre-toggle value. Overflow is hidden while animating so the revealed text
 * doesn't spill past the animating box. (animateLayout() doesn't apply here —
 * the expand toggle is DOM-only state, so no render fires to measure.)
 */
function animateHeightDelta(span: HTMLElement, toggle: () => void): void {
  let before = span.getBoundingClientRect().height
  toggle()
  let target = span.getBoundingClientRect().height
  if (Math.abs(target - before) < 1) return
  spanAnimations.get(span)?.cancel()
  span.style.overflow = 'hidden'
  let animation = span.animate(
    [{ height: `${before.toFixed(1)}px` }, { height: `${target.toFixed(1)}px` }],
    { ...spring('smooth') },
  )
  spanAnimations.set(span, animation)
  animation.finished
    .catch(() => {})
    .finally(() => {
      if (spanAnimations.get(span) === animation) spanAnimations.delete(span)
      span.style.height = ''
      // Expanded state must keep overflow visible (the stylesheet clamps it).
      span.style.overflow = span.getAttribute('data-expanded') === 'true' ? 'visible' : ''
    })
}

function toggleMessage(btn: HTMLButtonElement): void {
  let cell = btn.closest<HTMLElement>('[data-message-cell]')
  let span = cell?.querySelector<HTMLElement>('[data-message-text]')
  if (!cell || !span) return

  let expanded = span.getAttribute('data-expanded') === 'true'
  let apply = () => {
    if (expanded) setCollapsed(span)
    else setExpanded(span)
  }
  // The CSS reduced-motion guard can't stop a WAAPI animation — gate here.
  if (prefersReducedMotion()) apply()
  else animateHeightDelta(span, apply)
  syncButton(btn, !expanded)
}

function onToggleClick(event: Event): void {
  let target = event.target as HTMLElement
  let btn = target.closest<HTMLButtonElement>('button[data-expand-msg]')
  if (!btn) return
  event.preventDefault()
  toggleMessage(btn)
}

/** Post-render sweep: reset cells to the collapsed default and drop the toggle
 *  on messages whose full text already fits inside the two-line clamp. */
function scanCells(): void {
  if (typeof document === 'undefined') return
  document.querySelectorAll<HTMLElement>('[data-message-text]').forEach((span) => {
    let btn = span
      .closest<HTMLElement>('[data-message-cell]')
      ?.querySelector<HTMLButtonElement>('button[data-expand-msg]')
    if (!btn) return

    // An interrupted height animation can leave inline styles behind.
    spanAnimations.get(span)?.cancel()
    spanAnimations.delete(span)
    span.style.overflow = ''
    span.style.height = ''

    setCollapsed(span)
    // scrollHeight measures the full wrapped text; clientHeight is the visible
    // (clamped) box. If they match, there is nothing to reveal, so the toggle
    // stays hidden (its server-rendered default) instead of pestering the user.
    let overflows = span.scrollHeight > span.clientHeight + 1
    btn.style.display = overflows ? 'inline' : 'none'
    if (overflows) syncButton(btn, false)
  })
}

function registerListener(): void {
  if (listenersRegistered || typeof document === 'undefined') return
  listenersRegistered = true
  document.addEventListener('click', onToggleClick, { capture: true })
}

export const MessageExpand = clientEntry(
  import.meta.url + '#MessageExpand',
  function MessageExpand(handle: Handle) {
    return () => {
      registerListener()
      handle.queueTask(scanCells)
      return <div mix={css({ display: 'none' })} />
    }
  },
)
