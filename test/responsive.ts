import type { Page } from 'playwright'
import * as assert from 'remix/assert'

export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const

export interface MobilePageOptions {
  /** Path to load at the mobile viewport. */
  path: string
  /** Selector that proves the page's main content has rendered. */
  ready: string
  /** Selectors that must be visible once the page is ready. */
  landmarks?: string[]
  /** Selectors whose own horizontal scroll width must fit their client width. */
  noHorizontalScroll?: string[]
  /** WCAG 2.2 AA minimum target size for buttons (24 CSS px). */
  minTargetSize?: number
}

export interface MobileLayoutMetrics {
  viewportWidth: number
  documentWidth: number
  scrollerWidth: number
  scrollerClientWidth: number
  clipped: string[]
  smallTargets: string[]
  overflowing: string[]
}

/**
 * Loads a real server-rendered page at a 390×844 viewport and asserts the
 * page-level mobile layout invariants the component browser suite cannot see:
 * no page or `[data-page-scroller]` horizontal overflow, no visible controls
 * outside the viewport, no undersized buttons, and no unexpectedly scrollable
 * grid wrapper.
 */
export async function assertMobilePage(
  page: Page,
  options: MobilePageOptions,
): Promise<MobileLayoutMetrics> {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto(options.path)
  await page.locator(options.ready).first().waitFor({ timeout: 15_000 })

  for (let selector of options.landmarks ?? []) {
    let locator = page.locator(selector).first()
    await locator.waitFor({ timeout: 15_000 })
    assert.ok(await locator.isVisible(), `${options.path}: ${selector} must be visible`)
  }

  let metrics = await page.evaluate(
    (args: { noHorizontalScroll: string[]; minTargetSize: number }) => {
      function isVisible(el: Element): el is HTMLElement {
        let style = getComputedStyle(el)
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          Number(style.opacity) === 0
        ) {
          return false
        }
        let rect = el.getBoundingClientRect()
        return rect.width > 1 && rect.height > 1
      }

      function label(el: Element): string {
        let tag = el.tagName.toLowerCase()
        let id = el.id ? `#${el.id}` : ''
        let name = el.getAttribute('name')
        let aria = el.getAttribute('aria-label')
        let text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
        return (
          tag +
          id +
          (name ? `[name="${name}"]` : '') +
          (aria ? `[aria-label="${aria}"]` : '') +
          (text ? ` "${text}"` : '')
        )
      }

      let viewportWidth = window.innerWidth
      let scroller = document.querySelector<HTMLElement>('[data-page-scroller]')
      let controls = [
        ...document.querySelectorAll(
          'button, input:not([type="hidden"]), select, textarea, a[href]',
        ),
      ].filter(isVisible)

      let clipped = controls
        .filter((el) => {
          let rect = el.getBoundingClientRect()
          return rect.left < -1 || rect.right > viewportWidth + 1
        })
        .map(label)

      let smallTargets = [
        ...document.querySelectorAll(
          'button, input[type="submit"], input[type="reset"], input[type="button"]',
        ),
      ]
        .filter(isVisible)
        .filter((el) => {
          let rect = el.getBoundingClientRect()
          return rect.width < args.minTargetSize || rect.height < args.minTargetSize
        })
        .map(label)

      let overflowing = args.noHorizontalScroll.flatMap((selector) =>
        [...document.querySelectorAll<HTMLElement>(selector)].flatMap((el) => {
          let overflow = el.scrollWidth - el.clientWidth
          return overflow > 1 ? [`${selector} (${label(el)}) overflows by ${overflow}px`] : []
        }),
      )

      return {
        viewportWidth,
        documentWidth: document.documentElement.scrollWidth,
        scrollerWidth: scroller?.scrollWidth ?? 0,
        scrollerClientWidth: scroller?.clientWidth ?? 0,
        clipped,
        smallTargets,
        overflowing,
      }
    },
    {
      noHorizontalScroll: options.noHorizontalScroll ?? [],
      minTargetSize: options.minTargetSize ?? 24,
    },
  )

  assert.ok(
    metrics.documentWidth <= metrics.viewportWidth + 1,
    `${options.path}: document overflows horizontally (${metrics.documentWidth} > ${metrics.viewportWidth})`,
  )
  if (metrics.scrollerWidth > 0) {
    assert.ok(
      metrics.scrollerWidth <= metrics.scrollerClientWidth + 1,
      `${options.path}: page scroller overflows horizontally (${metrics.scrollerWidth} > ${metrics.scrollerClientWidth})`,
    )
  }
  assert.deepEqual(
    metrics.clipped,
    [],
    `${options.path}: controls must stay inside the viewport: ${metrics.clipped.join(', ')}`,
  )
  assert.deepEqual(
    metrics.smallTargets,
    [],
    `${options.path}: buttons must meet the 24px target size: ${metrics.smallTargets.join(', ')}`,
  )
  assert.deepEqual(
    metrics.overflowing,
    [],
    `${options.path}: containers must not scroll horizontally: ${metrics.overflowing.join(', ')}`,
  )

  return metrics
}

/**
 * Asserts that a table has switched to the shared stacked-card mobile layout.
 *
 * The cell assertions are the cascade-layer guard: the card rules live on the
 * wrapper's `@layer rmx.*` sub-layer, which is inserted before the cells' own
 * `table.td`/`table.row` sub-layer, so a contested declaration without
 * `!important` silently loses (guide 04 §"Styling with css and dynamic style
 * values"). A probe measured 8px/12px padding, a 1px cell divider,
 * `white-space: nowrap`, and zebra card backgrounds before the boost.
 */
export async function assertMobileCards(page: Page, tableSelector: string): Promise<void> {
  let styles = await page.locator(tableSelector).evaluate((table) => {
    let root = getComputedStyle(document.documentElement)
    let firstCell = table.querySelector('tbody td') as HTMLElement
    let cellStyles = getComputedStyle(firstCell)
    let rows = [...table.querySelectorAll('tbody tr')] as HTMLElement[]
    return {
      display: getComputedStyle(table).display,
      headDisplay: getComputedStyle(table.querySelector('thead') as HTMLElement).display,
      expectedCellPadding: `${root.getPropertyValue('--rmx-space-xs').trim()} 0px`,
      cell: {
        display: cellStyles.display,
        justifyContent: cellStyles.justifyContent,
        padding: cellStyles.padding,
        borderBottomWidth: cellStyles.borderBottomWidth,
        overflowX: cellStyles.overflowX,
        textOverflow: cellStyles.textOverflow,
        whiteSpace: cellStyles.whiteSpace,
      },
      rowBackgrounds: rows.slice(0, 2).map((row) => getComputedStyle(row).backgroundColor),
    }
  })
  assert.equal(styles.display, 'block', `${tableSelector} must switch to the stacked card layout`)
  assert.equal(styles.headDisplay, 'none', `${tableSelector} must hide its column headers`)
  assert.equal(
    styles.cell.display,
    'flex',
    `${tableSelector} card cells must become label/value rows`,
  )
  assert.equal(
    styles.cell.justifyContent,
    'space-between',
    `${tableSelector} card cells must separate label and value`,
  )
  assert.equal(
    styles.cell.padding,
    styles.expectedCellPadding,
    `${tableSelector} card cells must use the compact padding`,
  )
  assert.equal(
    styles.cell.borderBottomWidth,
    '0px',
    `${tableSelector} card cells must not draw a divider`,
  )
  assert.equal(
    styles.cell.overflowX,
    'visible',
    `${tableSelector} card cells must not clip their text`,
  )
  assert.equal(
    styles.cell.textOverflow,
    'clip',
    `${tableSelector} card cells must not ellipsize their text`,
  )
  assert.equal(styles.cell.whiteSpace, 'normal', `${tableSelector} card cell text must wrap`)
  assert.equal(
    styles.rowBackgrounds.length,
    2,
    `${tableSelector} needs at least two rows for the card background check`,
  )
  assert.equal(
    styles.rowBackgrounds[0],
    styles.rowBackgrounds[1],
    `${tableSelector} cards must not keep the table's zebra background`,
  )
}
