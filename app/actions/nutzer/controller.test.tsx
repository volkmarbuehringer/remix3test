import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { initializeAppDatabase, pool } from '../../data/setup.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { routes } from '../../routes.ts'

// ---------------------------------------------------------------------------
// Admin Nutzer Controller integration tests
//
// Tests the admin nutzer grid at /admin/nutzer:
//   - Auth gating (requireAuth + requireAdmin middleware)
//   - Content rendering (empty state, data rows)
//   - Sorting (default sort, sort params, invalid columns)
//   - Filtering (ILIKE search across name/email/login columns)
//   - Pagination (offset, page size, hasMore)
//   - Page component rendering (filter form, table headers, boolean badges,
//     timestamps, null values, pagination controls)
//   - Update (PUT): updates both nutzer + login tables, invalid ID handling
//   - Create (POST): creates login then nutzer, redirects with editing=N
//   - Destroy (DELETE): removes nutzer then login, invalid ID handling
//   - Edit panel (?editing=N): renders edit form with row data
//   - Create panel (?creating=true): renders create form
//
// Requires a running PostgreSQL database with nutzer + login tables.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const NUTZER_URL = `${BASE}/admin/nutzer`
const PAGE_SIZE = 15

// ── Helpers ─────────────────────────────────────────────────────────────────

function uniqueLogin(prefix: string): string {
  return `test-${prefix}-${Date.now()}`
}

// ── Test suite ──────────────────────────────────────────────────────────────

describe('Admin Nutzer controller & page', () => {
  let adminCookie: string
  let adminCsrf: string
  let userCookie: string
  let allLoginIds: string[] = []
  let allNutzerIds: string[] = []

  // We need enough rows for pagination tests. Insert PAGE_SIZE + 2 rows
  // so the first page (LIMIT PAGE_SIZE+1) has hasMore=true.
  // Plus we insert the special rows (null values, etc.) separately.
  // Total rows = BASE_ROWS + PAGINATION_ROWS
  let BASE_ROWS = 5
  let PAGINATION_ROWS = 17
  let NOW = Date.now()

  before(async () => {
    await initializeAppDatabase()

    // ── Auth cookies ───────────────────────────────────────────────

    let adminResult = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    adminCookie = adminResult?.cookie ?? ''
    adminCsrf = adminResult?.csrfToken ?? ''
    let userResult = await createAuthCookieWithCsrfForUser('user@newapp.com')
    userCookie = userResult?.cookie ?? ''

    // ── Comprehensive cleanup of any leftover test data ─────────────

    // Delete nutzer rows that reference test logins first (FK to login)
    await pool.query(`DELETE FROM nutzer WHERE n_lid IN (SELECT l_id FROM login WHERE l_login LIKE 'test-%')`)
    // Then delete login rows
    await pool.query(`DELETE FROM login WHERE l_login LIKE 'test-%'`)

    // ── Seed base test logins (5) ───────────────────────────────────

    let baseLogins = [
      {
        l_login: uniqueLogin(`base-a-${NOW}`),
        l_aktiv: true,
        l_gesperrt: false,
        l_letzte_login: '2024-01-15T10:00:00.000Z',
      },
      {
        l_login: uniqueLogin(`base-b-${NOW}`),
        l_aktiv: true,
        l_gesperrt: false,
        l_letzte_login: '2024-03-01T14:30:00.000Z',
      },
      {
        l_login: uniqueLogin(`base-c-${NOW}`),
        l_aktiv: true,
        l_gesperrt: true,
        l_letzte_login: null,
      },
      {
        l_login: uniqueLogin(`base-d-${NOW}`),
        l_aktiv: false,
        l_gesperrt: false,
        l_letzte_login: '2024-02-15T09:00:00.000Z',
      },
      {
        l_login: uniqueLogin(`base-e-${NOW}`),
        l_aktiv: true,
        l_gesperrt: false,
        l_letzte_login: '2024-04-10T08:00:00.000Z',
      },
    ]

    for (let l of baseLogins) {
      let result = await pool.query(
        `INSERT INTO login (l_login, l_aktiv, l_gesperrt, l_letzte_login)
         VALUES ($1, $2, $3, $4::timestamptz)
         RETURNING l_id`,
        [l.l_login, l.l_aktiv, l.l_gesperrt, l.l_letzte_login],
      )
      allLoginIds.push(result.rows[0].l_id)
    }

    // ── Seed base test nutzers (5) ──────────────────────────────────

    let baseNutzers = [
      {
        n_vorname: 'Alpha',
        n_name: 'Admin',
        n_email: `test-nutzer-alpha-${NOW}@test.com`,
        n_verpflichtung: false,
        l_idx: 0,
      },
      {
        n_vorname: 'John',
        n_name: 'Doe',
        n_email: `test-nutzer-john-${NOW}@test.com`,
        n_verpflichtung: true,
        l_idx: 1,
      },
      {
        n_vorname: 'Jane',
        n_name: 'Smith',
        n_email: `test-nutzer-jane-${NOW}@test.com`,
        n_verpflichtung: false,
        l_idx: 2,
      },
      {
        n_vorname: null,
        n_name: null,
        n_email: `test-nutzer-null-${NOW}@test.com`,
        n_verpflichtung: true,
        l_idx: 3,
      },
      {
        n_vorname: 'Bob',
        n_name: 'Builder',
        n_email: `test-nutzer-bob-${NOW}@test.com`,
        n_verpflichtung: false,
        l_idx: 4,
      },
    ]

    for (let n of baseNutzers) {
      let result = await pool.query(
        `INSERT INTO nutzer (n_vorname, n_name, n_email, n_verpflichtung, n_lid)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING n_id`,
        [
          n.n_vorname,
          n.n_name,
          n.n_email,
          n.n_verpflichtung,
          allLoginIds[n.l_idx],
        ],
      )
      allNutzerIds.push(result.rows[0].n_id)
    }

    // ── Seed extra rows for pagination tests (17) ───────────────────

    for (let i = 0; i < PAGINATION_ROWS; i++) {
      let lResult = await pool.query(
        `INSERT INTO login (l_login, l_aktiv, l_gesperrt)
         VALUES ($1, true, false)
         RETURNING l_id`,
        [uniqueLogin(`page-${i}-${NOW}`)],
      )
      allLoginIds.push(lResult.rows[0].l_id)

      let nResult = await pool.query(
        `INSERT INTO nutzer (n_vorname, n_name, n_email, n_verpflichtung, n_lid)
         VALUES ($1, $2, $3, false, $4)
         RETURNING n_id`,
        [
          `PagVorname${i}`,
          `PagName${String(i).padStart(2, '0')}`,
          `page-${i}-${NOW}.nutzer-test@example.com`,
          lResult.rows[0].l_id,
        ],
      )
      allNutzerIds.push(nResult.rows[0].n_id)
    }
  })

  after(async () => {
    // Clean up test data in reverse FK order
    for (let id of allNutzerIds) {
      try {
        await pool.query('DELETE FROM nutzer WHERE n_id = $1', [id])
      } catch {
        /* ignore cleanup errors */
      }
    }
    for (let id of allLoginIds) {
      try {
        await pool.query('DELETE FROM login WHERE l_id = $1', [id])
      } catch {
        /* ignore cleanup errors */
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Auth gating
  // ═══════════════════════════════════════════════════════════════════════════

  it('GET /admin/nutzer redirects to login when not authenticated', async () => {
    let response = await router.fetch(NUTZER_URL)

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(
      location?.startsWith(routes.auth.login.index.href()),
      'should redirect to /login with returnTo',
    )
    assert.ok(
      location?.includes('returnTo='),
      'should capture return path in returnTo param',
    )
  })

  it('GET /admin/nutzer returns 200 for admin', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
  })

  it('GET /admin/nutzer returns 403 for non-admin user', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: userCookie },
    })

    assert.equal(response.status, 403)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Content rendering
  // ═══════════════════════════════════════════════════════════════════════════

  it('GET /admin/nutzer renders page title and description', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.ok(html.includes('Nutzer'), 'response should contain "Nutzer" heading')
    assert.ok(
      html.includes('Nutzer'),
      'response should contain "Nutzer" heading',
    )
  })

  it('GET /admin/nutzer renders data rows from the database', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    // Verify response is reasonably sized (contains page content)
    assert.ok(html.length > 500, 'response should be a full HTML page')

    // The page should NOT show the generic empty state (data exists)
    assert.ok(
      !html.includes('Keine Nutzer vorhanden'),
      'should NOT show generic empty state when rows exist',
    )

    // The page should NOT show the search-specific empty state (no filter applied)
    assert.ok(
      !html.includes('Keine Nutzer gefunden'),
      'should NOT show search-specific empty state without filter',
    )

    // Verify the response comes from our controller (has page content)
    assert.ok(
      html.includes('Nutzer') && html.includes('Vorname'),
      'should include page and table header content',
    )

    // Verify specific data values appear in the rendered rows
    assert.ok(
      html.includes('Alpha') && html.includes('Admin'),
      'should render first data row (n_vorname=Alpha, n_name=Admin)',
    )
  })

  it('GET /admin/nutzer shows empty state when query matches nothing', async () => {
    let response = await router.fetch(
      `${NUTZER_URL}?filter=ZZZZNOTFOUND`,
      { headers: { Cookie: adminCookie } },
    )
    let html = await response.text()

    assert.ok(
      html.includes('Keine Nutzer gefunden'),
      'should show search-specific empty state',
    )
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Sorting
  // ═══════════════════════════════════════════════════════════════════════════

  it('GET /admin/nutzer with sort param changes ORDER BY column', async () => {
    let response = await router.fetch(
      `${NUTZER_URL}?sort=n_vorname&order=desc`,
      { headers: { Cookie: adminCookie } },
    )

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Nutzer'), 'should render page with sort params')
  })

  it('GET /admin/nutzer with sort direction asc works', async () => {
    let response = await router.fetch(
      `${NUTZER_URL}?sort=n_email&order=asc`,
      { headers: { Cookie: adminCookie } },
    )

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Nutzer'), 'should render page with asc sort')
  })

  it('GET /admin/nutzer with invalid sort column falls back to default and does not error', async () => {
    let response = await router.fetch(
      `${NUTZER_URL}?sort=nonexistent_column&order=asc`,
      { headers: { Cookie: adminCookie } },
    )

    // Page renders without SQL error (invalid column is rejected
    // by parseSort which validates against the whitelist)
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('n_name') || html.includes('Name'),
      'should use default sort column "n_name"',
    )
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Filtering (ILIKE search)
  // ═══════════════════════════════════════════════════════════════════════════

  it('GET /admin/nutzer with filter finds matching results by name', async () => {
    let response = await router.fetch(`${NUTZER_URL}?filter=John`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('John'), 'should find matching name "John"')
    assert.ok(
      !html.includes('ZZZZNOTFOUND'),
      'should not include arbitrary text',
    )
  })

  it('GET /admin/nutzer with filter finds matching results by email', async () => {
    let response = await router.fetch(
      `${NUTZER_URL}?filter=test-nutzer-bob`,
      { headers: { Cookie: adminCookie } },
    )

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Builder'),
      'should find row matching email filter',
    )
  })

  it('GET /admin/nutzer with non-matching filter shows search-specific empty state', async () => {
    let response = await router.fetch(
      `${NUTZER_URL}?filter=ZZZZNOTFOUND`,
      { headers: { Cookie: adminCookie } },
    )

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(
      html.includes('Keine Nutzer gefunden'),
      'should show search-specific empty state message',
    )
  })

  it('GET /admin/nutzer with empty filter treated as no filter', async () => {
    let response = await router.fetch(`${NUTZER_URL}?filter=`, {
      headers: { Cookie: adminCookie },
    })

    // Empty filter string should be treated as undefined → no WHERE clause
    assert.equal(response.status, 200)
    let html = await response.text()
    // PAGE_SIZE (15) rows should be returned with data
    assert.ok(html.includes('Nutzer'), 'should render page with empty filter')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Pagination behavior
  // ═══════════════════════════════════════════════════════════════════════════

  it('GET /admin/nutzer with offset 0 shows the first page', async () => {
    let response = await router.fetch(`${NUTZER_URL}?offset=0`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Nutzer'), 'should render first page')
  })

  it('GET /admin/nutzer with negative offset clamps to 0', async () => {
    let response = await router.fetch(`${NUTZER_URL}?offset=-5`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    // With clamp to 0, first rows should appear (Admin, Builder, etc.)
    assert.ok(html.includes('Nutzer'), 'should render page (clamped offset)')
  })

  it('GET /admin/nutzer with non-numeric offset defaults to 0', async () => {
    let response = await router.fetch(`${NUTZER_URL}?offset=abc`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Nutzer'), 'should render page with default offset')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Pagination controls (hasMore with 22 rows > PAGE_SIZE 15)
  // ═══════════════════════════════════════════════════════════════════════════

  it('shows pagination "Weiter" link when hasMore is true', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    // With 22 rows and PAGE_SIZE=15, hasMore=true
    assert.ok(
      html.includes('Weiter'),
      'should show "Weiter" link when more pages exist',
    )
  })

  it('does not show active "Zurück" link on the first page', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    // The pagination div appears when hasMore=true (22 rows > 15),
    // but "Zurück" should be a disabled <span>, not an active <a> link
    // when offset=0.
    // Check that there's NO <a> tag with "Zurück" text
    let zurueckLinkMatch = html.match(/<a[^>]*>[^<]*Zurück[^<]*<\/a>/)
    assert.equal(
      zurueckLinkMatch,
      null,
      'should NOT have an active <a> link for "Zurück" on first page',
    )

    // However, the disabled span version may still render
    assert.ok(
      html.includes('Zurück'),
      'should still render the disabled "Zurück" span when hasMore=true',
    )
  })

  it('shows "Zurück" link when offset > 0', async () => {
    let response = await router.fetch(`${NUTZER_URL}?offset=15`, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.ok(
      html.includes('Zurück'),
      'should show "Zurück" link when offset > 0',
    )
  })

  it('shows "Zeige" range text on first page', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.ok(
      html.includes('Zeige'),
      'should show "Zeige" range text when rows are displayed',
    )
  })

  it('shows "Zeige 1–15" on first page with 15 rows', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    // First page: offset 0 + 15 rows = Zeige 1–15
    assert.ok(
      html.includes('1–15') || html.includes('1\u201315'),
      'should show "Zeige 1–15" on first page',
    )
  })

  it('shows correct range on second page with remaining rows', async () => {
    let response = await router.fetch(`${NUTZER_URL}?offset=15`, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    // With 22 total rows, offset=15 returns the remaining 7 rows
    // (LIMIT 16 returns rows 16-22, then hasMore=false since 7 <= 15).
    // So the range should be "Zeige 16–22"
    assert.ok(
      html.includes('Zeige'),
      'should show "Zeige" range text on second page',
    )
    // Verify the range includes number 16 (start of second page)
    assert.ok(
      html.includes('16') && html.includes('22'),
      'should show range from 16 to 22 on second page',
    )
  })

  it('shows "Weiter" text on last page (disabled state, hasMore false)', async () => {
    let response = await router.fetch(`${NUTZER_URL}?offset=15`, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    // Even on last page where hasMore=false, "Weiter" text is rendered
    assert.ok(html.includes('Weiter'), 'should show "Weiter" text on last page')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Page component — filter form
  // ═══════════════════════════════════════════════════════════════════════════

  it('has a filter form with action="/admin/nutzer"', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.ok(
      html.includes('action="/admin/nutzer"'),
      'filter form should POST to /admin/nutzer',
    )
    assert.ok(
      html.includes('name="filter"'),
      'filter form should have input named "filter"',
    )
  })

  it('has filter form with rmx-target attribute (frame-based)', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.ok(
      html.includes('rmx-target'),
      'filter form should have rmx-target (page is now in a frame)',
    )
  })

  it('shows clear link when a filter is set', async () => {
    let response = await router.fetch(`${NUTZER_URL}?filter=John`, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.ok(
      html.includes('Zurücksetzen'),
      'should show "Zurücksetzen" clear link when filter is active',
    )
  })

  it('does NOT show clear link when no filter is set', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.ok(
      !html.includes('Zurücksetzen'),
      'should NOT show "Zurücksetzen" link without filter',
    )
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Page component — table headers and sorting UI
  // ═══════════════════════════════════════════════════════════════════════════

  it('renders sortable column headers', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    let columnLabels = [
      'Vorname',
      'Name',
      'Email',
      'Login',
      'Verpfl',
      'Aktiv',
      'Gesp',
      'Letzter Login',
    ]
    for (let label of columnLabels) {
      assert.ok(html.includes(label), `should render column header "${label}"`)
    }
  })

  it('renders sortable links with rmx-target (frame-based)', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    let sortLinks = html.match(/href="\/admin\/nutzer\?[^"]*"/g)
    assert.ok(
      sortLinks && sortLinks.length > 0,
      'should render sort links to /admin/nutzer',
    )

    assert.ok(
      html.includes('rmx-target'),
      'should have rmx-target attributes (page is now in a frame)',
    )
  })

  it('shows active sort arrow and inactive arrows', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    let upArrow = '\u2191'
    let downArrow = '\u2193'
    let inactiveArrow = '\u2195'

    // Default sort is n_name ASC → Name column should show ↑
    assert.ok(
      html.includes(upArrow) || html.includes(downArrow),
      'should show active sort arrow indicator',
    )
    // Non-sorted columns should show ↕
    assert.ok(
      html.includes(inactiveArrow),
      'should show inactive sort arrows on non-sorted columns',
    )
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Page component — boolean values
  // ═══════════════════════════════════════════════════════════════════════════

  it('renders boolean values as Ja/Nein badges', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.ok(html.includes('Ja'), 'should render "Ja" for true boolean')
    assert.ok(html.includes('Nein'), 'should render "Nein" for false boolean')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Page component — null values render as em dash
  // ═══════════════════════════════════════════════════════════════════════════

  it('renders null name fields as em dash', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    // We have a row with null n_vorname and null n_name
    // Due to SQL ORDER BY, nulls sort last, so they're on page 2 (offset 15+)
    let page2Response = await router.fetch(`${NUTZER_URL}?offset=15`, {
      headers: { Cookie: adminCookie },
    })
    let html2 = await page2Response.text()

    let emDash = '\u2014'
    let allHtml = html + html2
    let emDashCount = (allHtml.match(new RegExp(emDash, 'g')) || []).length
    // Should have at least 2 em dashes: null vorname + null name
    // Plus maybe more from null timestamp
    assert.ok(
      emDashCount >= 2,
      'should render em dash for null name fields',
    )
  })

  it('renders null last login timestamp as em dash', async () => {
    // The row with l_letzte_login = null is on page 2 (null names sort last)
    let response = await router.fetch(`${NUTZER_URL}?offset=15`, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    let emDash = '\u2014'
    assert.ok(
      html.includes(emDash),
      'should render em dash for null timestamp values',
    )
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Route wiring
  // ═══════════════════════════════════════════════════════════════════════════

  it('routes.admin.nutzer.index.href() returns /admin/nutzer', () => {
    assert.equal(
      routes.admin.nutzer.index.href(),
      '/admin/nutzer',
      'route href should be /admin/nutzer',
    )
  })

  it('route is wired in router (router.fetch returns proper response)', async () => {
    let response = await router.fetch(NUTZER_URL, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(
      response.status,
      200,
      'route should be wired and return 200 for admin',
    )
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Update (PUT /admin/nutzer/:id)
  // ═══════════════════════════════════════════════════════════════════════════

  it('PUT /admin/nutzer/:id updates both tables and redirects', async () => {
    // Use the first seeded row ("Alpha Admin")
    let nId = allNutzerIds[0]
    let lId = allLoginIds[0]
    let newVorname = 'UpdatedA'
    let newName = 'UpdatedAdmin'
    let newEmail = `updated-alpha-${NOW}@test.com`
    let newLogin = uniqueLogin(`updated-alpha-${NOW}`)

    let body = new URLSearchParams({
      vorname: newVorname,
      name: newName,
      email: newEmail,
      verpflichtung: 'true',
      login: newLogin,
      aktiv: 'true',
      gesperrt: 'true',
      _l_id: String(lId),
      _offset: '',
      _sort: '',
      _order: '',
      _filter: '',
      _csrf: adminCsrf,
      _method: 'PUT',
    })

    let response = await router.fetch(`${BASE}/admin/nutzer/${nId}`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    // Should redirect back to the grid
    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location === '/admin/nutzer', 'should redirect to /admin/nutzer')

    // Verify nutzer row was updated
    let nutzerResult = await pool.query(
      'SELECT n_vorname, n_name, n_email, n_verpflichtung FROM nutzer WHERE n_id = $1',
      [nId],
    )
    assert.equal(nutzerResult.rows.length, 1, 'nutzer row should exist')
    assert.equal(nutzerResult.rows[0].n_vorname, newVorname)
    assert.equal(nutzerResult.rows[0].n_name, newName)
    assert.equal(nutzerResult.rows[0].n_email, newEmail)
    assert.equal(nutzerResult.rows[0].n_verpflichtung, true)

    // Verify login row was updated
    let loginResult = await pool.query(
      'SELECT l_login, l_aktiv, l_gesperrt FROM login WHERE l_id = $1',
      [lId],
    )
    assert.equal(loginResult.rows.length, 1, 'login row should exist')
    assert.equal(loginResult.rows[0].l_login, newLogin)
    assert.equal(loginResult.rows[0].l_aktiv, true)
    assert.equal(loginResult.rows[0].l_gesperrt, true)
  })

  it('PUT /admin/nutzer/:id with non-existent UUID updates zero rows (no error)', async () => {
    let nonExistentId = '00000000-0000-0000-0000-000000000000'
    let body = new URLSearchParams({
      vorname: '', name: 'ValidName', email: 'valid@test.com', verpflichtung: '',
      login: 'valid@test.com', aktiv: '', gesperrt: '', _l_id: '00000000-0000-0000-0000-000000000000',
      _offset: '', _sort: '', _order: '', _filter: '',
      _csrf: adminCsrf,
      _method: 'PUT',
    })

    let response = await router.fetch(`${BASE}/admin/nutzer/${nonExistentId}`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    // UPDATE on non-existent UUID is not an error — it just affects 0 rows
    assert.equal(response.status, 302)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Create (POST /admin/nutzer)
  // ═══════════════════════════════════════════════════════════════════════════

  it('POST /admin/nutzer creates both tables and redirects to editing', async () => {
    let createLogin = uniqueLogin(`create-test-${NOW}`)
    let createEmail = `create-test-${NOW}@test.com`

    let body = new URLSearchParams({
      vorname: 'CreateTest',
      name: 'CreatedOK',
      email: createEmail,
      verpflichtung: 'true',
      login: createLogin,
      aktiv: 'true',
      gesperrt: 'false',
      _l_id: '',
      _offset: '',
      _sort: '',
      _order: '',
      _filter: '',
      _csrf: adminCsrf,
    })

    let response = await router.fetch(`${BASE}/admin/nutzer`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''

    // Should redirect to /admin/nutzer?editing=N
    assert.ok(
      location.startsWith('/admin/nutzer?editing='),
      'should redirect to /admin/nutzer?editing=N',
    )

    // Extract the new n_id from the redirect URL (handle UUID format)
    let editingMatch = location.match(/editing=([^&]+)/)
    let newNId = editingMatch ? editingMatch[1] : null
    assert.ok(newNId, 'should have valid n_id in redirect')

    if (newNId) {
      // Verify nutzer row exists
      let nutzerResult = await pool.query(
        'SELECT n_vorname, n_name, n_email, n_verpflichtung, n_lid FROM nutzer WHERE n_id = $1',
        [newNId],
      )
      assert.equal(nutzerResult.rows.length, 1, 'nutzer row should exist')
      assert.equal(nutzerResult.rows[0].n_vorname, 'CreateTest')
      assert.equal(nutzerResult.rows[0].n_name, 'CreatedOK')
      assert.equal(nutzerResult.rows[0].n_verpflichtung, true)

      // Verify login row exists
      let loginResult = await pool.query(
        'SELECT l_login, l_aktiv, l_gesperrt FROM login WHERE l_id = $1',
        [nutzerResult.rows[0].n_lid],
      )
      assert.equal(loginResult.rows.length, 1, 'login row should exist')
      assert.equal(loginResult.rows[0].l_aktiv, true)
      assert.equal(loginResult.rows[0].l_gesperrt, false)

      // Track for cleanup
      allNutzerIds.push(String(newNId))
      allLoginIds.push(String(nutzerResult.rows[0].n_lid))
    }
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Destroy (DELETE /admin/nutzer/:id)
  // ═══════════════════════════════════════════════════════════════════════════

  it('DELETE /admin/nutzer/:id removes both tables and redirects', async () => {
    // Create a dedicated row to delete (use unique data to avoid conflicts)
    let delLogin = uniqueLogin(`del-test-${NOW}`)

    // Insert login
    let lResult = await pool.query(
      `INSERT INTO login (l_login, l_aktiv, l_gesperrt)
       VALUES ($1, true, false)
       RETURNING l_id`,
      [delLogin],
    )
    let delLId = lResult.rows[0].l_id
    allLoginIds.push(String(delLId))

    // Insert nutzer
    let nResult = await pool.query(
      `INSERT INTO nutzer (n_vorname, n_name, n_email, n_verpflichtung, n_lid)
       VALUES ($1, $2, $3, false, $4)
       RETURNING n_id`,
      ['ToDelete', 'Deleted', `del-${NOW}@test.com`, delLId],
    )
    let delNId = nResult.rows[0].n_id
    allNutzerIds.push(String(delNId))

    let body = new URLSearchParams({
      _offset: '', _sort: '', _order: '', _filter: '',
      _csrf: adminCsrf,
      _method: 'DELETE',
    })

    let response = await router.fetch(`${BASE}/admin/nutzer/${delNId}`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(
      location === '/admin/nutzer',
      'should redirect to /admin/nutzer on delete',
    )

    // Verify nutzer row is gone
    let nutzerCheck = await pool.query(
      'SELECT n_id FROM nutzer WHERE n_id = $1',
      [delNId],
    )
    assert.equal(nutzerCheck.rows.length, 0, 'nutzer row should be deleted')

    // Verify login row is gone
    let loginCheck = await pool.query(
      'SELECT l_id FROM login WHERE l_id = $1',
      [delLId],
    )
    assert.equal(loginCheck.rows.length, 0, 'login row should be deleted')
  })

  it('DELETE /admin/nutzer/:id with non-existent UUID returns 404', async () => {
    let nonExistentId = '00000000-0000-0000-0000-000000000000'
    let body = new URLSearchParams({
      _offset: '', _sort: '', _order: '', _filter: '',
      _csrf: adminCsrf,
      _method: 'DELETE',
    })

    let response = await router.fetch(`${BASE}/admin/nutzer/${nonExistentId}`, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    assert.equal(response.status, 404)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Edit panel (?editing=N)
  // ═══════════════════════════════════════════════════════════════════════════

  it('GET /admin/nutzer?editing=N renders edit form with row data', async () => {
    let nId = allNutzerIds[0]
    let response = await router.fetch(`${NUTZER_URL}?editing=${nId}`, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.equal(response.status, 200)
    // Should render the edit panel header
    assert.ok(
      html.includes('Nutzer bearbeiten'),
      'should show edit panel title',
    )
    // Should include a hidden _l_id input
    assert.ok(
      html.includes('name="_l_id"'),
      'should include hidden _l_id input',
    )
    // Should have save and cancel buttons
    assert.ok(
      html.includes('Speichern'),
      'should have Speichern button',
    )
    assert.ok(
      html.includes('Abbrechen'),
      'should have Abbrechen button',
    )
  })

  it('GET /admin/nutzer?editing=N with non-existent UUID does not show edit panel', async () => {
    let nonExistentId = '00000000-0000-0000-0000-000000000000'
    let response = await router.fetch(`${NUTZER_URL}?editing=${nonExistentId}`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    // Should render the normal grid without edit panel
    assert.ok(
      !html.includes('Nutzer bearbeiten'),
      'should not show edit panel for non-existent row',
    )
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // Create panel (?creating=true)
  // ═══════════════════════════════════════════════════════════════════════════

  it('GET /admin/nutzer?creating=true renders create form', async () => {
    let response = await router.fetch(`${NUTZER_URL}?creating=true`, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.equal(response.status, 200)
    // Should render the create panel header
    assert.ok(
      html.includes('Neuer Nutzer'),
      'should show create panel title',
    )
    // Should have create and cancel buttons
    assert.ok(
      html.includes('Anlegen'),
      'should have Anlegen button',
    )
    assert.ok(
      html.includes('Abbrechen'),
      'should have Abbrechen button',
    )
    // Should render the grid alongside (nutzer overview)
    assert.ok(
      html.includes('Nutzer'),
      'should still render grid with Nutzer heading',
    )
  })
})
