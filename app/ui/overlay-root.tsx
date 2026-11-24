import { Portal, type Handle, type RemixNode } from 'remix/component'

/** Stable id for the shell-owned overlay destination rendered by `Document`. */
export const APP_OVERLAY_ROOT_ID = 'app-overlay-root'

interface OverlayPortalProps {
  children?: RemixNode
}

/**
 * Resolves the shell overlay destination, or `null` when there is none:
 * during SSR, or in a test document that does not mount the app shell.
 */
export function getAppOverlayRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.getElementById(APP_OVERLAY_ROOT_ID)
}

/**
 * Portals overlay children into the document shell's overlay root.
 *
 * `Portal` is a client-entry feature: it renders nothing during SSR and stays
 * absent unless a client entry hydrates this component. That trade-off is the
 * point — the destination sits after the shell and outside every frame, so
 * transient layers keep a stable DOM/tab order, escape the page scroller's
 * clipping, and stay outside named view-transition regions.
 *
 * Without the shell root (component tests, isolated documents) the children
 * fall back to `document.body`, `Portal`'s own default.
 */
export function OverlayPortal(handle: Handle<OverlayPortalProps>) {
  return () => {
    let container = getAppOverlayRoot()
    let children = handle.props.children
    return container ? (
      <Portal container={container}>{children}</Portal>
    ) : (
      <Portal>{children}</Portal>
    )
  }
}
