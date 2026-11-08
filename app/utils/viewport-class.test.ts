import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  isMobileViewport,
  MOBILE_BREAKPOINT_PX,
  readViewportClass,
  VIEWPORT_COOKIE,
  VIEWPORT_SESSION_KEY,
} from './viewport-class.ts'

describe('readViewportClass', () => {
  it('reads the class the client bootstrap wrote', () => {
    assert.equal(readViewportClass(`${VIEWPORT_COOKIE}=mobile`), 'mobile')
    assert.equal(readViewportClass(`${VIEWPORT_COOKIE}=desktop`), 'desktop')
  })

  it('reads the class out of a full cookie header', () => {
    assert.equal(
      readViewportClass(`session=abc123; ${VIEWPORT_COOKIE}=mobile; theme=dark`),
      'mobile',
      'the viewport cookie must be found among the other cookies',
    )
  })

  it('returns null when the cookie is absent', () => {
    assert.equal(readViewportClass(null), null)
    assert.equal(readViewportClass(undefined), null)
    assert.equal(readViewportClass(''), null)
    assert.equal(readViewportClass('session=abc123'), null)
  })

  it('returns null for a malformed value', () => {
    assert.equal(readViewportClass(`${VIEWPORT_COOKIE}=tablet`), null)
    assert.equal(readViewportClass(`${VIEWPORT_COOKIE}=mobileX`), null)
    assert.equal(readViewportClass(`x${VIEWPORT_COOKIE}=mobile`), null)
  })
})

describe('isMobileViewport', () => {
  it('is true only for the mobile class', () => {
    assert.ok(isMobileViewport('mobile'))
    assert.ok(!isMobileViewport('desktop'))
    assert.ok(!isMobileViewport(undefined))
    assert.ok(!isMobileViewport(null))
  })
})

describe('viewport constants', () => {
  it('keeps the breakpoint on the one the mobile card layout uses', () => {
    // `table.mobileCards` (app/ui/mixins/admin-table.ts) switches to the
    // stacked-card layout at the same width, so "mobile" means the same thing
    // in the cookie and in the stylesheet.
    assert.equal(MOBILE_BREAKPOINT_PX, 768)
  })

  it('names the cookie and the session key separately', () => {
    assert.equal(VIEWPORT_COOKIE, 'viewport')
    assert.equal(VIEWPORT_SESSION_KEY, 'viewportClass')
  })
})
