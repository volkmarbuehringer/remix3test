import { describe, it, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { system } from '../../routes.ts'
import {
  normalizeLegacyReport,
  normalizeReportingApiReports,
  resetCspReportState,
} from './controller.tsx'

const CSP_REPORTS_URL = `https://remix.run${system.cspReports.href()}`

function legacyReport(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    'csp-report': {
      'document-uri': 'https://remix.run/admin/messages',
      'effective-directive': 'script-src-elem',
      'blocked-uri': 'inline',
      disposition: 'enforce',
      'script-sample': 'alert(1)',
      'source-file': 'https://remix.run/admin/messages',
      'line-number': 42,
      ...overrides,
    },
  })
}

function reportingApiReport(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify([
    {
      type: 'csp-violation',
      body: {
        documentURL: 'https://remix.run/admin/messages',
        effectiveDirective: 'style-src-attr',
        blockedURL: 'inline',
        disposition: 'report',
        sample: 'color: red',
        sourceFile: 'https://remix.run/app.js',
        lineNumber: 7,
        ...overrides,
      },
    },
  ])
}

/**
 * The shape the pinned runtime reports for a frame parse: the frame document
 * string assigned to `template.innerHTML` in the served `frame.js`, under the
 * pnpm `.pnpm` directory name. The release tag in that directory name is
 * arbitrary — the matcher keys off the `@remix-run/component` package path, not
 * the pin — so this fixture does not need re-pinning on a bump.
 */
const VENDOR_FRAME_SOURCE =
  'http://127.0.0.1:44100/assets/npm/.pnpm/%40remix-run%2Bcomponent%40https%2B%2B%2Bgithub.com%2Bremix-run%2Bpreviews%2Breleases%2Bdownload%2Bv0.0.20260101-main-00000000%2Bcomponent.tgz/node_modules/%40remix-run/component/dist/runtime/frame.js'

function trustedTypesReport(overrides: Record<string, unknown> = {}): string {
  return legacyReport({
    'effective-directive': 'require-trusted-types-for',
    'blocked-uri': 'trusted-types-sink',
    disposition: 'report',
    'script-sample': 'Element innerHTML|<!DOCTYPE html><head><script data-rmx-im',
    'source-file': VENDOR_FRAME_SOURCE,
    'line-number': 1898,
    ...overrides,
  })
}

describe('POST /csp-reports', () => {
  it('accepts a legacy csp-report', async () => {
    let response = await router.fetch(CSP_REPORTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/csp-report' },
      body: legacyReport(),
    })

    assert.equal(response.status, 204)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
  })

  it('accepts a Reporting API batch', async () => {
    let response = await router.fetch(CSP_REPORTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/reports+json' },
      body: reportingApiReport(),
    })

    assert.equal(response.status, 204)
  })

  it('needs no CSRF token or session', async () => {
    // The requests above already prove it; pin the status explicitly so a future
    // CSRF change fails here instead of silently dropping real violations.
    let response = await router.fetch(CSP_REPORTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/csp-report' },
      body: legacyReport(),
    })
    assert.equal(response.status, 204)
  })

  it('rejects an unsupported content type', async () => {
    let response = await router.fetch(CSP_REPORTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: legacyReport(),
    })
    assert.equal(response.status, 415)
  })

  it('rejects malformed JSON', async () => {
    let response = await router.fetch(CSP_REPORTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/csp-report' },
      body: '{not json',
    })
    assert.equal(response.status, 400)
  })

  it('rejects an oversized body', async () => {
    let response = await router.fetch(CSP_REPORTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/csp-report' },
      body: JSON.stringify({ 'csp-report': { 'script-sample': 'x'.repeat(20 * 1024) } }),
    })
    assert.equal(response.status, 413)
  })

  it('ignores an unrecognized payload shape', async () => {
    let response = await router.fetch(CSP_REPORTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/csp-report' },
      body: JSON.stringify({ hello: 'world' }),
    })
    assert.equal(response.status, 204)
  })
})

describe('CSP report normalization', () => {
  it('maps legacy kebab-case fields', () => {
    let [report] = normalizeLegacyReport(JSON.parse(legacyReport()))
    assert.ok(report)
    assert.equal(report.directive, 'script-src-elem')
    assert.equal(report.blocked, 'inline')
    assert.equal(report.document, 'https://remix.run/admin/messages')
    assert.equal(report.line, 42)
    assert.equal(report.sample, 'alert(1)')
  })

  it('maps Reporting API camelCase fields and skips other report types', () => {
    let reports = normalizeReportingApiReports(
      JSON.parse(
        JSON.stringify([
          JSON.parse(reportingApiReport())[0],
          { type: 'deprecation', body: { id: 'x' } },
        ]),
      ),
    )
    assert.equal(reports.length, 1)
    assert.equal(reports[0]!.directive, 'style-src-attr')
    assert.equal(reports[0]!.line, 7)
  })

  it('strips control characters and caps field length before logging', () => {
    let [report] = normalizeLegacyReport(
      JSON.parse(legacyReport({ 'script-sample': 'line1\nline2\u0000' + 'y'.repeat(1_000) })),
    )
    assert.ok(report)
    assert.ok(!report.sample!.includes('\n'), 'newlines must not reach a log line')
    assert.ok(!report.sample!.includes('\u0000'), 'control characters must be stripped')
    assert.ok(report.sample!.length <= 256, 'field length must be capped')
  })

  it('drops non-string and non-finite fields', () => {
    let [report] = normalizeLegacyReport(
      JSON.parse(legacyReport({ 'line-number': 'not-a-number', 'script-sample': 12 })),
    )
    assert.ok(report)
    assert.equal(report.line, undefined)
    assert.equal(report.sample, undefined)
  })

  it('returns no reports for an unknown payload shape', () => {
    assert.deepEqual(normalizeLegacyReport({ hello: 'world' }), [])
    assert.deepEqual(normalizeReportingApiReports({ hello: 'world' }), [])
  })
})

/**
 * Captures structured CSP log lines written through `console.log`.
 *
 * Mock `console.log` itself instead of `process.stdout.write`: Node's console
 * routes through stdout, but Bun writes to stdout natively, so a stdout spy
 * would silently capture nothing there.
 */
function captureCspLogs(t: TestContext): string[] {
  let lines: string[] = []
  t.mock.method(console, 'log', (...args: unknown[]) => {
    for (let arg of args) {
      if (typeof arg !== 'string') continue
      for (let line of arg.split('\n')) {
        if (line.includes('"event":"csp.violation"')) lines.push(line)
      }
    }
  })
  return lines
}

async function postLegacy(body: string): Promise<Response> {
  return router.fetch(CSP_REPORTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/csp-report' },
    body,
  })
}

describe('CSP report log discipline', () => {
  it('logs an identical sink once per dedupe window', async (t) => {
    resetCspReportState()
    let lines = captureCspLogs(t)

    await postLegacy(legacyReport())
    await postLegacy(legacyReport())

    assert.equal(lines.length, 1, 'a repeated sink must not log on every navigation')

    // A different source file is a different sink and logs separately.
    await postLegacy(legacyReport({ 'source-file': 'https://remix.run/other.js' }))
    assert.equal(lines.length, 2)
  })

  it('caps reports per client IP', async (t) => {
    resetCspReportState()
    let lines = captureCspLogs(t)

    for (let i = 0; i < 125; i++) {
      let response = await postLegacy(legacyReport({ 'script-sample': `unique-${i}` }))
      assert.equal(response.status, 204, 'over-cap reports are dropped silently')
    }

    assert.ok(lines.length <= 120, `expected at most 120 logged reports, got ${lines.length}`)
    assert.ok(lines.length > 0, 'reports under the cap should log')
  })

  it('drops the pinned vendor runtime Trusted Types baseline', async (t) => {
    resetCspReportState()
    let lines = captureCspLogs(t)

    // Both sinks the frame runtime reports: document parse and import map.
    await postLegacy(trustedTypesReport())
    await postLegacy(
      trustedTypesReport({
        'script-sample': 'HTMLScriptElement textContent|{"scopes":{"/assets/app/":{"@remix-run/u',
        'line-number': 2374,
      }),
    )
    // Hoisted installs serve the same package without the pnpm `.pnpm` tail.
    await postLegacy(
      trustedTypesReport({
        'source-file':
          'http://127.0.0.1:44100/assets/npm/@remix-run/component/dist/runtime/frame.js',
      }),
    )

    assert.equal(lines.length, 0, 'the known vendor sinks must not flood the log')
  })

  it('drops the vendor baseline from a Reporting API batch too', async (t) => {
    resetCspReportState()
    let lines = captureCspLogs(t)

    await router.fetch(CSP_REPORTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/reports+json' },
      body: reportingApiReport({
        effectiveDirective: 'require-trusted-types-for',
        blockedURL: 'trusted-types-sink',
        disposition: 'report',
        sourceFile: VENDOR_FRAME_SOURCE,
        sample: 'Element innerHTML|<!DOCTYPE html>',
      }),
    })

    assert.equal(lines.length, 0)
  })

  it('still logs app-owned Trusted Types sinks', async (t) => {
    resetCspReportState()
    let lines = captureCspLogs(t)

    await postLegacy(
      trustedTypesReport({
        'source-file': 'http://127.0.0.1:44100/assets/app/assets/frame-asset-prefetch.browser.js',
        'script-sample': 'Element innerHTML|<frame fragment>',
      }),
    )

    assert.equal(lines.length, 1, 'only the fixed vendor baseline is suppressed')
  })

  it('still logs non-Trusted-Types violations from the vendor runtime', async (t) => {
    resetCspReportState()
    let lines = captureCspLogs(t)

    await postLegacy(
      trustedTypesReport({
        'effective-directive': 'script-src-elem',
        'script-sample': 'alert(1)',
      }),
    )

    assert.equal(lines.length, 1)
  })

  it('still logs a vendor Trusted Types sink once enforcement is on', async (t) => {
    resetCspReportState()
    let lines = captureCspLogs(t)

    await postLegacy(trustedTypesReport({ disposition: 'enforce' }))

    assert.equal(lines.length, 1, 'an enforced violation would break rendering')
  })
})
