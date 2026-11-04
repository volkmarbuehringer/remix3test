import type { Page } from 'playwright'
import * as assert from 'remix/assert'

/** A `securitypolicyviolation` event reduced to the fields the tests assert on. */
export interface CspViolation {
  /** The directive that was enforced (`script-src-elem`, `style-src-elem`, …). */
  directive: string
  /** The blocked resource URL, or `inline` / `eval` for inline behavior. */
  blockedURI: string
  /** The offending snippet, when the browser provides one. */
  sample: string
}

type CspProbeWindow = Window & { __cspViolations?: CspViolation[] }

export interface CspViolationCollector {
  /** Violations recorded in the current document since its load (or last `clear`). */
  collect(): Promise<CspViolation[]>
  /** Empties the buffer without navigating, for multi-step same-document flows. */
  clear(): Promise<void>
  /** Asserts the current document recorded no violation under `label`. */
  assertNone(label: string): Promise<void>
}

/**
 * Installs a `securitypolicyviolation` listener for every document this page
 * loads. Call it before the first navigation: `addInitScript` runs before page
 * scripts on each new document, so a violation during initial parsing is caught
 * and every navigation starts with a clean buffer.
 *
 * This exists so route-matrix and interaction tests share one definition of
 * "no CSP violations" instead of copy-pasting the init script.
 */
export async function installCspViolationCollector(page: Page): Promise<CspViolationCollector> {
  await page.addInitScript(() => {
    let target = window as unknown as { __cspViolations: unknown[] }
    target.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      target.__cspViolations.push({
        directive: event.effectiveDirective,
        blockedURI: event.blockedURI,
        sample: event.sample,
      })
    })
  })

  async function collect(): Promise<CspViolation[]> {
    return (await page.evaluate(() => {
      let target = window as unknown as { __cspViolations?: unknown }
      return target.__cspViolations ?? []
    })) as CspViolation[]
  }

  async function clear(): Promise<void> {
    await page.evaluate(() => {
      let target = window as unknown as { __cspViolations?: unknown[] }
      target.__cspViolations = []
    })
  }

  async function assertNone(label: string): Promise<void> {
    let violations = await collect()
    assert.equal(
      violations.length,
      0,
      `${label}: expected no CSP violations, got ${JSON.stringify(violations)}`,
    )
  }

  return { collect, clear, assertNone }
}
