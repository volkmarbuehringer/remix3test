import type { FrameCommit, ResolveFrameOptions } from 'remix/component'

import { frames, routes } from '../routes.ts'
import {
  ADMIN_LISTS_TRANSITION_NAME,
  ADMIN_LISTS_TRANSITION_SELECTOR,
} from '../utils/frame-transition.ts'
import { prefersReducedMotion } from '../utils/motion.ts'

/**
 * Same-document View Transition around one admin lists frame commit.
 *
 * The admin lists grid and its edit/create panel are separate server renders of the
 * same route; a row click (or closing the panel) navigates the `admin-content` frame
 * with a URL whose `editing`/`creating` parameter toggles. That is the one flow worth
 * a transition: a page swap of the content region, not a hover warm, pagination,
 * filter, reload, or a form save (the URL's panel parameter does not change there).
 *
 * The runtime's commit hook (`defaultResolveFrame(..., { commit })`, remix #12249)
 * wraps rendering, so the snapshot pairs are taken from the old and new frame DOM.
 * `commitFrame()` is started at the top of `startViewTransition`'s update callback and
 * awaited so the new snapshot sees the rendered fragment; navigation itself never
 * waits for `finished` (the runtime only races the commit start).
 *
 * Only the marked region animates. The root snapshots are suppressed by a rule gated
 * on `html[data-frame-transition]` (`app/ui/document.tsx`), so the unchanged shell
 * (header, sidebar, page title outside the region) keeps painting instead of
 * cross-fading the whole viewport.
 */

type ViewTransitionLike = {
  ready: Promise<void>
  finished: Promise<void>
  skipTransition(): void
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => ViewTransitionLike
}

const ADMIN_LISTS_PATH = routes.admin.lists.index.href()

/** True when this frame update swaps the admin lists grid ⇄ edit/create panel. */
export function shouldAnimateAdminListsPanel(
  options: Pick<ResolveFrameOptions, 'target' | 'transition'> | undefined,
  to: string,
): boolean {
  let transition = options?.transition
  if (!transition) return false
  if (transition.navigationType === 'reload') return false
  if (options?.target !== frames.adminContent) return false

  let from = transition.from?.url
  if (!from) return false
  if (!isAdminListsUrl(from) || !isAdminListsUrl(to)) return false

  return opensPanel(from) !== opensPanel(to)
}

/**
 * Builds the commit override for a frame navigation. Returns undefined for loads that
 * cannot animate (independent reloads, other frame targets), so the runtime keeps its
 * default commit and the response stays untouched.
 */
export function createAdminListsPanelCommit(
  options?: ResolveFrameOptions,
): FrameCommit | undefined {
  if (options?.target !== frames.adminContent) return undefined
  if (!options.transition || options.transition.navigationType === 'reload') return undefined

  return async (commitFrame, { to, signal }) => {
    if (!shouldAnimateAdminListsPanel(options, to)) {
      await commitFrame()
      return
    }
    await commitFrameWithViewTransition(commitFrame, signal)
  }
}

/**
 * Runs the frame commit inside a scoped same-document transition.
 *
 * Falls back to a plain commit on every platform guard (no API, reduced motion,
 * aborted update, missing/ambiguous region) and when the platform refuses to start.
 * The commit runs exactly once in each path.
 */
export async function commitFrameWithViewTransition(
  commitFrame: () => Promise<void>,
  signal: AbortSignal,
): Promise<void> {
  let viewTransitionDocument = document as ViewTransitionDocument

  if (
    typeof viewTransitionDocument.startViewTransition !== 'function' ||
    prefersReducedMotion() ||
    signal.aborted ||
    !nameRegion()
  ) {
    await commitFrame()
    return
  }

  let token = {}
  activeTransition = token
  document.documentElement.setAttribute('data-frame-transition', '')

  let started = false
  let transition: ViewTransitionLike
  try {
    transition = viewTransitionDocument.startViewTransition(async () => {
      started = true
      await commitFrame()
      // A new snapshot may contain re-created nodes (the panel replaces the grid
      // root), so the name has to be re-applied before the new capture.
      if (!signal.aborted) nameRegion()
    })
  } catch {
    // The platform refused to start before running the update callback (hidden
    // document, racing transition). Undo the names and commit normally.
    clearTransitionState(token)
    if (!started) await commitFrame()
    return
  }

  let skip = () => transition.skipTransition()
  signal.addEventListener('abort', skip, { once: true })
  // `ready` rejects when the transition is skipped; observe it so a superseded
  // navigation cannot surface as an unhandled rejection.
  void transition.ready.catch(() => {})

  try {
    await transition.finished
  } finally {
    signal.removeEventListener('abort', skip)
    clearTransitionState(token)
  }
}

function isAdminListsUrl(value: string): boolean {
  try {
    let url = new URL(value, window.location.href)
    return url.origin === window.location.origin && url.pathname === ADMIN_LISTS_PATH
  } catch {
    return false
  }
}

function opensPanel(value: string): boolean {
  let url = new URL(value, window.location.href)
  return url.searchParams.has('editing') || url.searchParams.has('creating')
}

/**
 * Names the single marked region for the old capture. Returns false when the region is
 * missing or ambiguous (`view-transition-name` must be unique per document).
 */
function nameRegion(): boolean {
  let regions = document.querySelectorAll<HTMLElement>(ADMIN_LISTS_TRANSITION_SELECTOR)
  if (regions.length !== 1) return false
  regions[0]!.style.setProperty('view-transition-name', ADMIN_LISTS_TRANSITION_NAME)
  return true
}

// The newest transition owns the region name. A rapid second navigation skips the
// previous transition; its `finished` handler must not clear the newer transition's
// name while that one still needs it for its snapshots.
let activeTransition: object | undefined

function clearTransitionState(token: object): void {
  if (activeTransition !== token) return
  activeTransition = undefined
  for (let region of document.querySelectorAll<HTMLElement>(ADMIN_LISTS_TRANSITION_SELECTOR)) {
    region.style.removeProperty('view-transition-name')
  }
  document.documentElement.removeAttribute('data-frame-transition')
}
