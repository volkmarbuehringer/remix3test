import { prefersReducedMotion } from '../../../utils/motion.ts'

/**
 * Same-document View Transition for in-place list reorders.
 *
 * Only the row positions change, so naming the keyed rows lets the browser
 * animate old→new positions instead of swapping them instantly. The names are
 * applied right before `startViewTransition()` (the old snapshot), re-applied
 * inside the update callback (the new snapshot may contain re-created nodes),
 * and removed when the transition settles — a `view-transition-name` must be
 * unique per document, so it must not linger on unrelated renders.
 *
 * Guards mirror `app/ui/theme-toggle.browser.tsx`: no platform support or a
 * reduced-motion preference runs the state update synchronously with no names.
 * A platform that refuses to start (hidden document, racing transition) also
 * falls back to the instant path, and the update must run exactly once.
 */

type ViewTransitionLike = {
  finished: Promise<void>
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => ViewTransitionLike
}

const NAME_PREFIX = 'list-item-'

// A custom-ident cannot start with a digit and may not contain arbitrary
// punctuation. Item ids are UUIDs or slugs today; the prefix and the sanitizer
// keep a future server-generated id from producing an invalid or colliding name.
function transitionName(id: string): string {
  return `${NAME_PREFIX}${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function rowsOf(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-item-id]'))
}

function applyNames(container: HTMLElement): void {
  for (let row of rowsOf(container)) {
    let id = row.dataset.itemId
    if (id) row.style.setProperty('view-transition-name', transitionName(id))
  }
}

function clearNames(container: HTMLElement): void {
  for (let row of rowsOf(container)) {
    row.style.removeProperty('view-transition-name')
  }
}

// The latest transition owns the names for a container. A rapid second reorder
// skips the previous transition; the stale `finished` handler must not clear
// names that the newer transition set (and still needs for its snapshots).
const currentTransition = new WeakMap<HTMLElement, object>()

export function applyListReorder(
  container: HTMLElement | null,
  apply: () => void | Promise<void>,
): void {
  if (typeof document === 'undefined' || !container) {
    void apply()
    return
  }

  let viewTransitionDocument = document as ViewTransitionDocument
  if (typeof viewTransitionDocument.startViewTransition !== 'function' || prefersReducedMotion()) {
    void apply()
    return
  }

  applyNames(container)
  let applied = false
  let update = async () => {
    applied = true
    await apply()
    // Keyed reconciliation moves the existing nodes, but a re-created row has
    // no inline name yet; the new snapshot is taken after this callback settles.
    applyNames(container)
  }

  let transition: ViewTransitionLike
  try {
    transition = viewTransitionDocument.startViewTransition(update)
  } catch {
    // The platform refused to start before running the callback.
    if (!applied) void apply()
    if (!currentTransition.get(container)) clearNames(container)
    return
  }

  let token = {}
  currentTransition.set(container, token)
  let cleanup = () => {
    if (currentTransition.get(container) !== token) return
    currentTransition.delete(container)
    clearNames(container)
  }
  void transition.finished.then(cleanup, cleanup)
}
