import * as path from 'node:path'

import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { FileSystemConfigLoader, HtmlValidate } from 'html-validate'

import { db, initializeAppDatabase } from './db.ts'
import { router } from './test-router.ts'
import { createAuthCookieWithCsrfForUser } from './test-utils.ts'

/**
 * HTML content-model conformance over the real server-rendered responses.
 *
 * The repo-local oxlint rule `remix-a11y/no-nested-interactive`
 * (scripts/oxlint-plugins/no-nested-interactive-plugin.ts) only sees literal JSX
 * trees in app source. Interactive content composed through a component prop
 * (`<a>{children}</a>`) or emitted from a raw `remix/html-template` string
 * bypasses the AST rule. Parsing and validating the actual response HTML with
 * html-validate closes that gap (bug class: 553bbc4, 0bd7076).
 *
 * `.htmlvalidate.json` sets `"extends": []` so this check runs exactly one rule,
 * `element-permitted-content`. The html-validate presets are intentionally not
 * enabled here: every message from a broader preset would need individual
 * triage, which is out of scope for this additive check.
 */

const BASE = 'https://remix.run'

// The async filesystem loader is what reads the committed `.htmlvalidate.json`;
// the implicit config of `new HtmlValidate()` is the built-in recommended preset.
const htmlvalidate = new HtmlValidate(new FileSystemConfigLoader())

// A path under the repo root anchors config discovery independently of the
// runner's working directory. The files need not exist on disk.
const CONFIG_ANCHOR = path.resolve(import.meta.dirname, '..', 'rendered')

type Role = 'admin' | 'user'

/**
 * A rendered page to validate. `editingTable` names the table whose lowest id is
 * used for the `?editing=<id>` panel state; that case is skipped when the table
 * is empty (the seed has e.g. no lists or appointments).
 */
interface PageCase {
  path: string
  role: Role
  creating?: boolean
  editingTable?: string
}

const PAGE_CASES: PageCase[] = [
  // ── Verwaltung panels (admin) ────────────────────────────────────────────
  { path: '/verwaltung/appointments', role: 'admin' },
  { path: '/verwaltung/appointments', role: 'admin', creating: true },
  { path: '/verwaltung/appointments', role: 'admin', editingTable: 'appointments' },
  { path: '/verwaltung/offerings', role: 'admin' },
  { path: '/verwaltung/offerings', role: 'admin', creating: true },
  { path: '/verwaltung/offerings', role: 'admin', editingTable: 'appointoffering' },
  { path: '/verwaltung/resources', role: 'admin' },
  { path: '/verwaltung/resources', role: 'admin', creating: true },
  { path: '/verwaltung/resources', role: 'admin', editingTable: 'resources' },
  { path: '/verwaltung/offering-configs', role: 'admin' },
  { path: '/verwaltung/offering-configs', role: 'admin', creating: true },
  { path: '/verwaltung/offering-configs', role: 'admin', editingTable: 'offering_configs' },

  // ── Admin pages (admin) ──────────────────────────────────────────────────
  { path: '/admin', role: 'admin' },
  { path: '/admin/users', role: 'admin' },
  { path: '/admin/users', role: 'admin', creating: true },
  { path: '/admin/users', role: 'admin', editingTable: 'users' },
  { path: '/admin/clients', role: 'admin' },
  { path: '/admin/clients', role: 'admin', creating: true },
  { path: '/admin/clients', role: 'admin', editingTable: 'clients' },
  { path: '/admin/lists', role: 'admin' },
  { path: '/admin/lists', role: 'admin', creating: true },
  { path: '/admin/lists', role: 'admin', editingTable: 'lists' },
  { path: '/admin/messages', role: 'admin' },
  { path: '/admin/chatlog', role: 'admin' },
  { path: '/admin/uploads', role: 'admin' },
  { path: '/admin/webhook-requests', role: 'admin' },
  { path: '/admin/webhook-requests', role: 'admin', editingTable: 'webhook_requests' },
  { path: '/admin/agent-events', role: 'admin' },
  { path: '/admin/support-agent', role: 'admin' },

  // ── Authenticated user pages ─────────────────────────────────────────────
  { path: '/appointments/new', role: 'user' },
  { path: '/settings', role: 'user' },
]

describe('HTML content-model conformance', () => {
  let cookies: Record<Role, string> = { admin: '', user: '' }
  let editingIds: Record<string, string> = {}

  before(async () => {
    await initializeAppDatabase()

    let admin = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    let user = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!admin || !user) {
      throw new Error('seed users admin@newapp.com / user@newapp.com are required')
    }
    cookies = { admin: admin.cookie, user: user.cookie }

    // The table names below are the literal values enumerated in PAGE_CASES,
    // never request input, so interpolating them is safe.
    let editingTables = new Set(
      PAGE_CASES.flatMap((page) => (page.editingTable ? [page.editingTable] : [])),
    )
    for (let table of editingTables) {
      let result = await db.exec(`SELECT id FROM ${table} ORDER BY id LIMIT 1`)
      let rows = (result.rows ?? []) as { id: number | string | null }[]
      let id = rows[0]?.id
      if (id !== null && id !== undefined) {
        editingIds[table] = String(id)
      }
    }
  })

  it('catches nested interactive content in a raw HTML string', async () => {
    let report = await htmlvalidate.validateString(
      '<a href="#"><button>x</button></a>',
      path.join(CONFIG_ANCHOR, 'nested-interactive.html'),
    )
    let ruleIds = report.results.flatMap((result) =>
      result.messages.map((message) => message.ruleId),
    )
    assert.equal(report.valid, false, 'known-bad <a><button> must be reported invalid')
    assert.ok(
      ruleIds.includes('element-permitted-content'),
      `expected element-permitted-content, got: ${ruleIds.join(', ') || '(none)'}`,
    )
  })

  it('validates every curated full-document page', async () => {
    let failures: string[] = []

    for (let page of PAGE_CASES) {
      let url = page.path
      if (page.creating) {
        url += '?creating=true'
      } else if (page.editingTable) {
        let id = editingIds[page.editingTable]
        if (id === undefined) continue
        url += `?editing=${id}`
      }

      let response = await router.fetch(`${BASE}${url}`, {
        headers: { Cookie: cookies[page.role] },
      })
      if (response.status !== 200) {
        failures.push(`${url}: expected 200, got ${response.status}`)
        continue
      }

      let html = await response.text()
      // Only the full outer document is validated; frame fragments are not
      // documents and must not be treated as such.
      if (!html.includes('<html')) {
        failures.push(`${url}: response is not a full HTML document`)
        continue
      }

      // The render runtime streams scoped-style <head> blocks inline inside
      // frame content (the frame marker `<!-- rmx:f:... -->` is followed by a
      // <head> holding `data-rmx-style` tags). Those are protocol artifacts,
      // not page content, and html-validate's strict parser otherwise reports
      // them as a <head> under a body element. Only body content models are in
      // scope, so drop every <head> block before validating.
      let documentHtml = html.replace(/<head>[\s\S]*?<\/head>/g, '')

      // The route path is a stable, non-user-controlled handle for the config
      // loader (which resolves `.htmlvalidate.json` from the repo root).
      let report = await htmlvalidate.validateString(
        documentHtml,
        path.join(CONFIG_ANCHOR, `${url.replace(/[^a-z0-9]+/gi, '_')}.html`),
      )
      for (let result of report.results) {
        for (let message of result.messages) {
          failures.push(
            `${url} [${message.ruleId}] ${message.message} (line ${message.line}, column ${message.column})`,
          )
        }
      }
    }

    assert.equal(failures.length, 0, `HTML content-model violations:\n${failures.join('\n')}`)
  })
})
