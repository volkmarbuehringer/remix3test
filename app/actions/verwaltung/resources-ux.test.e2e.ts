import { describe, it, before, afterEach, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'

// ---------------------------------------------------------------------------
// /verwaltung/resources UX contracts that need a real browser:
//
// - live search: typing in the filter runs the GET form after a pause, narrows
//   the grid, and keeps focus in the field so typing can continue;
// - capability search: the grid matches the equipment text, not just the name
//   and short description the toolbar advertises;
// - the footer summary updates and is mirrored into the document-wide live
//   region after the frame swap;
// - opening a resource by clicking its name focuses the editor's first field,
//   and the filtered empty state can clear its own filter.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on `type: ["e2e"]`).
// ---------------------------------------------------------------------------

const TOKEN_PREFIX = 'test-ux-resource-'

describe('verwaltung resources: UX', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM resources WHERE name LIKE $1', [`${TOKEN_PREFIX}%`])
  })

  async function seed(
    rows: Array<{ name: string; description: string; capabilities?: string }>,
  ): Promise<void> {
    let now = Date.now()
    for (let [index, row] of rows.entries()) {
      await pool.query(
        `INSERT INTO resources (name, description, capabilities, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)`,
        [row.name, row.description, row.capabilities ?? '', now + index],
      )
    }
  }

  async function openResourcesPage(t: TestContext) {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.verwaltung.resources.index.href())
    await page.locator('[data-resources-table]').waitFor({ timeout: 15_000 })
    // Wait for the live-search entry before typing so keystrokes cannot land in
    // a dead field.
    await page
      .locator('form[data-resources-filter][data-filter-autosubmit-ready="true"]')
      .waitFor({ timeout: 15_000 })
    return page
  }

  it('filters by capability as you type and keeps focus in the search field', async (t) => {
    let token = `Ausstattung-${Date.now()}`
    await seed([
      {
        name: `${TOKEN_PREFIX}alpha`,
        description: 'Erster Raum für die Suche',
        capabilities: token,
      },
      {
        name: `${TOKEN_PREFIX}beta`,
        description: 'Zweiter Raum für die Suche',
        capabilities: 'Ausstattung: nur Stühle',
      },
    ])
    let page = await openResourcesPage(t)

    let input = page.locator('form[data-resources-filter] input[name="filter"]')
    await input.click()
    await input.pressSequentially(token, { delay: 20 })

    await page.waitForFunction(
      (expected) => new URL(location.href).searchParams.get('filter') === expected,
      token,
      { timeout: 15_000 },
    )
    await page.waitForFunction(
      () => {
        let rows = [...document.querySelectorAll('[data-resources-table] tbody tr')].map(
          (row) => row.textContent ?? '',
        )
        return (
          rows.some((text) => text.includes('alpha')) && !rows.some((text) => text.includes('beta'))
        )
      },
      undefined,
      { timeout: 15_000 },
    )

    assert.ok(
      await page.evaluate(() =>
        document.activeElement?.matches('form[data-resources-filter] input[name="filter"]'),
      ),
      'focus must stay in the search field so typing can continue after the reload',
    )

    // The frame swaps its whole content, so the document shell mirrors the
    // footer into a persistent status region for screen readers.
    await page.waitForFunction(
      () => {
        let info = document.querySelector('[data-pagination-info]')?.textContent?.trim()
        let status = document.querySelector('[data-grid-status]')?.textContent?.trim()
        return Boolean(info?.includes('von 1')) && status === info
      },
      undefined,
      { timeout: 15_000 },
    )
  })

  it('opens the editor from the resource name and clears a filtered empty state', async (t) => {
    await seed([
      {
        name: `${TOKEN_PREFIX}editor`,
        description: 'Ein Raum, der sich bearbeiten lässt',
      },
    ])
    let page = await openResourcesPage(t)

    let nameLink = page.locator(`[data-resources-table] a[title*="editor bearbeiten"]`)
    await nameLink.click()
    await page.locator('text=Ressource bearbeiten').waitFor({ timeout: 15_000 })
    // EditorAutofocus focuses the field during hydration, which can land after
    // the panel text is already in the DOM.
    await page.waitForFunction(
      () => document.activeElement?.matches('[data-editor-autofocus-field]'),
      undefined,
      { timeout: 15_000 },
    )
    assert.ok(
      await page.evaluate(() => document.activeElement?.matches('[data-editor-autofocus-field]')),
      'opening the editor should focus its first field',
    )

    await page.goto(routes.verwaltung.resources.index.href() + '?filter=zzz-no-such-resource')
    await page.locator('[data-resources-table]').waitFor({ timeout: 15_000 })
    await page.getByRole('link', { name: 'Filter zurücksetzen' }).click()
    await page.waitForFunction(
      () => !new URL(location.href).searchParams.get('filter'),
      undefined,
      {
        timeout: 15_000,
      },
    )
    await page.locator('[data-resources-table] tbody tr').first().waitFor({ timeout: 15_000 })
  })

  it('sends a too-short name to the server and shows the German inline error', async (t) => {
    let page = await openResourcesPage(t)

    await page.goto(routes.verwaltung.resources.index.href() + '?creating=true')
    await page.locator('[data-resources-table]').waitFor({ timeout: 15_000 })
    // EditorAutofocus focuses the first field once the panel has hydrated, so
    // this also waits for the frame runtime to own the submit.
    await page.waitForFunction(() => document.activeElement?.id === 'ar-c-name', undefined, {
      timeout: 15_000,
    })
    await page.locator('#ar-c-name').fill('X')
    await page.locator('#ar-c-desc').fill('Eine ausreichend lange Beschreibung')
    await page.getByRole('button', { name: 'Anlegen' }).click()

    // novalidate keeps the browser's locale bubble out of the way; the schema's
    // German message must be what the user sees.
    await page.getByText('Name muss mindestens 4 Zeichen lang sein').waitFor({ timeout: 15_000 })
  })
})
