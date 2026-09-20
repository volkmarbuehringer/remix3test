import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { pool } from '../../data/test-pool.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'

// ---------------------------------------------------------------------------
// /verwaltung/report1 (Monatsauswertung) render contract.
//
// Covers the UX fixes that are easy to regress silently: the German period
// heading, `aria-sort`/scoped headers, the `data-label` hooks the mobile card
// layout depends on, the auto-submit form marker, and the per-row drill-down.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const REPORT_URL = BASE + routes.verwaltung.report1.index.href()

const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

describe('Verwaltung Report1 (Monatsauswertung)', () => {
  let adminCookie: string
  let createdAppointmentId: number | undefined
  let expectedHeading: string

  before(async () => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    adminCookie = auth.cookie

    let userRow = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com'])
    let resourceRow = await pool.query('SELECT id FROM resources ORDER BY id LIMIT 1')
    assert.ok(userRow.rows[0], 'admin user must be seeded')
    assert.ok(resourceRow.rows[0], 'a resource must be seeded')

    let now = new Date()
    expectedHeading = `Monatsauswertung — ${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()}`
    let date = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10)

    let inserted = await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
      [
        userRow.rows[0].id,
        resourceRow.rows[0].id,
        'report1-ux-test',
        date,
        '[480,540)',
        Date.now(),
      ],
    )
    createdAppointmentId = Number(inserted.rows[0]!.id)
  })

  after(async () => {
    if (createdAppointmentId !== undefined) {
      await pool.query('DELETE FROM appointments WHERE id = $1', [createdAppointmentId])
    }
  })

  async function fetchHtml(query = ''): Promise<string> {
    let response = await router.fetch(REPORT_URL + query, { headers: { Cookie: adminCookie } })
    assert.equal(response.status, 200, 'admin GET should return 200')
    return await response.text()
  }

  it('renders the period heading with the German month name', async () => {
    let html = await fetchHtml()
    assert.ok(html.includes(expectedHeading), `heading "${expectedHeading}" should render`)
  })

  it('marks the active sort column with aria-sort and scopes every header', async () => {
    let html = await fetchHtml('?sort=name&order=asc')
    assert.ok(html.includes('aria-sort="ascending"'), 'active sort column should be announced')
    assert.equal(
      (html.match(/scope="col"/g) ?? []).length,
      6,
      'every column header should be scoped',
    )
  })

  it('labels every row cell for the mobile card layout', async () => {
    let html = await fetchHtml()
    for (let label of [
      'Name',
      'Anzahl',
      'Erster Termin',
      'Letzter Termin',
      'Std. gesamt',
      'Ø Std./Termin',
    ]) {
      assert.ok(html.includes(`data-label="${label}"`), `cell label "${label}" should render`)
    }
  })

  it('marks the filter form as the auto-submit target', async () => {
    let html = await fetchHtml()
    assert.ok(html.includes('data-report1-filters="true"'), 'filter form hook should render')
  })

  it('drills each row into the appointments grid filtered by user', async () => {
    let html = await fetchHtml()
    assert.ok(
      html.includes(`href="${routes.verwaltung.appointments.index.href()}?filter=`),
      'row should link to the appointments grid',
    )
    assert.ok(html.includes('status=all'), 'drill-down must not hide past appointments')
  })

  it('offers a PDF export link that carries the current filters', async () => {
    let html = await fetchHtml('?year=2026&month=3&filter=Admin')
    assert.ok(html.includes('data-rmx-document'), 'PDF link must bypass frame interception')
    assert.ok(html.includes('/verwaltung/report1/pdf?'), 'PDF link should target the export route')
    assert.ok(html.includes('month=3'), 'PDF link should carry the period')
    assert.ok(html.includes('filter=Admin'), 'PDF link should carry the name filter')
    assert.ok(html.includes('Filtern'), 'the submit button applies filters, not a PDF')
  })

  it('downloads the monthly evaluation as a PDF', async () => {
    let response = await router.fetch(`${REPORT_URL}/pdf`, { headers: { Cookie: adminCookie } })
    assert.equal(response.status, 200, 'admin PDF GET should return 200')
    assert.equal(response.headers.get('Content-Type'), 'application/pdf')
    assert.ok(
      (response.headers.get('Content-Disposition') ?? '').includes('monatsauswertung-'),
      'filename should describe the export',
    )
    let bytes = new Uint8Array(await response.arrayBuffer())
    assert.equal(String.fromCharCode(...bytes.subarray(0, 4)), '%PDF', 'body should be a PDF')
  })

  it('redirects framed PDF requests to the marker URL (302)', async () => {
    let response = await router.fetch(`${REPORT_URL}/pdf?year=2026&month=3`, {
      headers: { Cookie: adminCookie, 'X-Remix-Frame': 'true' },
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.includes('/verwaltung/report1/pdf'), 'location should be the export route')
    assert.ok(location.includes('month=3'), 'location should keep the params')
    assert.ok(location.includes('frameDownload=1'), 'location should carry the marker param')
  })

  it('renders HTML for the framed marker URL so the redirect chain terminates', async () => {
    let response = await router.fetch(`${REPORT_URL}/pdf?year=2026&month=3&frameDownload=1`, {
      headers: { Cookie: adminCookie, 'X-Remix-Frame': 'true' },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Monatsauswertung'), 'should render the page as HTML')
    assert.ok(!html.startsWith('%PDF'), 'must not return the binary inside a frame')
  })
})
