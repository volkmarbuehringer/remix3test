import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { themeBootstrapScript } from './theme-bootstrap.ts'

let restoreMatchMedia: (() => void) | null = null

function stubMatchMedia(matches: boolean): void {
  let original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches,
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

function resetThemeState(): void {
  document.documentElement.removeAttribute('data-theme')
  localStorage.removeItem('theme')
  document.cookie = 'theme=; max-age=0; path=/'
  restoreMatchMedia?.()
  restoreMatchMedia = null
}

function runBootstrap(): void {
  new Function(themeBootstrapScript)()
}

afterEach(resetThemeState)

describe('theme bootstrap', () => {
  it('applies explicit dark from localStorage even when the OS prefers light', () => {
    stubMatchMedia(false)
    localStorage.setItem('theme', 'dark')
    runBootstrap()
    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
  })

  it('applies explicit light from localStorage even when the OS prefers dark', () => {
    stubMatchMedia(true)
    localStorage.setItem('theme', 'light')
    runBootstrap()
    assert.equal(document.documentElement.getAttribute('data-theme'), 'light')
  })

  it('falls back to the cookie when localStorage has no valid theme', () => {
    stubMatchMedia(true)
    localStorage.setItem('theme', 'auto')
    document.cookie = 'theme=light; path=/'
    runBootstrap()
    assert.equal(document.documentElement.getAttribute('data-theme'), 'light')
  })

  it('follows a dark OS preference when no explicit choice exists', () => {
    stubMatchMedia(true)
    runBootstrap()
    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark')
  })

  it('stays attribute-free when the OS prefers light and no explicit choice exists', () => {
    stubMatchMedia(false)
    runBootstrap()
    assert.equal(document.documentElement.hasAttribute('data-theme'), false)
  })
})
