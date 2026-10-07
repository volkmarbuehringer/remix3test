import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import button from '../../../ui/theme/button.ts'
import { segmentedButton } from '../../../ui/mixins/segmented.ts'
import { DarkTheme, Theme } from '../../../theme.tsx'
import { theme } from '../../../ui/theme/theme.ts'

// ---------------------------------------------------------------------------
// Segmented filter groups (period + status) — the CSS-cascade contract.
//
// These groups join vendor `button()` mixin buttons: one themed 1px divider per
// gap, square inner corners, rounded outer edges. `segmentedButton` has to win a
// cascade-layer contest with the mixin's own non-important `border` shorthand —
// see the learned delta `remix3-css-and-layout`
// (`references/cascade-layer-overrides.md`). When that override loses, the
// segments silently fall back to the mixin's border: two 1px lines per gap (a
// doubled divider) in the wrong colour.
//
// This is a browser test (no server, no DB): it renders the same
// button + segmentedButton mix usage the page uses, plus the light/dark theme
// variables, and asserts the computed styles. What it cannot cover: the
// `!important` that makes the outcome hold for *any* sub-layer registration
// order. Which `rmx.<class>` sub-layer wins depends on render order, so a green
// run is "not regressed in this render", not proof the important is unnecessary.
// ---------------------------------------------------------------------------

const BORDER_TOKEN = theme.colors.border.default

const PERIODS = ['', 'this-week', 'next-week', 'this-month', 'next-month'] as const
const PERIOD_LABELS: Record<string, string> = {
  'this-week': 'Diese Woche',
  'next-week': 'Nächste Woche',
  'this-month': 'Diesen Monat',
  'next-month': 'Nächsten Monat',
}

interface SegmentRead {
  borderLeftWidth: string
  borderRightWidth: string
  borderRightStyle: string
  borderRightColor: string
  radiusTopLeft: string
  radiusTopRight: string
}

/** The period group markup, mirroring admin-appointments-page.tsx. */
function segmentGroup() {
  return (
    <span data-segment-group>
      {PERIODS.map((value, index, all) => {
        let isFirst = index === 0
        let isLast = index === all.length - 1
        let active = value === ''
        return (
          <a href="#">
            <button
              mix={[
                button({ tone: active ? 'primary' : 'secondary' }),
                segmentedButton({ isFirst, isLast }),
              ]}
            >
              {value === '' ? 'Alle' : PERIOD_LABELS[value]}
            </button>
          </a>
        )
      })}
    </span>
  )
}

function readSegments() {
  let group = document.querySelector<HTMLElement>('[data-segment-group]')
  if (!group) throw new Error('segment group not rendered')
  let segments = [...group.querySelectorAll<HTMLButtonElement>('button')]
  if (segments.length < 3) throw new Error('expected at least three segments')

  let read = (element: HTMLButtonElement): SegmentRead => {
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
  probe.style.color = BORDER_TOKEN
  document.body.appendChild(probe)
  let token = getComputedStyle(probe).color
  probe.remove()

  return {
    token,
    labels: segments.map((segment) => (segment.textContent || '').trim()),
    first: read(segments[0]!),
    middle: read(segments[1]!),
    last: read(segments[segments.length - 1]!),
    // Border width per gap, summed across the pair that shares it. One 1px line
    // is the goal; a doubled divider adds up to 2px.
    gapWidths: segments.slice(1).map((segment, index) => {
      let right = Number.parseFloat(read(segments[index]!).borderRightWidth) || 0
      let left = Number.parseFloat(read(segment).borderLeftWidth) || 0
      return right + left
    }),
  }
}

describe('segmented filter groups', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    document.documentElement.removeAttribute('data-theme')
  })

  it('draws one themed divider per gap, in both themes', async () => {
    cleanup = render(
      <div>
        <Theme />
        <DarkTheme />
        {segmentGroup()}
      </div>,
    ).cleanup

    // Let the runtime's style layer settle before reading computed styles.
    await new Promise((resolve) => setTimeout(resolve, 0))

    let group = readSegments()
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
    document.documentElement.setAttribute('data-theme', 'dark')
    let dark = readSegments()

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
