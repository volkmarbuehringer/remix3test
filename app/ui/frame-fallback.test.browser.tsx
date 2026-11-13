import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { css, Frame } from 'remix/component'
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
  resolveDeferred = undefined
  document.body.replaceChildren()
  for (let style of document.head.querySelectorAll('style[data-rmx-style]')) style.remove()
})

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

/**
 * A deferred frame whose resolver stays pending.
 *
 * `hidden` mirrors the chatlog detail pane (`display: none` until a row is
 * selected) and keeps the runtime's lazy loading from requesting the src. The
 * visible variant is a lazy frame that has started its initial load but never
 * settles, which is the state the retry is meant for.
 */
let resolveDeferred: ((content: string) => void) | undefined

function renderDeferredFrame(retryAfterMs: number, hidden: boolean): RenderResult {
  root = render(
    <div mix={hidden ? css({ display: 'none' }) : undefined}>
      <Frame
        name="deferred-frame"
        src="/deferred"
        loading="lazy"
        fallback={
          <FrameFallback label="Wird geladen…" name="deferred-frame" retryAfterMs={retryAfterMs} />
        }
      />
    </div>,
    {
      frameInit: {
        src: '/',
        resolveFrame: (src: string) => {
          resolveCalls.push(src)
          return new Promise<string>((resolve) => {
            resolveDeferred = resolve
          })
        },
      },
    },
  )
  return root
}

describe('FrameFallback', () => {
  it('shows the loading label before the retry delay', () => {
    let result = renderPendingFrame(200)

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

  it('offers a retry once the frame stays unresolved', async (t) => {
    let result = renderPendingFrame(20)

    await t.waitFor(() =>
      assert.ok(
        result.container.querySelector('button'),
        'the retry button appears after the delay',
      ),
    )
    assert.ok(
      result.container.textContent?.includes('Das dauert länger als erwartet.'),
      'the fallback explains the delay',
    )
    let status = result.container.querySelector('[role="status"]')
    assert.ok(status, 'the delayed message must be announced to assistive tech')
    assert.ok(status!.textContent?.includes('Das dauert länger als erwartet.'))
  })

  it('reloads the frame when the retry is clicked', async (t) => {
    let result = renderPendingFrame(20)
    let retry = await t.waitFor(() => {
      let button = result.container.querySelector<HTMLButtonElement>('button')
      assert.ok(button, 'retry button must be present')
      return button
    })
    let callsBefore = resolveCalls.length

    await result.act(() => retry.click())
    await t.waitFor(() =>
      assert.ok(resolveCalls.length > callsBefore, 'clicking the retry re-resolves the frame'),
    )
    assert.equal(resolveCalls.at(-1), '/slow', 'the retry requests the frame src')
  })

  it('does not offer a retry while a deferred slot is offscreen', async () => {
    // A lazy frame waiting for the viewport has not requested anything, so
    // "taking longer than expected" would be false. The timer starts on
    // intersection instead of at mount.
    let result = renderDeferredFrame(20, true)
    await new Promise((resolve) => setTimeout(resolve, 150))

    assert.equal(resolveCalls.length, 0, 'the hidden lazy frame must not start loading')
    assert.equal(
      result.container.querySelector('button'),
      null,
      'an offscreen fallback must not claim the load is stalled',
    )
    assert.ok(
      result.container.textContent?.includes('Wird geladen…'),
      'the plain loading label stays in place',
    )
  })

  it('reloads a pending lazily-loaded frame through its named handle', async (t) => {
    // Proves the risky half of deferring a *named* frame: the runtime must
    // register the handle before the fallback can retry, or the button silently
    // reloads the containing frame instead of the deferred one.
    let result = renderDeferredFrame(20, false)

    await t.waitFor(() =>
      assert.equal(resolveCalls.length, 1, 'the visible lazy frame starts its initial load'),
    )
    assert.equal(resolveCalls[0], '/deferred')

    let retry = await t.waitFor(() => {
      let button = result.container.querySelector<HTMLButtonElement>('button')
      assert.ok(button, 'retry button must be present once the load is visibly pending')
      return button
    })

    await result.act(() => retry.click())
    await t.waitFor(() =>
      assert.equal(resolveCalls.length, 2, 'the retry reloads the named lazy frame'),
    )
    assert.equal(resolveCalls.at(-1), '/deferred', 'the retry requests the lazy frame src')
    assert.ok(
      resolveCalls.every((src) => src === '/deferred'),
      'the retry must not fall back to the containing frame',
    )

    // The retried load still replaces the fallback through normal reconciliation.
    await result.act(async () => {
      resolveDeferred?.('<p data-deferred-loaded="true">Geladen</p>')
    })
    await t.waitFor(() =>
      assert.ok(
        result.container.querySelector('[data-deferred-loaded="true"]'),
        'the retried lazy frame content must replace the fallback',
      ),
    )
    assert.equal(
      result.container.textContent?.includes('Wird geladen…'),
      false,
      'the fallback is removed once the frame lands',
    )
  })
})
