import { describe, it, afterEach } from 'remix/test'
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
// ---------------------------------------------------------------------------

let cleanup: (() => void) | null = null
let fixture: HTMLElement | null = null

function mountToggle(): HTMLElement {
  let result = render(<ThemeToggle />)
  cleanup = result.cleanup
  let btn = result.$('#theme-toggle') as HTMLElement
  return btn
}

function resetThemeState() {
  document.documentElement.removeAttribute('data-theme')
  localStorage.removeItem('theme')
  document.cookie = 'theme=; max-age=0; path=/'
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
  resetThemeState()
})

describe('ThemeToggle', () => {
  it('switches to dark: data-theme, localStorage, and cookie all updated', () => {
    resetThemeState()
    let btn = mountToggle()

    btn.click()

    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
    assert.equal(localStorage.getItem('theme'), 'dark')
    assert.ok(document.cookie.includes('theme=dark'), 'cookie carries the choice for SSR')
  })

  it('switches back to light: explicit light attribute, storage and cookie say light', () => {
    resetThemeState()
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
    let btn = mountToggle()
    let inner = document.createElement('span')
    btn.appendChild(inner)

    inner.click()

    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
  })

  it('ignores clicks anywhere else', () => {
    resetThemeState()
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
    let btn = mountToggle()

    btn.click()
    btn.click()
    btn.click()

    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
    assert.equal(localStorage.getItem('theme'), 'dark')
  })
})
