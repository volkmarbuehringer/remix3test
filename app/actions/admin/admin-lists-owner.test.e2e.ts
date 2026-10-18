import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'

// The Besitzer column is the only cross-user visibility into `lists`. It must
// render inside the grid and drill into the users grid filtered by that email.
// The link is a document navigation (`data-rmx-document`) on purpose: an
// in-frame one reuses the users filter input DOM node, so the input would keep
// the lists page's text while the grid filtered by the owner — see
// .opencode/skills/learned/remix3-ui/references/remix3-frame-cliententry/
// frame-layout-and-testing.md ("Frame Input Value Preservation"). The
// assertions below pin both halves of the contract: the rows are filtered AND
// the input echoes the applied filter. Seed rows are tagged
// `test-admin-owner-e2e`; `after` deletes them by that prefix so a crash
// between before/test cannot leak rows into the DB.
describe('admin lists owner column', () => {
  before(async () => {
    await initializeAppDatabase()
    let now = Date.now()
    let owner = await pool.query("SELECT id FROM users WHERE email = 'user@newapp.com'")
    let ownerId = owner.rows[0]?.id as number
    assert.ok(ownerId, 'seed user user@newapp.com must exist')
    await pool.query(
      `INSERT INTO lists (user_id, title, description, list, created_at, updated_at)
       VALUES ($1, 'Owned E2E Row', 'test-admin-owner-e2e-owned', '[]'::jsonb, $2, $2),
              (NULL, 'Unowned E2E Row', 'test-admin-owner-e2e-unowned', '[]'::jsonb, $2, $2)`,
      [ownerId, now],
    )
  })

  after(async () => {
    await pool.query("DELETE FROM lists WHERE description LIKE 'test-admin-owner-e2e%'")
  })

  it('drills from an owner into the filtered users grid', async (t) => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.admin.lists.index.href() + '?filter=test-admin-owner-e2e')
    await page.locator('[data-lists-table]').waitFor({ timeout: 15_000 })

    let ownerLink = page.locator('a', { hasText: 'user@newapp.com' }).first()
    await ownerLink.waitFor({ timeout: 15_000 })
    assert.equal(
      await page.locator('text=Kein Besitzer').first().isVisible(),
      true,
      'unowned list must be marked in the grid',
    )

    await ownerLink.click()
    await page.locator('[data-users-table]').waitFor({ timeout: 15_000 })

    let filterValue = await page.locator('input[name="filter"]').inputValue()
    assert.equal(
      filterValue,
      'user@newapp.com',
      'the users filter input must echo the applied owner filter',
    )

    let rows = await page.locator('[data-users-table] tbody tr').allInnerTexts()
    assert.ok(
      rows.some((text) => text.includes('user@newapp.com')),
      'the users grid should list the owner after the drill-down',
    )
    assert.ok(
      !rows.some((text) => text.includes('admin@newapp.com')),
      'the users grid should be filtered to the owner’s email only',
    )
  })
})
