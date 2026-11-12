import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { css, run, type AppRuntime, type RemixNode } from 'remix/component'
import { renderToString } from 'remix/component/server'
import { render, type RenderResult } from 'remix/component/test'

import { waitForDom } from '../../test/dom.ts'
import { LazyFrame, resetLazyFrameObserverPools } from './lazy-frame.browser.tsx'

// ---------------------------------------------------------------------------
// LazyFrame deferral mechanism (browser suite).
//
// The e2e (app/actions/admin/fragments/lazy-frames.test.e2e.ts) counts real
// network requests to a real frame route. What it cannot isolate is the entry's
// own gating: the Frame must not mount until IntersectionObserver reports the
// host intersecting, must mount exactly once, and a later report must never
// remount or refetch (that is the reopen/scroll retention guarantee). Real IO
// delivery is timing-based, so this test stubs IntersectionObserver and drives
// the callbacks directly — the geometry-stub pattern from the remix3-tooling (§ Testing)
// skill, with result.act() to flush the update the callback schedules.
// ---------------------------------------------------------------------------

type RecordedEntry = { target: Element; isIntersecting: boolean }
type ObserverCallback = (entries: RecordedEntry[], observer: unknown) => void

class FakeIO {
  static instances: FakeIO[] = []

  callback: ObserverCallback
  options: { rootMargin?: string }
  observed: Element[] = []
  unobserved: Element[] = []

  constructor(callback: ObserverCallback, options?: { rootMargin?: string }) {
    this.callback = callback
    this.options = options ?? {}
    FakeIO.instances.push(this)
  }

  observe(el: Element) {
    this.observed.push(el)
  }

  unobserve(el: Element) {
    this.unobserved.push(el)
  }

  disconnect() {}

  /** Deliver one entry the way the browser would. */
  fire(target: Element, isIntersecting: boolean) {
    this.callback([{ target, isIntersecting }], this)
  }
}

const originalIO = window.IntersectionObserver

let root: RenderResult | null = null
let hydrationRuntime: AppRuntime | null = null
let resolveCalls: string[] = []

function installFakeIO() {
  resetLazyFrameObserverPools()
  FakeIO.instances = []
  resolveCalls = []
  window.IntersectionObserver = FakeIO as unknown as typeof IntersectionObserver
}

function renderLazy(
  rootMargin: string,
  options?: { pauseAnimationsWhenInactive?: boolean; children?: RemixNode },
): RenderResult {
  root = render(
    <LazyFrame
      src="/admin/fragments/user-detail/1"
      name="user-detail-1"
      rootMargin={rootMargin}
      {...(options?.pauseAnimationsWhenInactive ? { pauseAnimationsWhenInactive: true } : {})}
      children={options?.children ?? 'Wird später geladen…'}
    />,
    {
      frameInit: {
        src: '/',
        resolveFrame: async (src: string) => {
          resolveCalls.push(src)
          return '<div id="lazy-detail-content">Alice Johnson</div>'
        },
      },
    },
  )
  return root
}

function loadObserver(rootMargin: string): FakeIO {
  let observer = FakeIO.instances.find((instance) => instance.options.rootMargin === rootMargin)
  assert.ok(observer, `expected a load observer for ${rootMargin}`)
  return observer
}

function activityObserver(): FakeIO {
  let observer = FakeIO.instances.find(
    (instance) => instance.options.rootMargin === '0px 0px 0px 0px',
  )
  assert.ok(observer, 'expected the activity observer')
  return observer
}

afterEach(() => {
  root?.cleanup()
  root = null
  hydrationRuntime?.dispose()
  hydrationRuntime = null
  document.body.replaceChildren()
  for (let style of document.head.querySelectorAll('style[data-rmx-style]')) style.remove()
  restoreIO()
})

function restoreIO() {
  window.IntersectionObserver = originalIO
}

/** Install a real server render (markers, styles, and #rmx-data) into the page. */
function installServerHtml(html: string) {
  let parsed = new DOMParser().parseFromString(html, 'text/html')

  // `renderToString` emits a leading <head> without a <body> wrapper. The
  // parser keeps styles in <head> but can place the hydration start marker
  // between head and body, so move every non-style node to body in order.
  for (let node of Array.from(parsed.documentElement.childNodes)) {
    if (node instanceof HTMLHeadElement) {
      for (let child of Array.from(node.childNodes)) {
        if (child instanceof HTMLStyleElement) document.head.append(child)
        else document.body.append(child)
      }
    } else if (node instanceof HTMLBodyElement) {
      document.body.append(...Array.from(node.childNodes))
    } else {
      document.body.append(node)
    }
  }
}

describe('LazyFrame deferral', () => {
  it('renders the placeholder and never resolves the frame while hidden', async () => {
    installFakeIO()
    let result = renderLazy('1px 0px')
    let load = loadObserver('1px 0px')

    // A non-intersecting report (a collapsed <details>, far below the fold) is
    // exactly what the browser delivers for a hidden host.
    let host = load.observed[0]!
    assert.ok(host, 'the entry must observe its host element')
    await result.act(() => load.fire(host, false))

    assert.equal(resolveCalls.length, 0, 'a hidden host must not resolve the frame')
    assert.ok(
      result.container.textContent?.includes('Wird später geladen…'),
      'the placeholder children stay until the host nears the viewport',
    )
  })

  it('mounts the frame exactly on the first intersecting report', async () => {
    installFakeIO()
    let result = renderLazy('2px 0px')
    let load = loadObserver('2px 0px')
    let host = load.observed[0]!

    await result.act(() => load.fire(host, true))
    await waitForDom(() => resolveCalls.length === 1, {
      description: 'the intersecting frame request',
    })
    assert.equal(resolveCalls.length, 1, 'intersecting must mount the Frame and resolve once')
    // Resolution is async (resolveFrame returns a promise); wait for the
    // fragment itself rather than assuming a fixed settle time.
    await waitForDom(() => result.container.querySelector('#lazy-detail-content') !== null, {
      description: 'the resolved fragment',
    })
    assert.equal(resolveCalls[0], '/admin/fragments/user-detail/1')
    assert.ok(
      result.container.querySelector('#lazy-detail-content'),
      'the resolved fragment must land in the host',
    )
    assert.ok(
      !result.container.textContent?.includes('Wird später geladen…'),
      'the placeholder is replaced by the mounted frame',
    )

    // The entry stops observing its host once mounted — this is the retention
    // guarantee: a later reopen/scroll can never refetch.
    assert.ok(load.unobserved.includes(host), 'the host must be unobserved after mounting')
  })

  it('never remounts or refetches on a second intersecting report', async () => {
    installFakeIO()
    let result = renderLazy('5px 0px')
    let load = loadObserver('5px 0px')
    let host = load.observed[0]!

    await result.act(() => load.fire(host, true))
    await waitForDom(() => result.container.querySelector('#lazy-detail-content') !== null, {
      description: 'the mounted lazy frame content',
    })
    assert.equal(resolveCalls.length, 1)

    // Even if a stale/duplicate report reaches the callback, the mounted frame
    // must not be requested again.
    await result.act(() => load.fire(host, true))
    assert.equal(resolveCalls.length, 1, 'a second intersecting report must not refetch')
  })

  it('keeps mounted content when the host goes non-intersecting again', async () => {
    installFakeIO()
    let result = renderLazy('3px 0px')
    let load = loadObserver('3px 0px')
    let host = load.observed[0]!

    await result.act(() => load.fire(host, true))
    await waitForDom(() => result.container.querySelector('#lazy-detail-content') !== null, {
      description: 'the mounted lazy frame content',
    })
    assert.equal(resolveCalls.length, 1)

    await result.act(() => load.fire(host, false)) // e.g. the disclosure closes
    assert.ok(
      result.container.querySelector('#lazy-detail-content'),
      'a mounted frame survives the host going non-intersecting',
    )
    assert.equal(resolveCalls.length, 1, 'hiding must not drop or refetch the frame')
  })

  it('pools one observer per rootMargin and forwards rootMargin', () => {
    installFakeIO()
    renderLazy('4px 0px')
    assert.equal(FakeIO.instances.length, 2, 'load and activity observers are created')
    assert.equal(FakeIO.instances[0]!.options.rootMargin, '4px 0px')
    assert.equal(FakeIO.instances[1]!.options.rootMargin, '0px 0px 0px 0px')

    renderLazy('4px 0px')
    assert.equal(FakeIO.instances.length, 2, 'the same rootMargins reuse the pooled observers')
  })

  it('pauses and resumes descendant animations without unmounting the frame', async () => {
    installFakeIO()
    let result = renderLazy('6px 0px', {
      pauseAnimationsWhenInactive: true,
      children: (
        <div id="animated" mix={css({ animation: 'lazy-pause 1s linear infinite' })}>
          animated
        </div>
      ),
    })

    assert.equal(FakeIO.instances.length, 2, 'load and activity observers are registered')
    let activity = activityObserver()
    let host = activity.observed[0]!
    let animated = result.container.querySelector<HTMLElement>('#animated')
    assert.ok(animated, 'the placeholder child must render')

    // Offscreen/inactive is the initial state, so animations start paused.
    assert.equal(getComputedStyle(animated).animationPlayState, 'paused')

    await result.act(() => activity.fire(host, true))
    assert.equal(
      getComputedStyle(animated).animationPlayState,
      'running',
      'entering the viewport resumes animations',
    )
    assert.equal(resolveCalls.length, 0, 'activity observation must not mount the frame')

    await result.act(() => activity.fire(host, false))
    assert.equal(
      getComputedStyle(animated).animationPlayState,
      'paused',
      'leaving the viewport pauses animations again',
    )
    assert.equal(resolveCalls.length, 0, 'pausing must not refetch or unmount the frame')
  })

  it('hydrates css() mixins in serialized children and fallback props', async () => {
    installFakeIO()

    // Render on the server first: this is the real client-entry boundary where
    // props become JSON, so a css() mixin has to survive serialization rather
    // than being re-created from a live descriptor on the client.
    let html = await renderToString(
      <LazyFrame
        src="/admin/fragments/user-detail/1"
        fallback={
          <div id="styled-fallback" mix={css({ color: 'rgb(10, 20, 30)' })}>
            fallback
          </div>
        }
      >
        <div
          id="styled-placeholder"
          mix={[css({ color: 'rgb(1, 2, 3)' }), css({ fontWeight: 700 })]}
        >
          placeholder
        </div>
      </LazyFrame>,
    )
    installServerHtml(html)

    hydrationRuntime = run({
      loadModule: async () => LazyFrame,
      // Keep the frame request pending so the fallback element stays rendered.
      resolveFrame: () => new Promise<never>(() => {}),
    })
    await hydrationRuntime.ready()
    hydrationRuntime.flush()

    // A pre-#12125 build rejected this with `Invalid mix prop` during hydration.
    let placeholder = document.querySelector<HTMLElement>('#styled-placeholder')
    assert.ok(placeholder, 'the serialized children element must hydrate')
    let placeholderStyle = getComputedStyle(placeholder)
    assert.equal(placeholderStyle.color, 'rgb(1, 2, 3)')
    assert.equal(placeholderStyle.fontWeight, '700')

    let load = loadObserver('320px 0px')
    let host = load.observed[0]!
    load.fire(host, true)
    hydrationRuntime.flush()
    await waitForDom(() => document.querySelector('#styled-fallback') !== null, {
      description: 'the hydrated fallback element',
    })

    let fallback = document.querySelector<HTMLElement>('#styled-fallback')
    assert.ok(fallback, 'the serialized fallback element must hydrate once the frame mounts')
    assert.equal(getComputedStyle(fallback).color, 'rgb(10, 20, 30)')
  })
})
