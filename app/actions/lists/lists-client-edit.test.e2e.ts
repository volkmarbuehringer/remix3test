import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { createAuthCookieWithCsrfForUser, isFirefox } from '../../test-utils.ts'

// ---------------------------------------------------------------------------
// /lists editor behavior (client entry e2e).
//
// Covers the client-driven editing flows the data + controller tests cannot
// reach: creating a list through the "+ Liste hinzufügen" button (including the
// unsaved-draft lifecycle), autosave persistence after the debounce, the
// one-shot sort control, and the "Nur Erledigte löschen" action with its undo
// chip. All four mutate through the client entry, so they need a real browser
// to prove the hydration->save round trip.
//
// Like the sibling e2e files, `fill()` does not fire the remix `on('input')`
// handler, so text is typed with real keystrokes; mutations are driven through
// the always-visible header/toolbar controls (not the hover-reveal action
// cluster), and DB fixtures are seeded and removed by the test itself.
// ---------------------------------------------------------------------------

function itemsJson(rows: Array<{ id: string; label: string; done?: boolean }>): string {
  return JSON.stringify(rows)
}

async function listItems(
  listId: number,
): Promise<Array<{ id: string; label: string; done?: boolean }>> {
  let row = await pool.query('SELECT list FROM lists WHERE id = $1', [listId])
  return row.rows[0]!.list as Array<{ id: string; label: string; done?: boolean }>
}

async function readListTitle(listId: number): Promise<string | null> {
  let row = await pool.query('SELECT title FROM lists WHERE id = $1', [listId])
  return (row.rows[0]?.title as string | undefined) ?? null
}

// Ordered item ids as rendered by the editor (DOM order).
async function readItemIds(page: { evaluate: Function }): Promise<string[]> {
  return (await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-item-id]')).map((r) =>
      r.getAttribute('data-item-id'),
    ),
  )) as string[]
}

// Playwright's `fill()` does not fire the remix `on('input')` handler in this
// e2e environment, so the value must be typed with real keystrokes to mark the
// editor dirty (see lists-client-nav.test.e2e.ts).
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

// ---------------------------------------------------------------------------
// New-list creation through the "+ Liste hinzufügen" button.
// ---------------------------------------------------------------------------

describe('lists new-list creation', () => {
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

  it('creates a titled list via "+ Liste hinzufügen" and navigates to it', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

    await page.goto('/lists?new=1')
    await page.locator('#lists-title').waitFor({ timeout: 15_000 })

    // A brand-new list must never claim to be saved.
    assert.equal(
      await page.locator('span[role="status"]').innerText(),
      'Nicht gespeichert',
      'an unsaved new list must show the "Nicht gespeichert" pill',
    )

    let title = `Erstellt ${Date.now()}`
    await typeInto(page.locator('#lists-title'), title)

    // The create button is only valid once a name exists; the helper hint
    // flips to the ready state.
    await page.locator('button:has-text("+ Liste hinzufügen")').click()

    // The frame reloads onto /lists?load=<newId>; wait for the new list's title
    // to hydrate and the status pill to flip to saved.
    // The typed title is already in the input before the create POST resolves, so
    // waiting on it alone does not prove the frame reloaded. Wait for the saved
    // pill too, otherwise the assertion races the editor's re-hydration.
    await page.waitForFunction(
      (expected) => {
        let titleInput = document.querySelector('#lists-title') as HTMLInputElement | null
        let pill = document.querySelector('span[role="status"]')
        return titleInput?.value === expected && pill?.textContent?.trim() === 'Gespeichert'
      },
      title,
      { timeout: 15_000 },
    )
    assert.equal(
      await page.locator('span[role="status"]').innerText(),
      'Gespeichert',
      'a created list must show the "Gespeichert" pill',
    )

    // The row must exist in the database and show up in the sidebar.
    let rows = (
      await pool.query('SELECT id FROM lists WHERE user_id = $1 AND title = $2', [
        adminUserId,
        title,
      ])
    ).rows as { id: number }[]
    assert.equal(rows.length, 1, 'exactly one list row must be created')
    let newId = Number(rows[0]!.id)
    try {
      await page.locator(`[data-list-id="${newId}"]`).waitFor({ timeout: 15_000 })
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [newId])
    }
  })

  it('restores an unsaved new-list draft after navigating away and discards it', async (t) => {
    let now = Date.now()
    let seeded = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, `Draft target ${now}`, '', '[]', now],
    )
    let targetId = Number(seeded.rows[0]!.id as number)
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.goto('/lists?new=1')
      await page.locator('#lists-title').waitFor({ timeout: 15_000 })

      let draftTitle = `Entwurf ${Date.now()}`
      await typeInto(page.locator('#lists-title'), draftTitle)

      // Leave the draft behind by opening a real list.
      await page.locator(`[data-list-id="${targetId}"] a`).click()
      await page.waitForFunction(
        (expected) =>
          (document.querySelector('#lists-title') as HTMLInputElement)?.value === expected,
        `Draft target ${now}`,
        { timeout: 15_000 },
      )

      // Return to a fresh new list: the draft must come back with the banner.
      await page.locator('a[href*="new=1"]').first().click()
      await page.getByText('Ein ungespeicherter Entwurf wurde wiederhergestellt.').waitFor({
        timeout: 15_000,
      })

      // The restored title must be pushed into the uncontrolled title input.
      let restored = ''
      for (let attempt = 0; attempt < 60 && restored !== draftTitle; attempt++) {
        restored = await page.inputValue('#lists-title')
        if (restored !== draftTitle) await page.waitForTimeout(250)
      }
      assert.equal(restored, draftTitle, 'the unsaved draft title must be restored')

      // Discarding resets the editor to a clean empty new list.
      await page.locator('button:has-text("Entwurf verwerfen")').click()
      assert.equal(await page.inputValue('#lists-title'), '', 'discarding must clear the title')
      assert.equal(
        await page.locator('button:has-text("Entwurf verwerfen")').count(),
        0,
        'the draft banner must disappear after discarding',
      )
      assert.equal(
        await page.locator('span[role="status"]').innerText(),
        'Nicht gespeichert',
        'a discarded draft returns to the clean new-list state',
      )
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [targetId])
    }
  })
})

// ---------------------------------------------------------------------------
// Autosave persistence after the 1.5s debounce.
// ---------------------------------------------------------------------------

describe('lists autosave persistence', () => {
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

  it('persists a typed title after the autosave debounce', async (t) => {
    let now = Date.now()
    let seeded = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, `Autosave ${now}`, '', '[]', now],
    )
    let listId = Number(seeded.rows[0]!.id as number)
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.goto(`/lists?load=${listId}`)
      await page.waitForFunction(
        (expected) =>
          (document.querySelector('#lists-title') as HTMLInputElement)?.value === expected,
        `Autosave ${now}`,
        { timeout: 15_000 },
      )

      let marker = `Autosave ${Date.now()}`
      await typeInto(page.locator('#lists-title'), marker)

      let persisted: string | null = null
      for (let attempt = 0; attempt < 40 && persisted !== marker; attempt++) {
        await page.waitForTimeout(250)
        persisted = await readListTitle(listId)
      }
      assert.equal(persisted, marker, 'the typed title must autosave after the debounce')
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
    }
  })

  it('persists an item added via Enter after the autosave debounce', async (t) => {
    let now = Date.now()
    let seeded = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [adminUserId, `Autosave item ${now}`, '', '[]', now],
    )
    let listId = Number(seeded.rows[0]!.id as number)
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.goto(`/lists?load=${listId}`)
      await page.locator('#lists-title').waitFor({ timeout: 15_000 })

      let label = `autosave item ${Date.now()}`
      let newItem = page.locator('textarea[placeholder="Neues Element eingeben…"]')
      await newItem.waitFor({ timeout: 15_000 })
      await newItem.click()
      await newItem.pressSequentially(label, { delay: 10 })
      await newItem.press('Enter')

      // The item must appear in the rendered list and then survive autosave.
      await page.locator('[data-item-id]', { hasText: label }).waitFor({ timeout: 15_000 })
      let items = await listItems(listId)
      for (let attempt = 0; attempt < 40 && items.length !== 1; attempt++) {
        await page.waitForTimeout(250)
        items = await listItems(listId)
      }
      assert.equal(items.length, 1, 'the added item must autosave into the database')
      assert.equal(items[0]!.label, label)
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
    }
  })
})

// ---------------------------------------------------------------------------
// One-shot sort control ("Sortieren…" → A–Z).
// ---------------------------------------------------------------------------

describe('lists sort control', () => {
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

  it('reorders items A–Z, offers undo, and persists the new order', async (t) => {
    let now = Date.now()
    let seeded = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [
        adminUserId,
        `Sort ${now}`,
        '',
        itemsJson([
          { id: 'sort-b', label: 'Bravo' },
          { id: 'sort-a', label: 'Alpha' },
          { id: 'sort-c', label: 'Charlie' },
        ]),
        now,
      ],
    )
    let listId = Number(seeded.rows[0]!.id as number)
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.goto(`/lists?load=${listId}`)
      await page.waitForFunction(
        () => document.querySelectorAll('[data-item-id]').length === 3,
        undefined,
        { timeout: 15_000 },
      )

      // Seed order is insertion order.
      assert.deepEqual(await readItemIds(page), ['sort-b', 'sort-a', 'sort-c'])

      // Drive the native <select> with Playwright's selectOption. This reaches
      // the remix `on('change')` handler in Chromium, but in Firefox a synthetic
      // change on a native select does not reach the handler (the same family of
      // Playwright synthetic-event unreliability the sibling e2e files document),
      // so this behavior is scoped to Chromium only.
      if (isFirefox(page)) {
        // Firefox smoke check: the sort control still renders; the reorder
        // mutation itself stays covered by the chromium project and the
        // lists-state unit tests.
        assert.ok((await page.locator('select[aria-label="Sortieren"]').count()) === 1)
        return
      }
      await page.selectOption('select[aria-label="Sortieren"]', 'az')

      // The client reorders the rendered rows and raises the undo chip. Retry
      // the interaction until the reorder registers — the change listener is
      // attached by the client entry's render pass, and a selectOption that
      // lands in the hydration gap is a silent no-op (see `selectItems`).
      let domIds = await readItemIds(page)
      for (
        let attempt = 0;
        attempt < 60 && domIds.join(',') !== 'sort-a,sort-b,sort-c';
        attempt++
      ) {
        await page.waitForTimeout(250)
        domIds = await readItemIds(page)
        if (domIds.join(',') !== 'sort-a,sort-b,sort-c') {
          await page.selectOption('select[aria-label="Sortieren"]', 'az')
        }
      }
      assert.deepEqual(domIds, ['sort-a', 'sort-b', 'sort-c'], 'A–Z must reorder the rows by label')
      assert.ok((await page.locator('button:has-text("Rückgängig")').count()) === 1)
      assert.ok((await page.getByText('Reihenfolge geändert.').count()) >= 1)

      // The reorder is a real mutation: it autosaves into the database.
      let items = await listItems(listId)
      for (
        let attempt = 0;
        attempt < 40 && items.map((i) => i.id).join(',') !== 'sort-a,sort-b,sort-c';
        attempt++
      ) {
        await page.waitForTimeout(250)
        items = await listItems(listId)
      }
      assert.deepEqual(
        items.map((i) => i.id),
        ['sort-a', 'sort-b', 'sort-c'],
        'the sorted order must autosave into the database',
      )
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
    }
  })
})

// ---------------------------------------------------------------------------
// "Nur Erledigte löschen" with its undo chip.
// ---------------------------------------------------------------------------

describe('lists clear-completed with undo', () => {
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

  it('removes completed items and restores them via the undo chip', async (t) => {
    let now = Date.now()
    let seeded = await pool.query(
      'INSERT INTO lists (user_id, title, description, list, created_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $5) RETURNING id',
      [
        adminUserId,
        `Clear done ${now}`,
        '',
        itemsJson([
          { id: 'cd-done', label: 'Erledigter Eintrag', done: true },
          { id: 'cd-open', label: 'Offener Eintrag' },
        ]),
        now,
      ],
    )
    let listId = Number(seeded.rows[0]!.id as number)
    try {
      let server = await createTestServer((request) => router.fetch(request))
      let page = await t.serve(server)
      await page
        .context()
        .addCookies([{ name: 'session', value: adminCookie.slice(8), url: server.baseUrl }])

      await page.goto(`/lists?load=${listId}`)
      await page.waitForFunction(
        () => document.querySelectorAll('[data-item-id]').length === 2,
        undefined,
        { timeout: 15_000 },
      )

      await page.locator('summary[aria-label="Weitere Aktionen"]').click()
      await page.locator('button:has-text("Nur Erledigte löschen")').click()

      // The done row is removed; the open row survives.
      assert.deepEqual(await readItemIds(page), ['cd-open'])
      assert.ok((await page.locator('button:has-text("Rückgängig")').count()) === 1)
      assert.ok((await page.getByText('Erledigte Elemente gelöscht.').count()) >= 1)

      // Undo restores both rows in the original order.
      await page.locator('button:has-text("Rückgängig")').click()
      assert.deepEqual(
        await readItemIds(page),
        ['cd-done', 'cd-open'],
        'undo must restore the completed row at its original position',
      )
      assert.equal(
        await page.locator('button:has-text("Rückgängig")').count(),
        0,
        'the undo chip must dismiss after undoing',
      )

      // Undo is itself a mutation: the restored rows autosave back to the DB.
      let items = await listItems(listId)
      for (let attempt = 0; attempt < 40 && items.length !== 2; attempt++) {
        await page.waitForTimeout(250)
        items = await listItems(listId)
      }
      assert.deepEqual(
        items.map((i) => i.id),
        ['cd-done', 'cd-open'],
        'the undone rows must autosave back into the database',
      )
      assert.equal(items[0]!.done, true, 'the restored row must keep its done flag')
    } finally {
      await pool.query('DELETE FROM lists WHERE id = $1', [listId])
    }
  })
})
