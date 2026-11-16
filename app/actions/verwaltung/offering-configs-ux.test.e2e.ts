import { describe, it, before, afterEach, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'

// ---------------------------------------------------------------------------
// /verwaltung/offering-configs UX contracts that need a real browser:
//
// - live search: typing in the filter runs the GET form after a pause, keeps the
//   active sort, narrows the grid, and leaves the caret in the field;
// - week presets: "Mo–Fr" checks exactly the workdays and "Zeiten übertragen"
//   copies the first active day's hours to the rest, then the server stores the
//   whole week;
// - a filtered empty state can clear its own filter;
// - a form-level validation error renders inside the panel and receives focus.
//
// Requires a running PostgreSQL database (global test setup) and a Playwright
// browser. Runs as CI-only (gated on type: ["e2e"]).
// ---------------------------------------------------------------------------

const TOKEN_PREFIX = 'test-ux-config-'

describe('verwaltung offering configs: UX', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query(
      'DELETE FROM offering_configs WHERE resource_id IN (SELECT id FROM resources WHERE name LIKE $1)',
      [TOKEN_PREFIX + '%'],
    )
    await pool.query('DELETE FROM resources WHERE name LIKE $1', [TOKEN_PREFIX + '%'])
  })

  async function seedResource(name: string, description: string): Promise<number> {
    let now = Date.now()
    let result = await pool.query(
      'INSERT INTO resources (name, description, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, description, now, now],
    )
    return result.rows[0].id as number
  }

  async function seedConfig(
    resourceId: number,
    rules: Record<string, [number, number]>,
  ): Promise<void> {
    let now = Date.now()
    await pool.query(
      'INSERT INTO offering_configs (resource_id, rules, created_at, updated_at) VALUES ($1, $2::jsonb, $3, $3)',
      [resourceId, JSON.stringify(rules), now],
    )
  }

  /**
   * Loads the grid. With an inline panel open the toolbar's live search is
   * intentionally not mounted (a reload would discard the edits), so that case
   * waits for the panel's own hydration marker instead.
   */
  async function openConfigsPage(t: TestContext, query = '', opts: { panel?: boolean } = {}) {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)
    await page
      .context()
      .addCookies([{ name: 'session', value: auth!.cookie.slice(8), url: server.baseUrl }])

    await page.goto(routes.verwaltung.offeringConfigs.index.href() + query)
    await page.locator('[data-offering-configs-table]').waitFor({ timeout: 15_000 })
    if (opts.panel) {
      await page.locator('form [data-week-presets-ready="true"]').waitFor({ timeout: 15_000 })
    } else {
      // Wait for the live-search entry before typing so keystrokes cannot land
      // in a dead field.
      await page
        .locator('form[data-offering-configs-filter][data-filter-autosubmit-ready="true"]')
        .waitFor({ timeout: 15_000 })
    }
    return page
  }

  it('filters as you type, keeps the sort and the caret in the search field', async (t) => {
    let token = 'Suchraum-' + Date.now()
    let hit = await seedResource(TOKEN_PREFIX + token, 'Raum für die Suche')
    let miss = await seedResource(TOKEN_PREFIX + 'daneben', 'Anderer Raum')
    await seedConfig(hit, { monday: [480, 1020] })
    await seedConfig(miss, { tuesday: [480, 1020] })

    let page = await openConfigsPage(t, '?sort=updated_at&order=desc')

    let input = page.locator('form[data-offering-configs-filter] input[name="filter"]')
    await input.click()
    await input.pressSequentially(token, { delay: 20 })

    await page.waitForFunction(
      (expected) => new URL(location.href).searchParams.get('filter') === expected,
      token,
      { timeout: 15_000 },
    )

    // The search must not silently reset the sort the user chose.
    assert.equal(
      await page.evaluate(() => new URL(location.href).searchParams.get('sort')),
      'updated_at',
      'searching must preserve the active sort column',
    )
    assert.equal(
      await page.evaluate(() => new URL(location.href).searchParams.get('order')),
      'desc',
      'searching must preserve the active sort direction',
    )

    await page.waitForFunction(
      (needle) => {
        let rows = [...document.querySelectorAll('[data-offering-configs-table] tbody tr')].map(
          (row) => row.textContent ?? '',
        )
        return rows.some((text) => text.includes(needle)) && rows.length === 1
      },
      token,
      { timeout: 15_000 },
    )

    assert.ok(
      await page.evaluate(() =>
        document.activeElement?.matches('form[data-offering-configs-filter] input[name="filter"]'),
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
    let resourceId = await seedResource(TOKEN_PREFIX + 'Editor', 'Ein Raum zum Bearbeiten')
    await seedConfig(resourceId, { monday: [480, 1020] })

    let page = await openConfigsPage(t, '?filter=' + TOKEN_PREFIX + 'Editor')

    let nameLink = page.locator('[data-offering-configs-table] a[title*="bearbeiten"]').first()
    await nameLink.click()
    await page.locator('text=Konfiguration bearbeiten').waitFor({ timeout: 15_000 })
    // EditorAutofocus focuses the first field during hydration, which can land
    // after the panel text is already in the DOM.
    await page.waitForFunction(
      () => document.activeElement?.matches('[data-editor-autofocus-field]'),
      undefined,
      { timeout: 15_000 },
    )

    await page.goto(routes.verwaltung.offeringConfigs.index.href() + '?filter=zzz-no-such-config')
    await page.locator('[data-offering-configs-table]').waitFor({ timeout: 15_000 })
    await page.getByRole('link', { name: 'Filter zurücksetzen' }).click()
    await page.waitForFunction(
      () => !new URL(location.href).searchParams.get('filter'),
      undefined,
      { timeout: 15_000 },
    )
    await page
      .locator('[data-offering-configs-table] tbody tr')
      .first()
      .waitFor({ timeout: 15_000 })
  })

  it('applies the Mo–Fr preset, copies the hours and saves the whole week', async (t) => {
    let resourceId = await seedResource(TOKEN_PREFIX + 'Preset', 'Raum für die Schnellauswahl')
    let page = await openConfigsPage(t, '?creating=true', { panel: true })

    await page.locator('select[name="resource_id"]').selectOption(String(resourceId))

    // Monday is the template: 09:00–12:00, then the whole workweek copies it.
    await page.locator('select[name="monday_start"]').selectOption('540')
    await page.locator('select[name="monday_end"]').selectOption('720')
    await page.getByRole('button', { name: 'Mo–Fr' }).click()
    await page.getByRole('button', { name: 'Zeiten übertragen' }).click()

    assert.equal(
      await page.locator('form [data-week-day] input[type="checkbox"]:checked').count(),
      5,
      'the Mo–Fr preset must check exactly the five workdays',
    )
    assert.equal(await page.locator('select[name="tuesday_start"]').inputValue(), '540')
    assert.equal(await page.locator('select[name="tuesday_end"]').inputValue(), '720')
    assert.equal(await page.locator('select[name="friday_start"]').inputValue(), '540')
    assert.equal(
      await page.locator('select[name="saturday_start"]').inputValue(),
      '480',
      'inactive days must not receive the copied hours',
    )

    await page.getByRole('button', { name: 'Anlegen' }).click()
    await page.waitForFunction(
      () => new URL(location.href).searchParams.get('editing') !== null,
      undefined,
      { timeout: 15_000 },
    )

    let stored = await pool.query('SELECT rules FROM offering_configs WHERE resource_id = $1', [
      resourceId,
    ])
    assert.equal(stored.rows.length, 1, 'the configuration must be saved')
    let rules = stored.rows[0].rules as Record<string, [number, number]>
    for (let day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const) {
      assert.deepEqual(rules[day], [540, 720], day + ' must store the copied hours')
    }
    assert.equal(rules.saturday, undefined, 'an inactive Saturday must not be stored')

    await page.goto(routes.verwaltung.offeringConfigs.index.href() + '?filter=Preset')
    await page.locator('[data-offering-configs-table]').waitFor({ timeout: 15_000 })
    await page.waitForFunction(
      () => document.querySelector('[data-offering-configs-table]')?.textContent?.includes('Mo'),
      undefined,
      { timeout: 15_000 },
    )
    assert.ok(
      (await page.locator('[data-offering-configs-table]').textContent())?.includes(
        'Mo–Fr 09:00–12:00',
      ),
      'the grid must group the saved week into one readable range',
    )
  })

  it('shows the form-level error inside the panel and focuses it', async (t) => {
    let resourceId = await seedResource(TOKEN_PREFIX + 'OhneTag', 'Ohne Wochentag')
    let page = await openConfigsPage(t, '?creating=true', { panel: true })

    await page.locator('select[name="resource_id"]').selectOption(String(resourceId))
    await page.getByRole('button', { name: 'Anlegen' }).click()

    let banner = page.locator('[data-form-error]')
    await banner.waitFor({ timeout: 15_000 })
    assert.ok(
      (await banner.textContent())?.includes('Mindestens ein Tag muss einen Zeitraum haben'),
      'the German form-level message must be shown',
    )
    await page.waitForFunction(
      () => document.activeElement?.matches('[data-form-error]'),
      undefined,
      { timeout: 15_000 },
    )
  })
})
