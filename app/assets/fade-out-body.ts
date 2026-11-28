import { spring } from '@remix-run/ui/animation'

import { prefersReducedMotion } from '../utils/motion.ts'

/**
 * Fades the page out before the fatal error card replaces it.
 *
 * The shell's CSS reduced-motion guard cannot stop WAAPI (`element.animate`),
 * so check the media query before starting the fade (guide 07
 * §"Reduced-motion behavior"). Reduced-motion users get the card immediately.
 *
 * `body` is a test seam; the asset entry always fades the real `document.body`.
 */
export async function fadeOutBody(body: HTMLElement = document.body): Promise<void> {
  if (prefersReducedMotion()) {
    body.innerHTML = ''
    return
  }

  let animation = body.animate(
    [
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(10px) scale(0.985)' },
    ],
    { ...spring('snappy') },
  )

  try {
    await animation.finished
  } catch {
    // A canceled fade must not block the caller's fallback UI; clear the body
    // so the fatal card can mount either way.
  }
  body.innerHTML = ''
}
