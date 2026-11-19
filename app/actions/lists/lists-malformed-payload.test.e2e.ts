import { describe, it, before, after, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// The JSONB `lists.list` column is user data: a row can hold a pre-serialized
// string, an object, or an array with non-object elements. Those rows used to
// fail the strict row schema or `jsonb_array_elements` and 500 the owner's
// page. The data-layer tests prove each reader individually; this e2e pins the
// whole HTTP path — summary grid, list editor, admin grid — against poisoned
// rows so a regression in the renderer cannot slip through.
//
// Fixtures are tagged `test-malformed-payload-e2e` and removed in `after` by
// that prefix, so a crash between tests cannot leak rows into the DB.
// ---------------------------------------------------------------------------

const PREFIX = 'test-malformed-payload-e2e'

let encodedId: number
let driftId: number
let objectId: number

describe('lists tolerate malformed json payloads', () => {
  before(async () => {
    await initializeAppDatabase()
    let owner = await pool.query("SELECT id FROM users WHERE email = 'user@newapp.com'")
    let ownerId = owner.rows[0]?.id as number
    assert.ok(ownerId, 'seed user user@newapp.com must exist')

    let now = Date.now()
    let inserted = await pool.query(
      `INSERT INTO lists (user_id, title, description, list, created_at, updated_at)
       VALUES
         ($1, 'Encoded row', $2, to_jsonb('[{"id":"a","label":"Encoded item"}]'::text), $5, $5),
         ($1, 'Drift row', $3, '[{"id":"b","label":"Survivor"}, "junk", {"id":"c","label":42}]'::jsonb, $5, $5),
         ($1, 'Object row', $4, '{"nope":true}'::jsonb, $5, $5)
       RETURNING id, description`,
      [ownerId, `${PREFIX}-encoded`, `${PREFIX}-drift`, `${PREFIX}-object`, now],
    )
    let ids = new Map(
      (inserted.rows as Array<{ id: number; description: string }>).map((row) => [
        row.description,
        Number(row.id),
      ]),
    )
    encodedId = ids.get(`${PREFIX}-encoded`)!
    driftId = ids.get(`${PREFIX}-drift`)!
    objectId = ids.get(`${PREFIX}-object`)!
    assert.ok(encodedId && driftId && objectId, 'all poison rows must be seeded')
  })

  after(async () => {
    await pool.query('DELETE FROM lists WHERE description LIKE $1', [`${PREFIX}%`])
  })

  async function openLists(t: TestContext, path: string) {
    let auth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    assert.ok(auth?.cookie, 'user session must be created')
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])
    let response = await page.goto(path)
    return { page, response }
  }

  it('opens a double-encoded row in the editor', async (t) => {
    let { page, response } = await openLists(t, `/lists?load=${encodedId}`)
    assert.equal(response?.status(), 200)
    await page.locator(`[data-lists-active-id="${encodedId}"]`).waitFor({ timeout: 15_000 })
    await page
      .locator('[data-item-id="a"]', { hasText: 'Encoded item' })
      .waitFor({ timeout: 15_000 })
  })

  it('drops non-object elements and renders the usable items', async (t) => {
    let { page, response } = await openLists(t, `/lists?load=${driftId}`)
    assert.equal(response?.status(), 200)
    await page.locator(`[data-lists-active-id="${driftId}"]`).waitFor({ timeout: 15_000 })
    await page.locator('[data-item-id="b"]', { hasText: 'Survivor' }).waitFor({ timeout: 15_000 })

    // `{"id":"c","label":42}` keeps its position but loses the non-string label.
    await page.locator('[data-item-id="c"]').waitFor({ timeout: 15_000 })
    assert.equal(
      await page.locator('[data-item-id]').count(),
      2,
      'only the two object elements should render',
    )
    assert.ok(
      !(await page.locator('body').innerText()).includes('junk'),
      'a primitive element must not reach the DOM',
    )
  })

  it('renders an object payload as an empty list', async (t) => {
    let { page, response } = await openLists(t, `/lists?load=${objectId}`)
    assert.equal(response?.status(), 200)
    await page.locator(`[data-lists-active-id="${objectId}"]`).waitFor({ timeout: 15_000 })
    assert.equal(await page.locator('[data-item-id]').count(), 0)
  })

  it('lists poisoned rows on the summary grid and the admin grid', async (t) => {
    let { page, response } = await openLists(t, `/lists?filter=${PREFIX}`)
    assert.equal(response?.status(), 200)
    let sidebarRows = page.locator('[data-list-id]')
    await sidebarRows.first().waitFor({ timeout: 15_000 })
    assert.equal(await sidebarRows.count(), 3, 'every poisoned row should appear in the sidebar')

    let admin = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(admin?.cookie, 'admin session must be created')
    let server = await createTestServer((request) => router.fetch(request))
    let adminPage = await t.serve(server)
    await adminPage
      .context()
      .addCookies([{ name: 'session', value: admin!.cookie.slice(8), url: server.baseUrl }])
    let adminResponse = await adminPage.goto(routes.admin.lists.index.href() + '?filter=' + PREFIX)
    assert.equal(adminResponse?.status(), 200)
    await adminPage.locator('[data-lists-table]').waitFor({ timeout: 15_000 })
    assert.equal(
      await adminPage.locator('[data-lists-table] tbody tr').count(),
      3,
      'the admin grid should render every poisoned row',
    )
  })
})
