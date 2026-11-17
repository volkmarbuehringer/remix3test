import type { Handle, RemixNode } from 'remix/component'
import { currentFrameTarget, currentRequestIsInlinedFrame } from '../utils/frame-target.ts'

import { FlashBanner } from './flash-banner.tsx'

/**
 * The single fragment-side owner of the one-shot PRG flash.
 *
 * One response must surface a flash exactly once:
 *
 * - a document render renders `<FlashBanner />` from the top-level `Layout`;
 * - a frame render wraps its content in `FlashFragment`, which renders the
 *   compact banner (and nothing on a document response — a POST re-render
 *   embeds this shell in `Layout`, which owns the flash there);
 * - a frame the server renderer inlined into a document is part of that
 *   document, so `FlashBanner` stays silent for it
 *   (`currentRequestIsInlinedFrame()`).
 *
 * Keep every fragment renderer on this component (the PRG destination paths
 * are covered by `app/frame-targets.test.ts`) instead of rendering
 * `<FlashBanner compact />` by hand.
 */
export function FlashFragment(handle: Handle<{ children?: RemixNode }>) {
  return () => {
    let isFrameResponse = currentFrameTarget() != null && !currentRequestIsInlinedFrame()
    return (
      <>
        {isFrameResponse ? <FlashBanner compact /> : null}
        {handle.props.children}
      </>
    )
  }
}
