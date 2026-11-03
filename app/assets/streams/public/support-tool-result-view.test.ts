import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { describeSupportToolResult } from './support-tool-result-view.ts'

describe('describeSupportToolResult', () => {
  it('suppresses tool-discovery plumbing', () => {
    assert.deepEqual(
      describeSupportToolResult('search_tools', {
        results: [{ name: 'get_offerings_for_date' }],
        loaded: ['get_offerings_for_date'],
      }),
      { kind: 'skip' },
    )
    assert.deepEqual(describeSupportToolResult('load_tool', { loaded: true }), { kind: 'skip' })
  })

  it('suppresses acknowledgement and unknown payloads instead of dumping JSON', () => {
    assert.deepEqual(describeSupportToolResult('some_tool', { success: true }), { kind: 'skip' })
    assert.deepEqual(describeSupportToolResult('count_users', { count: 42 }), { kind: 'skip' })
    assert.deepEqual(describeSupportToolResult('some_tool', { anything: 'raw machine payload' }), {
      kind: 'skip',
    })
  })

  it('formats weather results as a readable note', () => {
    let view = describeSupportToolResult('get_weather', {
      location: 'Frankfurt am Main, Germany',
      temperature: 9,
      condition: 'Partly cloudy',
      humidity: 54,
      windSpeed: 14,
    })
    assert.equal(view.kind, 'note')
    if (view.kind !== 'note') return
    assert.ok(view.text.includes('Frankfurt am Main'))
    assert.ok(view.text.includes('9 °C'))
    assert.ok(view.text.includes('54 %'))
    assert.ok(!view.text.includes('{'), 'no raw JSON braces')
    assert.ok(!view.text.includes('location'), 'no raw field names')
  })

  it('formats date/time results as the localized timestamp', () => {
    assert.deepEqual(
      describeSupportToolResult('get_current_date_time', {
        iso: '2026-11-03T14:16:19.827Z',
        formatted: 'Dienstag, 3. November 2026 um 15:16 MEZ',
      }),
      { kind: 'note', text: '🕒 Dienstag, 3. November 2026 um 15:16 MEZ' },
    )
  })

  it('renders an empty collection as a clear empty state', () => {
    assert.deepEqual(
      describeSupportToolResult('get_offerings_for_date', {
        date: '2026-11-03',
        count: 0,
        offerings: [],
      }),
      { kind: 'empty', text: '✅ Keine Ergebnisse gefunden.' },
    )
  })

  it('renders a non-empty collection as a bounded table', () => {
    let rows = Array.from({ length: 25 }, (_, id) => ({ id, name: `Raum ${id}` }))
    let view = describeSupportToolResult('list_resources', { count: 25, resources: rows })
    assert.equal(view.kind, 'table')
    if (view.kind !== 'table') return
    assert.deepEqual(view.columns, ['id', 'name'])
    assert.equal(view.rows.length, 20, 'render at most 20 rows')
  })

  it('renders a detail card and JSON-stringifies nested values', () => {
    let view = describeSupportToolResult('get_offering_config_for_resource', {
      found: true,
      config: {
        id: 1,
        resourceId: 1,
        rules: { monday: [540, 1020] },
        createdAt: 1784899220732,
      },
    })
    assert.equal(view.kind, 'detail')
    if (view.kind !== 'detail') return
    let rules = view.entries.find((entry) => entry.label === 'rules')
    assert.equal(rules?.value, '{"monday":[540,1020]}', 'nested objects are not [object Object]')
    assert.ok(!view.entries.some((entry) => entry.value.includes('[object Object]')))
  })

  it('renders a found=false message as a readable note', () => {
    assert.deepEqual(
      describeSupportToolResult('lookup_user', {
        found: false,
        message: 'No user found matching that query',
      }),
      { kind: 'note', text: 'No user found matching that query' },
    )
  })

  it('renders a generated PDF as a downloadable artifact', () => {
    assert.deepEqual(
      describeSupportToolResult('generate_pdf_report', {
        reportType: 'user-list',
        filename: 'users.pdf',
        data: 'JVBERi0=',
      }),
      { kind: 'pdf', filename: 'users.pdf', data: 'JVBERi0=' },
    )
  })
})
