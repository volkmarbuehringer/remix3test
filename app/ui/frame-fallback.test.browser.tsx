import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { Frame } from 'remix/component'
import { render, type RenderResult } from 'remix/component/test'

import { FrameFallback } from './frame-fallback.browser.tsx'

// ---------------------------------------------------------------------------
// FrameFallback — the retry affordance for a deferred frame that never lands.
//
// The server renderer keeps the fallback in place when a pending frame fails
// after its first chunk (it can only report through onError). A static
// "loading…" label would then be permanent, so the fallback offers a retry
// after a delay. These tests drive that timer and the reload call.
// ---------------------------------------------------------------------------

let root: RenderResult | null = null
let resolveCalls: string[] = []

afterEach(() => {
  root?.cleanup()
  root = null
  resolveCalls = []
  document.body.replaceChildren()
  for (let style of document.head.querySelectorAll('style[data-rmx-style]')) style.remove()
})

async function settle(ms = 30) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function renderPendingFrame(retryAfterMs: number): RenderResult {
  root = render(
    <Frame
      name="slow-frame"
      src="/slow"
      fallback={
        <FrameFallback label="Wird geladen…" name="slow-frame" retryAfterMs={retryAfterMs} />
      }
    />,
    {
      frameInit: {
        src: '/',
        resolveFrame: (src: string) => {
          resolveCalls.push(src)
          return new Promise<never>(() => {})
        },
      },
    },
  )
  return root
}

describe('FrameFallback', () => {
  it('shows the loading label before the retry delay', async () => {
    let result = renderPendingFrame(200)
    await settle(20)

    assert.ok(
      result.container.textContent?.includes('Wird geladen…'),
      'the loading label renders immediately',
    )
    assert.equal(
      result.container.querySelector('button'),
      null,
      'no retry button while the frame is still plausibly loading',
    )
  })

  it('offers a retry once the frame stays unresolved', async () => {
    let result = renderPendingFrame(20)
    await settle(40)
    await result.act(() => {})

    let button = result.container.querySelector('button')
    assert.ok(button, 'the retry button appears after the delay')
    assert.ok(
      result.container.textContent?.includes('Das dauert länger als erwartet.'),
      'the fallback explains the delay',
    )
  })

  it('reloads the frame when the retry is clicked', async () => {
    let result = renderPendingFrame(20)
    await settle(40)
    await result.act(() => {})
    let callsBefore = resolveCalls.length

    let button = result.container.querySelector<HTMLButtonElement>('button')
    assert.ok(button, 'retry button must be present')
    await result.act(() => button!.click())
    await settle(20)

    assert.ok(resolveCalls.length > callsBefore, 'clicking the retry re-resolves the frame')
    assert.equal(resolveCalls.at(-1), '/slow', 'the retry requests the frame src')
  })
})
