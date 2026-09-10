import { describe, it, before, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../../test-router.ts'
import { routes } from '../../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test-utils.ts'
import { initializeAppDatabase } from '../../../db.ts'
import { theme } from '../../../ui/theme/theme.ts'

// ---------------------------------------------------------------------------
// /verwaltung/appointments segmented filter groups (period + status).
//
// These groups join vendor `button()` mixin buttons: one themed 1px divider per
// gap, square inner corners, rounded outer edges. The segment styles come from
// `app/ui/mixins/segmented.ts`, which has to win a cascade-layer contest with
// the mixin's own `border` shorthand — see the learned delta
// `remix3-css-override-cascade-layer`. When that override loses, the segments
// silently fall back to the mixin's border: two 1px lines per gap (a doubled
// divider) in the wrong colour.
//
// What these assertions cover: the override is applied in this render — inner
// left borders dropped, dividers on the border token, exactly one 1px line per
// gap, and the token re-resolving in dark mode. What they cannot cover: the
// `!important` that makes that outcome hold for *any* sub-layer registration
// order. Which `rmx.<class>` sub-layer wins depends on render order, so in a
// given render a plain (non-important) override can still win here while losing
// in the app. Treat a green run as "not regressed in this render", not as proof
// that the important is unnecessary.
//
// Read-only: needs the seeded database and a Playwright browser. Runs as
// CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

const BORDER_TOKEN = theme.colors.border.default

/**
 * Runs in the page. Reads the period group's first/middle/last segment, plus the
 * divider token resolved to the same rgb() string the browser computes. Pass
 * `theme` to switch the app theme (via `data-theme`) before reading. The theme
 * tokens already carry their `var(...)` wrapper, so `token` is assigned verbatim.
 */
function readSegmentsInPage(options: { token: string; theme?: string }) {
  if (options.theme) document.documentElement.setAttribute('data-theme', options.theme)

  let middle = [...document.querySelectorAll('button')].find(
    (button) => (button.textContent || '').trim() === 'Diese Woche',
  )
  if (!middle) throw new Error('period group not rendered')
  let group = middle.closest('span')
  if (!group) throw new Error('period group wrapper not found')
  let segments = [...group.querySelectorAll('button')]
  if (segments.length < 3) throw new Error('expected at least three period segments')

  let read = (element: Element | undefined) => {
    if (!element) throw new Error('missing segment')
    let style = getComputedStyle(element)
    return {
      borderLeftWidth: style.borderLeftWidth,
      borderRightWidth: style.borderRightWidth,
      borderRightStyle: style.borderRightStyle,
      borderRightColor: style.borderRightColor,
      radiusTopLeft: style.borderTopLeftRadius,
      radiusTopRight: style.borderTopRightRadius,
    }
  }

  // Resolve the theme token the same way the browser does for a real border.
  let probe = document.createElement('span')
  probe.style.color = options.token
  document.body.appendChild(probe)
  let token = getComputedStyle(probe).color
  probe.remove()

  return {
    token,
    labels: segments.map((button) => (button.textContent || '').trim()),
    first: read(segments[0]),
    middle: read(segments[1]),
    last: read(segments[segments.length - 1]),
    // Border width per gap, summed across the pair that shares it. One 1px line
    // is the goal; a doubled divider adds up to 2px.
    gapWidths: segments.slice(1).map((segment, index) => {
      let right = Number.parseFloat(read(segments[index]).borderRightWidth) || 0
      let left = Number.parseFloat(read(segment).borderLeftWidth) || 0
      return right + left
    }),
  }
}

describe('admin appointments: segmented filter groups', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  async function openAppointments(t: TestContext) {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.verwaltung.appointments.index.href())
    await page.locator('button', { hasText: 'Diese Woche' }).first().waitFor({ timeout: 15_000 })
    return page
  }

  it('draws one themed divider per gap, in both themes', async (t) => {
    let page = await openAppointments(t)
    let group = await page.evaluate(readSegmentsInPage, { token: BORDER_TOKEN })

    assert.deepEqual(group.labels.slice(0, 2), ['Alle', 'Diese Woche'])

    // Middle segment: no left border (the previous segment's right border is
    // the single divider) and a themed right border.
    assert.equal(group.middle.borderLeftWidth, '0px', 'inner left border must be dropped')
    assert.equal(group.middle.borderRightWidth, '1px', 'inner divider must be 1px')
    assert.equal(group.middle.borderRightStyle, 'solid')
    assert.equal(
      group.middle.borderRightColor,
      group.token,
      `divider must use the border token, got ${group.middle.borderRightColor}`,
    )

    // Inner corners square, outer corners rounded.
    assert.equal(group.middle.radiusTopLeft, '0px', 'inner corners must be square')
    assert.equal(group.middle.radiusTopRight, '0px', 'inner corners must be square')
    assert.notEqual(group.first.radiusTopLeft, '0px', 'first segment keeps its rounded left edge')
    assert.notEqual(group.last.radiusTopRight, '0px', 'last segment keeps its rounded right edge')

    // The first segment also draws a themed divider, and the last one drops its
    // inner left border. The active segment is the primary tone, whose own
    // border is `0`, so this is the segment the override used to lose — assert it
    // explicitly instead of relying on the button's own border.
    assert.equal(group.first.borderRightWidth, '1px', 'first segment must draw a 1px divider')
    assert.equal(group.first.borderRightColor, group.token, 'first divider must use the token')
    assert.equal(group.last.borderLeftWidth, '0px', 'last segment must drop its inner left border')

    // Every gap carries exactly one 1px line, not two stacked borders.
    assert.deepEqual(
      group.gapWidths,
      group.gapWidths.map(() => 1),
      `expected a single 1px divider per gap, got ${JSON.stringify(group.gapWidths)}`,
    )

    // The same segments re-resolve their divider against the dark token, so the
    // override is token-driven and not a hardcoded colour.
    let dark = await page.evaluate(readSegmentsInPage, { token: BORDER_TOKEN, theme: 'dark' })

    assert.notEqual(
      dark.token,
      group.token,
      'the border token must change between themes (guard against a hardcoded colour)',
    )
    assert.equal(
      dark.middle.borderRightColor,
      dark.token,
      'dark-mode divider must use the dark border token',
    )
    assert.equal(dark.middle.borderLeftWidth, '0px', 'inner left border must stay dropped in dark')
  })
})
