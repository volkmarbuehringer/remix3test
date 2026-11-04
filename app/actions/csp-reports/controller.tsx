import { createAction } from 'remix/router'

import { system } from '../../routes.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { connectionIp } from '../../utils/request-ip.ts'

/**
 * Browser CSP reports.
 *
 * Browsers POST `application/csp-report` (legacy `report-uri`) or
 * `application/reports+json` (Reporting API) with no CSRF token, so the route is
 * CSRF-exempt (see `skip-csrf.ts`) and unauthenticated. The payload is
 * untrusted: cap the body, trim every string, strip control characters before
 * logging, and never echo anything back.
 *
 * The report-only Trusted Types policy fires on every vendor frame parse
 * (`innerHTML`/`document.write`), so identical sinks are logged at most once per
 * window instead of once per navigation, and a per-IP cap bounds log flooding
 * through the public endpoint.
 */
const MAX_CSP_REPORT_BYTES = 16 * 1024
const MAX_FIELD_LENGTH = 256

const DEDUPE_WINDOW_MS = 5 * 60_000
const DEDUPE_MAX_KEYS = 512

const MAX_REPORTS_PER_MINUTE = 120

const LEGACY_MEDIA_TYPE = 'application/csp-report'
const REPORTING_API_MEDIA_TYPE = 'application/reports+json'

let reportLimiter = createRateLimiter({
  windowMs: 60_000,
  perKey: true,
  maxAttempts: MAX_REPORTS_PER_MINUTE,
})

/** Last log time per distinct sink; bounded and pruned on insert. */
const recentReports = new Map<string, number>()

/** Test hooks: module-level state must be resettable between cases. */
export function resetCspReportState(): void {
  recentReports.clear()
  reportLimiter = createRateLimiter({
    windowMs: 60_000,
    perKey: true,
    maxAttempts: MAX_REPORTS_PER_MINUTE,
  })
}

export interface CspReportFields {
  disposition?: string | undefined
  directive?: string | undefined
  blocked?: string | undefined
  document?: string | undefined
  source?: string | undefined
  line?: number | undefined
  sample?: string | undefined
}

/** Reads the body while enforcing the cap, including chunked requests. */
async function readLimitedBody(request: Request, maxBytes: number): Promise<string | null> {
  let reader = request.body?.getReader()
  if (!reader) return ''

  let chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    let { done, value } = await reader.read()
    if (done) break
    total += value!.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value!)
  }

  let merged = new Uint8Array(total)
  let offset = 0
  for (let chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}

/** Trims untrusted text and removes control characters (log-injection guard). */
function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  let cleaned = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim()
    .slice(0, MAX_FIELD_LENGTH)
  return cleaned || undefined
}

function cleanLine(value: unknown): number | undefined {
  let line = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(line) && line >= 0 ? line : undefined
}

/** Legacy payload: `{ "csp-report": { …kebab-case fields… } }`. */
export function normalizeLegacyReport(body: unknown): CspReportFields[] {
  if (!body || typeof body !== 'object') return []
  let report = (body as { 'csp-report'?: unknown })['csp-report']
  if (!report || typeof report !== 'object') return []
  let r = report as Record<string, unknown>
  return [
    {
      disposition: clean(r.disposition),
      directive: clean(r['effective-directive'] ?? r['violated-directive']),
      blocked: clean(r['blocked-uri']),
      document: clean(r['document-uri']),
      source: clean(r['source-file']),
      line: cleanLine(r['line-number']),
      sample: clean(r['script-sample']),
    },
  ]
}

/** Reporting API payload: an array of `{ type: 'csp-violation', body: { … } }`. */
export function normalizeReportingApiReports(body: unknown): CspReportFields[] {
  if (!Array.isArray(body)) return []
  let reports: CspReportFields[] = []
  for (let entry of body) {
    if (!entry || typeof entry !== 'object') continue
    let { type, body: entryBody } = entry as { type?: unknown; body?: unknown }
    if (type !== 'csp-violation' || !entryBody || typeof entryBody !== 'object') continue
    let r = entryBody as Record<string, unknown>
    reports.push({
      disposition: clean(r.disposition),
      directive: clean(r.effectiveDirective ?? r.violatedDirective),
      blocked: clean(r.blockedURL ?? r.blockedURI),
      document: clean(r.documentURL ?? r.documentURI),
      source: clean(r.sourceFile),
      line: cleanLine(r.lineNumber),
      sample: clean(r.sample),
    })
  }
  return reports
}

/**
 * Whether this sink should be logged now. Identical reports (same directive,
 * blocked URI, source file and sample prefix) are suppressed for a window, so a
 * runtime that violates on every navigation logs once instead of forever.
 */
function shouldLogReport(report: CspReportFields, now: number): boolean {
  let key = [
    report.disposition ?? 'enforce',
    report.directive ?? '',
    report.blocked ?? '',
    report.source ?? '',
    (report.sample ?? '').slice(0, 80),
  ].join('|')

  let last = recentReports.get(key)
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return false

  if (recentReports.size >= DEDUPE_MAX_KEYS) {
    for (let [existingKey, loggedAt] of recentReports) {
      if (now - loggedAt >= DEDUPE_WINDOW_MS) recentReports.delete(existingKey)
    }
    if (recentReports.size >= DEDUPE_MAX_KEYS) recentReports.clear()
  }

  recentReports.set(key, now)
  return true
}

export default createAction(system.cspReports, {
  async handler(context) {
    let contentType = context.request.headers.get('Content-Type')
    let mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase()
    if (mediaType !== LEGACY_MEDIA_TYPE && mediaType !== REPORTING_API_MEDIA_TYPE) {
      return new Response(null, {
        status: 415,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    let text = await readLimitedBody(context.request, MAX_CSP_REPORT_BYTES)
    if (text === null) {
      return new Response(null, { status: 413, headers: { 'Cache-Control': 'no-store' } })
    }

    // Cap report volume per client IP. Over the cap the report is dropped
    // silently (still 204) so a script cannot use the endpoint to flood logs or
    // learn the cap.
    let ip = connectionIp(context.request) || 'unknown'
    if (!reportLimiter.attempt(ip)) {
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return new Response(null, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    let reports =
      mediaType === LEGACY_MEDIA_TYPE
        ? normalizeLegacyReport(parsed)
        : normalizeReportingApiReports(parsed)

    let now = Date.now()
    for (let report of reports) {
      if (!shouldLogReport(report, now)) continue
      context.logger?.(
        JSON.stringify({
          event: 'csp.violation',
          mediaType,
          disposition: report.disposition ?? 'enforce',
          directive: report.directive,
          blocked: report.blocked,
          document: report.document,
          source: report.source,
          line: report.line,
          sample: report.sample,
        }),
      )
    }

    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  },
})
