import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { readSessionId, sessionStorage } from '../../middleware/session.ts'

const BASE = 'https://remix.run'
const RESOURCES_URL = `${BASE}/verwaltung/resources`

describe('Admin Resources Controller', () => {
  let adminCookie: string
  let adminCsrfToken: string
  let userCookie: string
  let userCsrfToken: string
  let adminUserId: number

  before(async () => {
    await initializeAppDatabase()

    // Admin session
    let adminAuth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!adminAuth?.cookie) {
      throw new Error('Failed to create admin session')
    }
    adminCookie = adminAuth.cookie
    adminCsrfToken = adminAuth.csrfToken

    // Non-admin user session
    let userAuth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!userAuth?.cookie) {
      throw new Error('Failed to create user session')
    }
    userCookie = userAuth.cookie
    userCsrfToken = userAuth.csrfToken

    let userResult = await pool.query("SELECT id FROM users WHERE email = 'admin@newapp.com'")
    adminUserId = userResult.rows[0].id as number
  })

  async function insertResource(
    name: string,
    description: string,
    capabilities = '',
  ): Promise<number> {
    let now = Date.now()
    let result = await pool.query(
      'INSERT INTO resources (name, description, capabilities, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, description, capabilities, now, now],
    )
    return result.rows[0].id as number
  }

  describe('index (GET /verwaltung/resources)', () => {
    it('returns 200 for admin users', async () => {
      let response = await router.fetch(RESOURCES_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('Ressourcen'))
      if (text.includes('data-resources-table')) {
        assert.ok(text.includes('data-delete-form='), 'rows expose a server-rendered DELETE form')
        assert.ok(text.includes('editing='), 'rows expose a frame-targeted edit link')
      }
    })

    it('renders the empty-state create CTA only when no form panel is active', async () => {
      // Empty grid, no form panel: the toolbar CTA AND the empty-state CTA both render.
      let response = await router.fetch(
        `${RESOURCES_URL}?filter=zzz-no-such-resource-${Date.now()}`,
        {
          headers: { Cookie: adminCookie },
        },
      )
      assert.equal(response.status, 200)
      let text = await response.text()
      let count = (text.match(/Neu anlegen/g) ?? []).length
      assert.equal(
        count,
        2,
        'an empty grid without a form panel should show the toolbar CTA and the empty-state CTA',
      )
    })

    it('hides the empty-state create CTA when a form panel is active', async () => {
      // Empty grid but creating=true → the create form panel is active, so the
      // empty-state CTA is gated off and only the toolbar "Neu anlegen" remains.
      let response = await router.fetch(
        `${RESOURCES_URL}?creating=true&filter=zzz-no-such-resource-${Date.now()}`,
        {
          headers: { Cookie: adminCookie },
        },
      )
      assert.equal(response.status, 200)
      let text = await response.text()
      let count = (text.match(/Neu anlegen/g) ?? []).length
      assert.equal(count, 1, 'empty-state CTA should be hidden while a form panel is active')
    })

    it('the create form targets the support-agent panel and carries the agent form marker', async () => {
      // Rendered inside the support-agent panel (agent-driven prefill), the
      // create form must address the panel itself (a hardcoded admin-content
      // target would tear down the host page) and carry data-agent-form so the
      // panel's SSE replay keeps owning the submit — a runtime frame fetch
      // carries no X-Agent-Thread, so the agent's ask_user gate could never be
      // answered. See frame-target's selfFrameTarget and
      // support-agent-controller's deferPanelFormToRuntime.
      let response = await router.fetch(
        `${RESOURCES_URL}?creating=true&filter=zzz-no-such-resource-${Date.now()}`,
        {
          headers: { Cookie: adminCookie, 'X-Remix-Target': 'support-agent-panel' },
        },
      )
      assert.equal(response.status, 200)
      let text = await response.text()
      let formMatch = text.match(/<form[^>]*data-agent-form="true"[^>]*>[\s\S]*?<\/form>/)
      assert.ok(formMatch, 'the agent-aware create form renders with the data-agent-form marker')
      assert.ok(
        formMatch![0].includes('data-rmx-target="support-agent-panel"'),
        'the agent-aware create form targets the support-agent panel it is rendered into',
      )
    })

    it('returns 403 for non-admin users', async () => {
      let response = await router.fetch(RESOURCES_URL, {
        headers: { Cookie: userCookie },
      })
      assert.equal(response.status, 403)
    })

    it('returns 302 for unauthenticated requests', async () => {
      let response = await router.fetch(RESOURCES_URL)
      assert.equal(response.status, 302)
    })

    it('filters across description and capabilities, not just the name', async () => {
      let token = `ux-filter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      let byDescription = `UX Beschreibung ${token}`
      let byCapabilities = `UX Ausstattung ${token}`
      await insertResource(`UX Desc Room ${token}`, byDescription)
      let capsId = await insertResource(
        `UX Caps Room ${token}`,
        'Ein Raum, dessen Name den Suchbegriff nicht enthält',
        `Ausstattung: ${byCapabilities}`,
      )
      assert.ok(capsId > 0)

      let descriptionResponse = await router.fetch(
        `${RESOURCES_URL}?filter=${encodeURIComponent(byDescription)}`,
        { headers: { Cookie: adminCookie } },
      )
      assert.equal(descriptionResponse.status, 200)
      let descriptionText = await descriptionResponse.text()
      assert.ok(
        descriptionText.includes(`UX Desc Room ${token}`),
        'a description-only match should be returned',
      )

      let capsResponse = await router.fetch(
        `${RESOURCES_URL}?filter=${encodeURIComponent(byCapabilities)}`,
        { headers: { Cookie: adminCookie } },
      )
      assert.equal(capsResponse.status, 200)
      let capsText = await capsResponse.text()
      assert.ok(
        capsText.includes(`UX Caps Room ${token}`),
        'a capabilities-only match should be returned (it is where the equipment lives)',
      )
    })

    it('treats LIKE wildcards in the filter as literal characters', async () => {
      let token = `uxlike${Date.now().toString(36)}`
      await insertResource(`UX_${token}`, 'Ein Raum mit einem Unterstrich im Namen')
      await insertResource(`UXx${token}`, 'Ein Raum, der nur bei unescaped Wildcards passt')

      let response = await router.fetch(
        `${RESOURCES_URL}?filter=${encodeURIComponent(`UX_${token}`)}`,
        { headers: { Cookie: adminCookie } },
      )
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes(`UX_${token}`), 'the literal underscore match should be returned')
      assert.ok(!text.includes(`UXx${token}`), '`_` must not behave as a single-character wildcard')
    })

    it('reports the filtered total in the pagination footer', async () => {
      let token = `uxtotal${Date.now().toString(36)}`
      await insertResource(`UX Total A ${token}`, 'Erster Treffer für die Summenanzeige')
      await insertResource(`UX Total B ${token}`, 'Zweiter Treffer für die Summenanzeige')

      let response = await router.fetch(`${RESOURCES_URL}?filter=${encodeURIComponent(token)}`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(
        text.includes('data-pagination-info'),
        'the footer summary must feed the document-wide live region',
      )
      assert.ok(/Zeige\s*1–2\s*von\s*2/.test(text), 'the footer should show the filtered total')
      assert.ok(text.includes('Seite 1'), 'the footer should show the current page')
    })

    it('renders accessible sortable headers and an Aktionen column header', async () => {
      let response = await router.fetch(RESOURCES_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('aria-sort="ascending"'), 'the active sort column exposes aria-sort')
      assert.ok(text.includes('aria-label="Aktionen"'), 'the actions column has a header')
      assert.ok(text.includes('<caption'), 'the grid has a screen-reader caption')
      assert.ok(text.includes('name="sort"'), 'the filter form preserves the sort column')
      assert.ok(text.includes('name="order"'), 'the filter form preserves the sort direction')
    })

    it('offers recovery actions in the empty state', async () => {
      let response = await router.fetch(
        `${RESOURCES_URL}?filter=zzz-no-such-resource-${Date.now()}`,
        { headers: { Cookie: adminCookie } },
      )
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('Filter zurücksetzen'), 'a filtered empty grid can clear its filter')
    })

    it('supports sorting by description', async () => {
      let response = await router.fetch(`${RESOURCES_URL}?sort=description&order=asc`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })

    it('supports pagination', async () => {
      let response = await router.fetch(`${RESOURCES_URL}?offset=0`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })
  })

  describe('create (POST /verwaltung/resources)', () => {
    it('creates a new resource with valid data', async () => {
      let desc = `Test Resource ${Date.now()}`
      let caps = 'Großer Raum für Gruppentherapie.\nGeeignet für bis zu 10 Personen.\nBarrierefrei.'
      let body = new URLSearchParams({
        name: 'Test Raum',
        description: desc,
        capabilities: caps,
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(RESOURCES_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 303)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/resources?editing='))
    })

    it('creates a resource with empty capabilities', async () => {
      let body = new URLSearchParams({
        name: 'No Caps Room',
        description: 'Ein Testraum ohne besondere Fähigkeiten',
        capabilities: '',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(RESOURCES_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 303)
    })

    it('preserves grid state on create redirect', async () => {
      let desc = `Grid State Create ${Date.now()}`
      let body = new URLSearchParams({
        name: 'Grid State Room',
        description: desc,
        capabilities: 'Geräumig',
        _csrf: adminCsrfToken,
        _offset: '15',
        _sort: 'name',
        _order: 'desc',
        _filter: 'garten',
      })
      let response = await router.fetch(RESOURCES_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 303, 'valid create should redirect')
      let location = response.headers.get('Location') || ''
      assert.ok(
        location.includes('editing='),
        'create should keep the new row selected for editing',
      )
      assert.ok(location.includes('offset=15'), 'should preserve offset')
      assert.ok(location.includes('sort=name'), 'should preserve sort')
      assert.ok(location.includes('order=desc'), 'should preserve order')
      assert.ok(location.includes('filter=garten'), 'should preserve filter')
    })

    it('rejects empty description with an inline-error 400 re-render', async () => {
      let body = new URLSearchParams({
        name: 'Test Raum',
        description: '',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(RESOURCES_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400, 'validation failure should re-render at 400')
      let text = await response.text()
      assert.ok(text.includes('mindestens 8 Zeichen'))
      assert.ok(
        text.includes('aria-describedby="ar-c-desc-hint ar-c-desc-error"'),
        'create-panel description field should reference its hint and error ids',
      )
      assert.ok(
        text.includes('id="ar-c-desc-error"'),
        'create-panel error element should carry the id',
      )
    })

    it('rejects a too-short name with a German inline error', async () => {
      let body = new URLSearchParams({
        name: 'X',
        description: 'Eine ausreichend lange Beschreibung',
        capabilities: '',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(RESOURCES_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400)
      let text = await response.text()
      assert.ok(
        text.includes('Name muss mindestens 4 Zeichen lang sein'),
        'the inline name error should be German, like the field hint',
      )
    })

    it('denies create for non-admin users', async () => {
      let body = new URLSearchParams({
        description: 'Unauthorized Resource',
        _csrf: userCsrfToken,
      })
      let response = await router.fetch(RESOURCES_URL, {
        method: 'POST',
        headers: {
          Cookie: userCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 403)
    })

    it('agent create returns JSON for X-Agent-Thread requests', async () => {
      let body = new URLSearchParams({
        name: 'Agent Raum',
        description: 'Vom Agenten angelegter Raum',
        capabilities: 'Agentenfähig',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(RESOURCES_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Agent-Thread': 'thread-123',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 200)
      let ct = response.headers.get('Content-Type') || ''
      assert.ok(ct.includes('json'), 'agent create should return a JSON response')
      let data = (await response.json()) as { status: string; threadId?: string }
      assert.equal(data.status, 'created')
      assert.equal(data.threadId, 'thread-123')
    })

    it('agent create returns a validation_error JSON for an invalid payload', async () => {
      let body = new URLSearchParams({
        name: 'X',
        description: '',
        capabilities: '',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(RESOURCES_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Agent-Thread': 'thread-124',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400, 'agent validation failure should return 400 JSON')
      let ct = response.headers.get('Content-Type') || ''
      assert.ok(ct.includes('json'))
      let data = (await response.json()) as { status: string; issues: unknown[] }
      assert.equal(data.status, 'validation_error')
      assert.ok((data.issues ?? []).length > 0)
    })
  })

  describe('update (PUT /verwaltung/resources/:id)', () => {
    let testResourceId: number

    before(async () => {
      testResourceId = await insertResource('Test Update', `Test Resource Update ${Date.now()}`)
    })

    it('updates a resource description and capabilities', async () => {
      let body = new URLSearchParams({
        name: 'Test Update',
        description: 'Updated Description',
        capabilities: 'Erweiterte Capabilities für diesen Raum.\nNun mit neuer Ausstattung.',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/${testResourceId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 303)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/resources'))

      // Verify the description and capabilities were updated
      let result = await pool.query(
        'SELECT description, capabilities FROM resources WHERE id = $1',
        [testResourceId],
      )
      assert.equal(result.rows[0]?.description, 'Updated Description')
      assert.ok(result.rows[0]?.capabilities.includes('Erweiterte Capabilities'))
    })

    it('preserves grid state on update redirect', async () => {
      let body = new URLSearchParams({
        name: 'Test Update',
        description: 'Beschreibung für den Update Redirect Test',
        capabilities: 'Test',
        _csrf: adminCsrfToken,
        _offset: '30',
        _sort: 'description',
        _order: 'asc',
        _filter: 'raum',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/${testResourceId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 303, 'valid update should redirect')
      let location = response.headers.get('Location') || ''
      assert.ok(location.includes('offset=30'), 'should preserve offset')
      assert.ok(location.includes('sort=description'), 'should preserve sort')
      assert.ok(location.includes('order=asc'), 'should preserve order')
      assert.ok(location.includes('filter=raum'), 'should preserve filter')
    })

    it('rejects update with empty description via an inline-error 400 re-render', async () => {
      let body = new URLSearchParams({
        name: 'Test Update',
        description: '',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/${testResourceId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400, 'validation failure should re-render at 400')
      let text = await response.text()
      assert.ok(text.includes('mindestens 8 Zeichen'))
      assert.ok(
        text.includes('aria-describedby="ar-desc-hint ar-desc-error"'),
        'edit-panel description field should reference its hint and error ids',
      )
      assert.ok(text.includes('id="ar-desc-error"'), 'edit-panel error element should carry the id')
    })

    it('redirects with a flash error when updating a not-found row', async () => {
      let body = new URLSearchParams({
        name: 'Ghost Update',
        description: 'Beschreibung für einen nicht existenten Eintrag',
        capabilities: '',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/9999999`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 303, 'not-found update should redirect (PRG)')
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/resources'), 'should redirect to the grid list')

      let rawSid = await readSessionId(adminCookie)
      let session = await sessionStorage.read(rawSid)
      let err = session.get('error') as string | undefined
      assert.ok(err?.includes('Eintrag nicht gefunden'), 'flash error should be set')
    })

    it('redirects with a flash error for a non-numeric id (int4 guard)', async () => {
      let body = new URLSearchParams({
        title: 'Invalid id update',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/abc`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 303, 'non-numeric id should redirect (PRG)')
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/resources'), 'should redirect to the grid list')

      let rawSid = await readSessionId(adminCookie)
      let session = await sessionStorage.read(rawSid)
      let err = session.get('error') as string | undefined
      assert.ok(err?.includes('Ungültige ID'), 'flash error should be set')
    })
  })

  describe('destroy (DELETE /verwaltung/resources/:id)', () => {
    it('deletes a resource with no appointments', async () => {
      let id = await insertResource('Delete Test', `Delete Test ${Date.now()}`)

      let body = new URLSearchParams({
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/${id}`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 303)
    })

    it('redirects with a flash error for a non-existent resource', async () => {
      let body = new URLSearchParams({
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/9999999`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 303, 'non-existent delete should redirect (PRG), not 404')
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/resources'), 'should redirect to the grid list')

      let rawSid = await readSessionId(adminCookie)
      let session = await sessionStorage.read(rawSid)
      let err = session.get('error') as string | undefined
      assert.ok(err?.includes('Eintrag nicht gefunden'), 'flash error should be set')
    })

    it('redirects with a flash error when a delete is blocked by a foreign key', async () => {
      // Arrange: a resource referenced by an appointment cannot be deleted
      let resourceId = await insertResource('FK Blocked', `FK Blocked ${Date.now()}`)
      let dayMs = new Date('2026-09-01T00:00:00Z').getTime()
      let apptResult = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, 'FK Hold', $3, '[480,540)', $4, $4)
         RETURNING id`,
        [adminUserId, resourceId, dayMs, Date.now()],
      )
      let apptId = apptResult.rows[0].id as number

      let body = new URLSearchParams({
        _csrf: adminCsrfToken,
        _offset: '7',
        _sort: 'name',
        _order: 'desc',
        _filter: 'fk',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/${resourceId}`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })

      // Assert: PRG back to the grid with a flash error, preserving grid state
      assert.equal(response.status, 303, 'FK-blocked delete should redirect (PRG)')
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/resources'), 'should redirect to the grid list')
      assert.ok(location.includes('offset=7'), 'should preserve offset')
      assert.ok(location.includes('sort=name'), 'should preserve sort')
      assert.ok(location.includes('order=desc'), 'should preserve order')
      assert.ok(location.includes('filter=fk'), 'should preserve filter')

      let rawSid = await readSessionId(adminCookie)
      let session = await sessionStorage.read(rawSid)
      let err = session.get('error') as string | undefined
      assert.ok(
        err?.includes('Ressource wird noch verwendet'),
        'flash error should mention the usage block',
      )

      // Clean up: remove the holding appointment then the resource
      await pool.query('DELETE FROM appointments WHERE id = $1', [apptId])
      await pool.query('DELETE FROM resources WHERE id = $1', [resourceId])
    })

    it('preserves grid state on successful delete redirect', async () => {
      let id = await insertResource('Grid State Delete', `Grid State Delete ${Date.now()}`)

      let body = new URLSearchParams({
        _csrf: adminCsrfToken,
        _offset: '12',
        _sort: 'updated_at',
        _order: 'desc',
        _filter: 'deletefilter',
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/${id}`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 303, 'delete should redirect')
      let location = response.headers.get('Location') || ''
      assert.ok(location.includes('offset=12'), 'should preserve offset')
      assert.ok(location.includes('sort=updated_at'), 'should preserve sort')
      assert.ok(location.includes('order=desc'), 'should preserve order')
      assert.ok(location.includes('filter=deletefilter'), 'should preserve filter')
    })

    it('GET /verwaltung/resources/:id for a deleted row redirects to the grid, not 404', async () => {
      // Arrange: create a resource and delete it (the frame commits the action path then GETs it)
      let id = await insertResource('Delete-then-GET', `Delete-then-GET ${Date.now()}`)

      let body = new URLSearchParams({
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let deleteResponse = await router.fetch(`${BASE}/verwaltung/resources/${id}`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(deleteResponse.status, 303, 'delete should redirect')

      // The frame then GETs /verwaltung/resources/:id
      let getResponse = await router.fetch(`${BASE}/verwaltung/resources/${id}`, {
        headers: { Cookie: adminCookie },
        redirect: 'manual',
      })

      // Assert: it must PRG back to the grid, not render a 404 card
      assert.equal(getResponse.status, 302, 'missing resource GET should redirect to the grid')
      let location = getResponse.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/resources'), 'should redirect to the grid list')
    })

    it('GET /verwaltung/resources/:id with a non-numeric id redirects without querying', async () => {
      let response = await router.fetch(`${BASE}/verwaltung/resources/abc`, {
        headers: { Cookie: adminCookie },
        redirect: 'manual',
      })

      assert.equal(response.status, 302, 'non-numeric id GET should redirect to the grid')
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/resources'), 'should redirect to the grid list')
    })

    it('denies delete for non-admin users', async () => {
      let body = new URLSearchParams({
        _csrf: userCsrfToken,
      })
      let response = await router.fetch(`${BASE}/verwaltung/resources/1`, {
        method: 'DELETE',
        headers: {
          Cookie: userCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': userCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 403)
    })
  })
})
