import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ThemeToggle } from './theme-toggle.browser.tsx'

// ---------------------------------------------------------------------------
// ThemeToggle — dark/light switcher state propagation.
//
// The entry flips data-theme on <html> and mirrors the choice into
// localStorage (no-flash inline script on next load) and a `theme` cookie (the
// server reads it for the first paint). Its document click listener is
// registered WITHOUT a signal — it survives cleanup() and would accumulate a
// toggle per render — so this file renders the entry exactly once and reuses
// that live listener across tests.
// ---------------------------------------------------------------------------

let fixture: HTMLElement | null = null

function mountButton(): HTMLElement {
  let host = document.createElement('div')
  host.innerHTML = `
    <button id="theme-toggle" type="button" aria-label="Design umschalten">
      <span id="glyph-inner">moon</span>
    </button>
  `
  document.body.appendChild(host)
  fixture = host
  return host.querySelector('#theme-toggle') as HTMLElement
}

function resetThemeState() {
  document.documentElement.removeAttribute('data-theme')
  localStorage.removeItem('theme')
  document.cookie = 'theme=; max-age=0; path=/'
}

afterEach(() => {
  fixture?.remove()
  fixture = null
  resetThemeState()
})

describe('ThemeToggle', () => {
  before(() => {
    // One entry render for the whole suite; its listener stays attached.
    render(<ThemeToggle />)
  })

  it('switches to dark: data-theme, localStorage, and cookie all updated', () => {
    resetThemeState()
    let btn = mountButton()

    btn.click()

    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
    assert.equal(localStorage.getItem('theme'), 'dark')
    assert.ok(document.cookie.includes('theme=dark'), 'cookie carries the choice for SSR')
  })

  it('switches back to light: attribute removed, storage and cookie say light', () => {
    resetThemeState()
    document.documentElement.setAttribute('data-theme', 'dark')
    localStorage.setItem('theme', 'dark')
    let btn = mountButton()

    btn.click()

    assert.equal(document.documentElement.hasAttribute('data-theme'), false)
    assert.equal(localStorage.getItem('theme'), 'light')
    assert.ok(document.cookie.includes('theme=light'))
  })

  it('toggles on a click that lands on a child of the button (closest)', () => {
    resetThemeState()
    let host = mountButton()
    let inner = host.querySelector('#glyph-inner') as HTMLElement

    inner.click()

    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
  })

  it('ignores clicks anywhere else', () => {
    resetThemeState()
    mountButton()
    let other = document.createElement('button')
    other.textContent = 'anderswo'
    document.body.appendChild(other)

    other.click()
    other.remove()

    assert.equal(document.documentElement.hasAttribute('data-theme'), false)
    assert.equal(localStorage.getItem('theme'), null)
  })

  it('cycles dark → light → dark with repeated clicks', () => {
    resetThemeState()
    let btn = mountButton()

    btn.click()
    btn.click()
    btn.click()

    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
    assert.equal(localStorage.getItem('theme'), 'dark')
  })
})
