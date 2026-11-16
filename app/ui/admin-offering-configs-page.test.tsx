import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'

import { AdminOfferingConfigsPage } from './admin-offering-configs-page.tsx'
import type {
  OfferingConfigRow,
  OfferingConfigResourceOption,
} from '../data/offering-configs-queries.ts'
import { PAGE_SIZE_KEYS } from '../utils/get-page-size.ts'

// ---------------------------------------------------------------------------
// Server-rendered markup contracts for the offering-configs page.
//
// The controller tests cover search, validation and persistence; this file pins
// the grid/panel markup that has no database dependency: the grouped weekly
// summary in weekday order, the result footer, the sortable header state, and
// the create-panel empty state when every resource is already configured.
// ---------------------------------------------------------------------------

type PageProps = Parameters<typeof AdminOfferingConfigsPage>[0]['props']

const BASE_PROPS: PageProps = {
  rows: [],
  total: 0,
  offset: 0,
  hasMore: false,
  prevOffset: 0,
  nextOffset: 15,
  pageKey: PAGE_SIZE_KEYS.verwaltungOfferingConfigs,
  pageSizeOverride: null,
  sortColumn: 'id',
  sortDirection: 'asc',
  filter: undefined,
  resources: [],
}

function row(overrides: Partial<OfferingConfigRow> = {}): OfferingConfigRow {
  return {
    id: 7,
    resource_id: 3,
    resource_name: 'Werkraum',
    resource_description: 'Werkstatt mit Werkbank',
    rules: {},
    created_at: 1_700_000_000_000,
    updated_at: 1_700_000_000_000,
    ...overrides,
  }
}

function resource(
  overrides: Partial<OfferingConfigResourceOption> = {},
): OfferingConfigResourceOption {
  return {
    id: 3,
    name: 'Werkraum',
    description: 'Werkstatt mit Werkbank',
    has_config: false,
    ...overrides,
  }
}

describe('AdminOfferingConfigsPage markup', () => {
  it('groups the week by weekday regardless of the stored key order', async () => {
    let html = await renderToString(
      <AdminOfferingConfigsPage
        {...BASE_PROPS}
        rows={[
          row({
            // JSONB hands the keys back in length/byte order; the summary must
            // still read Monday to Sunday.
            rules: {
              friday: [480, 1020],
              monday: [480, 1020],
              wednesday: [480, 1020],
              tuesday: [480, 1020],
              thursday: [480, 1020],
            },
          }),
        ]}
        total={1}
      />,
    )

    assert.ok(html.includes('Mo–Fr 08:00–17:00'), 'equal days must collapse into one range')
    assert.ok(html.includes('5 Tage'), 'the meta line must report the active day count')
    assert.ok(html.includes('45 Std./Woche'), 'the meta line must report the weekly hours')
    assert.ok(
      html.includes('title="Mo 08:00–17:00, Di 08:00–17:00'),
      'the full per-day list must be available as a tooltip in weekday order',
    )
    assert.ok(html.includes('Zeige 1–1 von 1'), 'the footer must show range and total')
    assert.ok(html.includes('Seite 1'), 'the footer must show the current page')
  })

  it('exposes the sort state and row actions to assistive tech', async () => {
    let html = await renderToString(
      <AdminOfferingConfigsPage
        {...BASE_PROPS}
        rows={[row()]}
        total={1}
        sortColumn="updated_at"
        sortDirection="desc"
      />,
    )

    assert.ok(html.includes('aria-sort="descending"'), 'the sorted column must be announced')
    assert.ok(html.includes('scope="col"'), 'header cells must declare their scope')
    assert.ok(html.includes('Angebotskonfigurationen</caption>'), 'the table needs a caption')
    assert.ok(
      html.includes('aria-label="Werkraum bearbeiten"'),
      'the edit control must name its row',
    )
    assert.ok(
      html.includes('Konfiguration für „Werkraum“ wirklich löschen?'),
      'the delete confirmation must name the resource',
    )
    assert.ok(html.includes('data-offering-configs-filter'), 'the toolbar form must stay marked')
  })

  it('replaces the create form with a notice when every resource is configured', async () => {
    let html = await renderToString(
      <AdminOfferingConfigsPage
        {...BASE_PROPS}
        creating
        resources={[resource({ has_config: true })]}
      />,
    )

    assert.ok(
      html.includes('Alle Ressourcen haben bereits eine Konfiguration'),
      'the panel must explain why there is nothing to create',
    )
    assert.ok(
      !html.includes('name="resource_id"'),
      'a select whose every option is disabled must not be offered',
    )
    assert.ok(html.includes('Ressourcen verwalten'), 'the notice must link to the resources grid')
  })

  it('marks configured resources as unavailable in the edit panel', async () => {
    let html = await renderToString(
      <AdminOfferingConfigsPage
        {...BASE_PROPS}
        editRow={row()}
        resources={[
          resource({ id: 3, name: 'Werkraum', has_config: true }),
          resource({ id: 4, name: 'Belegt', has_config: true }),
          resource({ id: 5, name: 'Frei', has_config: false }),
        ]}
      />,
    )

    assert.ok(html.includes('Belegt — bereits konfiguriert'), 'an unavailable option must say why')
    assert.match(html, /<option value="4"[^>]*disabled/, 'an unavailable option must be disabled')
    assert.ok(
      !/<option value="3"[^>]*disabled/.test(html),
      'the row being edited must stay selectable',
    )
    assert.ok(!/<option value="5"[^>]*disabled/.test(html), 'a free resource must stay selectable')
  })
})
