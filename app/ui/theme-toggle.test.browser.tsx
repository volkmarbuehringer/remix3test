import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ThemeToggle } from './theme-toggle.browser.tsx'

// ---------------------------------------------------------------------------
// ThemeToggle — dark/light switcher state propagation.
//
// The toggle button is component-owned DOM: the click handler is bound via
// on('click') to the rendered button, so each test can render its own toggle
// and cleanup() removes the listener with it. The entry flips data-theme on
// <html> and mirrors the choice into localStorage (no-flash inline script on
// next load) and a `theme` cookie (the server reads it for the first paint).
//
// The flip runs inside document.startViewTransition when it exists. Tests stub
// that API so both paths are deterministic: the no-VT fallback is synchronous,
// the VT path can record the callback, and reduced motion must bypass it.
// ---------------------------------------------------------------------------

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown
}

let cleanup: (() => void) | null = null
let fixture: HTMLElement | null = null
let restoreViewTransition: (() => void) | null = null
let restoreMatchMedia: (() => void) | null = null

function mountToggle(): HTMLElement {
  let result = render(<ThemeToggle />)
  cleanup = result.cleanup
  let btn = result.$('#theme-toggle') as HTMLElement
  return btn
}

function installViewTransition(impl: ((update: () => void) => unknown) | undefined): void {
  let doc = document as ViewTransitionDocument
  let hadOwn = Object.prototype.hasOwnProperty.call(doc, 'startViewTransition')
  let original = doc.startViewTransition
  Object.defineProperty(doc, 'startViewTransition', {
    configurable: true,
    writable: true,
    value: impl,
  })
  restoreViewTransition = () => {
    if (hadOwn) {
      Object.defineProperty(doc, 'startViewTransition', {
        configurable: true,
        writable: true,
        value: original,
      })
    } else {
      Reflect.deleteProperty(doc, 'startViewTransition')
    }
  }
}

function stubReducedMotion(reduce: boolean): void {
  let original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  restoreMatchMedia = () => {
    window.matchMedia = original
  }
}

function resetThemeState() {
  document.documentElement.removeAttribute('data-theme')
  localStorage.removeItem('theme')
  document.cookie = 'theme=; max-age=0; path=/'
  restoreViewTransition?.()
  restoreViewTransition = null
  restoreMatchMedia?.()
  restoreMatchMedia = null
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
  resetThemeState()
})

describe('ThemeToggle', () => {
  it('switches to dark without VT support: data-theme, localStorage, and cookie updated', () => {
    resetThemeState()
    installViewTransition(undefined)
    let btn = mountToggle()

    btn.click()

    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
    assert.equal(localStorage.getItem('theme'), 'dark')
    assert.ok(document.cookie.includes('theme=dark'), 'cookie carries the choice for SSR')
  })

  it('runs the flip inside startViewTransition when the platform supports it', () => {
    resetThemeState()
    let calls = 0
    let updates: Array<() => void> = []
    installViewTransition((update) => {
      calls++
      updates.push(update)
      return { finished: Promise.resolve() }
    })
    let btn = mountToggle()

    btn.click()

    assert.equal(calls, 1, 'the toggle should start one view transition')
    assert.equal(
      document.documentElement.hasAttribute('data-theme'),
      false,
      'the theme is not flipped before the transition update callback runs',
    )

    updates[0]!()

    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
    assert.equal(localStorage.getItem('theme'), 'dark')
    assert.ok(document.cookie.includes('theme=dark'))
  })

  it('skips the view transition under prefers-reduced-motion', () => {
    resetThemeState()
    stubReducedMotion(true)
    let calls = 0
    installViewTransition(() => {
      calls++
      return { finished: Promise.resolve() }
    })
    let btn = mountToggle()

    btn.click()

    assert.equal(calls, 0, 'reduced motion must not start a view transition')
    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
    assert.equal(localStorage.getItem('theme'), 'dark')
  })

  it('still flips when startViewTransition throws', () => {
    resetThemeState()
    installViewTransition(() => {
      throw new Error('view transition unavailable')
    })
    let btn = mountToggle()

    btn.click()

    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
    assert.equal(localStorage.getItem('theme'), 'dark')
  })

  it('switches back to light: explicit light attribute, storage and cookie say light', () => {
    resetThemeState()
    installViewTransition(undefined)
    document.documentElement.setAttribute('data-theme', 'dark')
    localStorage.setItem('theme', 'dark')
    let btn = mountToggle()

    btn.click()

    assert.equal(document.documentElement.getAttribute('data-theme'), 'light')
    assert.equal(localStorage.getItem('theme'), 'light')
    assert.ok(document.cookie.includes('theme=light'))
  })

  it('toggles on a click that lands on a child of the button (bubbles)', () => {
    resetThemeState()
    installViewTransition(undefined)
    let btn = mountToggle()
    let inner = document.createElement('span')
    btn.appendChild(inner)

    inner.click()

    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
  })

  it('ignores clicks anywhere else', () => {
    resetThemeState()
    installViewTransition(undefined)
    mountToggle()
    let other = document.createElement('button')
    other.textContent = 'anderswo'
    document.body.appendChild(other)
    fixture = other

    other.click()

    assert.equal(document.documentElement.hasAttribute('data-theme'), false)
    assert.equal(localStorage.getItem('theme'), null)
  })

  it('cycles dark → light → dark with repeated clicks', () => {
    resetThemeState()
    installViewTransition(undefined)
    let btn = mountToggle()

    btn.click()
    btn.click()
    btn.click()

    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
    assert.equal(localStorage.getItem('theme'), 'dark')
  })
})
