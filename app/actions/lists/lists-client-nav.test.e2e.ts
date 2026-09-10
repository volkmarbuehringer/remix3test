import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'

// ---------------------------------------------------------------------------
// /lists navigation UX (client entry e2e).
//
// Two regressions this guards:
//
// 1. The title/description fields are uncontrolled, so after the user types in
//    them `defaultValue`/child-text hydration is ignored by the DOM. Switching
//    to another list therefore kept showing the *previous* list's title and
//    description — a stale header that could be written into the newly opened
//    list on the next keystroke.
//
// 2. `beforeunload` never fires for a frame navigation, so switching list (or
//    searching / paginating) inside the 1.5s autosave debounce silently
//    discarded the pending edit. A `reloadStart` keepalive flush now saves it to
//    the *outgoing* list before the frame swaps content.
// ---------------------------------------------------------------------------

describe('lists frame navigation', () => {
  let adminCookie: string
  let adminUserId: number

  before(async () => {
    await initializeAppDatabase()

    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')
    adminCookie = auth!.cookie

    let userRows = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com']))
      .rows as { id: number }[]
    assert.ok(userRows.length > 0, 'admin user must exist')
    adminUserId = Number(userRows[0]!.id)
  })

  // Seed a distinct A/B pair per test so the freshly touched rows sort to the
  // front of the updated_at-ordered sidebar and never leak between tests.
  async function seedPair(suffix: string) {
    let now = Date.now()
    let items = JSON.stringify([{ id: `nav-${suffix}`, label: `Element ${suffix}` }])
    let insert = async (title: string, description: string) => {
      let result = await pool.query(
        'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
        [adminUserId, title, description, items, now],
      )
      return Number(result.rows[0]!.id as number)
    }
    let a = await insert(`Nav A ${suffix}`, `Beschreibung A ${suffix}`)
    let b = await insert(`Nav B ${suffix}`, `Beschreibung B ${suffix}`)
    return { a, b }
  }

  async function cleanup(...ids: number[]) {
    for (let id of ids) await pool.query('DELETE FROM lists WHERE id = $1', [id])
  }

  async function readTitle(listId: number): Promise<string | null> {
    let row = await pool.query('SELECT title FROM lists WHERE id = $1', [listId])
    return (row.rows[0]?.title as string | undefined) ?? null
  }

  // Playwright's `fill()` does not fire the remix `on('input')` handler in this
  // e2e environment (see lists-client-importmap.test.e2e.ts), so the value must
  // be typed with real keystrokes to mark the editor dirty.
  async function typeInto(
    field: {
      click: () => Promise<void>
      press: (key: string) => Promise<void>
      pressSequentially: (text: string, options: { delay: number }) => Promise<void>
    },
    value: string,
  ) {
    await field.click()
    await field.press('Control+a')
    await field.pressSequentially(value, { delay: 5 })
  }

  it('shows the opened list title/description after switching away from an edited list', async (t) => {
    let { a, b } = await seedPair('sync')
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.goto(`/lists?load=${a}`)
      await page.locator(`[data-list-id="${b}"]`).waitFor({ timeout: 15_000 })
      // Wait for hydration: the frame swaps in list A's title.
      await page.waitForFunction(
        (expected) =>
          (document.querySelector('#lists-title') as HTMLInputElement)?.value === expected,
        `Nav A sync`,
        { timeout: 15_000 },
      )

      // Dirty both fields so their DOM values become user-owned (the stale case).
      await typeInto(page.locator('#lists-title'), 'Zwischenstand')
      await typeInto(page.locator('#lists-description'), 'Zwischenstand Beschreibung')

      // Switch to B and wait for the frame to hydrate B's own state.
      await page.click(`[data-list-id="${b}"] a`)
      await page.waitForFunction(
        (expected) =>
          (document.querySelector('#lists-title') as HTMLInputElement)?.value === expected,
        `Nav B sync`,
        { timeout: 15_000 },
      )

      assert.equal(await page.inputValue('#lists-title'), 'Nav B sync')
      assert.equal(await page.inputValue('#lists-description'), 'Beschreibung B sync')
    } finally {
      await cleanup(a, b)
    }
  })

  it('flushes a pending edit to the outgoing list before navigating away', async (t) => {
    let { a, b } = await seedPair('flush')
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.goto(`/lists?load=${a}`)
      await page.locator(`[data-list-id="${b}"]`).waitFor({ timeout: 15_000 })
      await page.waitForFunction(
        (expected) =>
          (document.querySelector('#lists-title') as HTMLInputElement)?.value === expected,
        `Nav A flush`,
        { timeout: 15_000 },
      )

      // Type and switch immediately — well inside the 1.5s autosave debounce, so
      // only the reloadStart flush can persist this.
      let marker = `Flush ${Date.now()}`
      await typeInto(page.locator('#lists-title'), marker)
      await page.click(`[data-list-id="${b}"] a`)

      // The navigation completed once B's own title is showing; the marker must
      // then have been written to A.
      await page.waitForFunction(
        (expected) =>
          (document.querySelector('#lists-title') as HTMLInputElement)?.value === expected,
        `Nav B flush`,
        { timeout: 15_000 },
      )
      let persisted: string | null = null
      for (let attempt = 0; attempt < 40 && persisted !== marker; attempt++) {
        persisted = await readTitle(a)
        if (persisted !== marker) await page.waitForTimeout(250)
      }
      assert.equal(persisted, marker, 'the pending edit must be flushed to the outgoing list')
    } finally {
      await cleanup(a, b)
    }
  })
})
