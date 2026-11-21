import type { Handle } from 'remix/component'

/** Only the frame lookup fields safe navigation needs, so any typed component handle works. */
type NavigationHandle = Pick<Handle, 'frame' | 'frames'>

const CONTAINER_IDS = ['support-agent-frame-container'] as const

function getActiveFrame(_handle: NavigationHandle): string | null {
  for (let id of CONTAINER_IDS) {
    let frame = activeFrameNameOrNull(id)
    if (frame) {
      return frame
    }
  }
  return null
}

/** The frame name a container declares via `data-active-frame`, or null. */
export function activeFrameNameOrNull(containerId: string): string | null {
  return document.getElementById(containerId)?.getAttribute('data-active-frame') ?? null
}

/**
 * The frame name a container declares via `data-active-frame`, falling back to
 * `fallbackName` when the container (or its attribute) is absent — the same
 * resolution the stream clientEntries did inline before this helper existed.
 */
export function activeFrameName(containerId: string, fallbackName: string): string {
  return activeFrameNameOrNull(containerId) ?? fallbackName
}

export function safeNavigate(href: string, handle: NavigationHandle): void {
  let frameName = getActiveFrame(handle)
  // Prefer the named panel a stream container addresses; otherwise navigate the
  // frame this component is actually mounted in. The top frame is excluded: a
  // `reload({ src })` on it replaces the document without updating the browser
  // URL, so standalone pages keep the full-page navigation.
  let frame =
    (frameName ? handle.frames?.get(frameName) : undefined) ??
    (handle.frame && handle.frame !== handle.frames?.top ? handle.frame : undefined)
  if (!frame) {
    window.location.href = href
    return
  }
  // An in-frame reload failure must not drop the navigation (it used to surface
  // as an unhandled rejection): fall back to a full-page load.
  frame.reload({ src: href }).catch(() => {
    window.location.href = href
  })
}
