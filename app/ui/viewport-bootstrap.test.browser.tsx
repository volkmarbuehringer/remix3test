import { afterEach, describe, it, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'

import { viewportBootstrapScript } from './viewport-bootstrap.ts'
import { VIEWPORT_COOKIE } from '../utils/viewport-class.ts'

// The server contract (the `viewport` cookie) is asserted by
// app/utils/viewport-class.test.ts and the page-size e2e; this test covers the
// client half: the inline script mirrors the layout breakpoint into the cookie
// and keeps it in sync when the viewport changes.

let restoreMatchMedia: (() => void) | null = null
let changeListener: ((event: { matches: boolean }) => void) | null = null

/**
 * Replaces `document.cookie` with a recording stub so the test can observe the
 * writes the bootstrap makes (a rewrite of an unchanged value is invisible on
 * the real cookie jar). `t.mock` restores the accessor after the test.
 */
function stubCookie(t: TestContext, initial = ''): string[] {
  let writes: string[] = []
  let jar = initial
  t.mock.getter(Document.prototype, 'cookie', () => jar)
  t.mock.setter(Document.prototype, 'cookie', (value: string) => {
    writes.push(value)
    jar = value
  })
  return writes
}

function stubMatchMedia(matches: boolean, legacyOnly = false): void {
  let original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: (listener: (event: { matches: boolean }) => void) => {
      if (!legacyOnly) throw new Error('the modern stub must not use addListener')
      changeListener = listener
    },
    removeListener: () => {},
    addEventListener: legacyOnly
      ? undefined
      : (_type: string, listener: (event: { matches: boolean }) => void) => {
          changeListener = listener
        },
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  restoreMatchMedia = () => {
    window.matchMedia = original
  }
}

function runBootstrap(): void {
  new Function(viewportBootstrapScript)()
}

afterEach(() => {
  restoreMatchMedia?.()
  restoreMatchMedia = null
  changeListener = null
})

describe('viewport bootstrap', () => {
  it('writes the mobile class when the viewport is below the breakpoint', (t) => {
    stubMatchMedia(true)
    let writes = stubCookie(t)

    runBootstrap()

    assert.equal(writes.length, 1, 'the bootstrap writes the cookie once')
    assert.ok(
      writes[0]!.startsWith(`${VIEWPORT_COOKIE}=mobile;`),
      `expected a mobile cookie, got ${writes[0]}`,
    )
  })

  it('writes the desktop class on a wide viewport', (t) => {
    stubMatchMedia(false)
    let writes = stubCookie(t)

    runBootstrap()

    assert.equal(writes.length, 1)
    assert.ok(
      writes[0]!.startsWith(`${VIEWPORT_COOKIE}=desktop;`),
      `expected a desktop cookie, got ${writes[0]}`,
    )
  })

  it('queries the breakpoint the mobile card layout uses', (t) => {
    let queries: string[] = []
    let original = window.matchMedia
    window.matchMedia = ((query: string) => {
      queries.push(query)
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList
    }) as unknown as typeof window.matchMedia
    restoreMatchMedia = () => {
      window.matchMedia = original
    }
    stubCookie(t)

    runBootstrap()

    assert.deepEqual(queries, ['(max-width: 768px)'])
  })

  it('leaves an unchanged cookie alone', (t) => {
    stubMatchMedia(true)
    let writes = stubCookie(t, `${VIEWPORT_COOKIE}=mobile`)

    runBootstrap()

    assert.equal(writes.length, 0, 'a matching cookie must not be rewritten')
  })

  it('rewrites a stale cookie', (t) => {
    stubMatchMedia(true)
    let writes = stubCookie(t, `${VIEWPORT_COOKIE}=desktop`)

    runBootstrap()

    assert.equal(writes.length, 1)
    assert.ok(writes[0]!.startsWith(`${VIEWPORT_COOKIE}=mobile;`))
  })

  it('follows the viewport when it changes', (t) => {
    stubMatchMedia(true)
    let writes = stubCookie(t)

    runBootstrap()
    assert.ok(changeListener, 'the bootstrap must listen for breakpoint changes')

    changeListener({ matches: false })
    assert.equal(writes.length, 2)
    assert.ok(
      writes[1]!.startsWith(`${VIEWPORT_COOKIE}=desktop;`),
      `expected a desktop cookie, got ${writes[1]}`,
    )
  })

  it('follows the viewport when only legacy listeners are available', (t) => {
    stubMatchMedia(true, true)
    let writes = stubCookie(t)

    runBootstrap()
    assert.ok(changeListener, 'the bootstrap must use the legacy change listener')

    changeListener({ matches: false })
    assert.equal(writes.length, 2)
    assert.ok(writes[1]!.startsWith(`${VIEWPORT_COOKIE}=desktop;`))
  })

  it('does nothing when matchMedia is unavailable', (t) => {
    let original = window.matchMedia
    // @ts-expect-error -- simulate a browser without matchMedia
    window.matchMedia = undefined
    restoreMatchMedia = () => {
      window.matchMedia = original
    }
    let writes = stubCookie(t)

    runBootstrap()

    assert.equal(writes.length, 0)
  })
})
