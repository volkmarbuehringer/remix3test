import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { theme } from './theme/theme.ts'
import {
  formatTime,
  inferKind,
  kindGlyph,
  kindColor,
  pipelineLogHtml,
  pipelineRowHtml,
  type PipelineRow,
} from './agent-events-log.ts'

function row(overrides: Partial<PipelineRow> = {}): PipelineRow {
  return { kind: 'info', text: 'hello', time: '12:00:00', ...overrides }
}

describe('agent-events-log', () => {
  it('escapes agent-supplied text in a single row', () => {
    let html = String(pipelineRowHtml(row({ text: '<script>alert(1)</script>' })))
    assert.ok(!html.includes('<script>'), 'raw script tag must not appear')
    assert.ok(html.includes('&lt;script&gt;'), 'script text should be HTML-escaped')
  })

  it('escapes agent-supplied text in the full log container', () => {
    let html = String(
      pipelineLogHtml([row({ text: '<img src=x onerror=alert(1)>' }), row({ text: 'safe text' })]),
    )
    assert.ok(html.includes('id="ae-pipeline-log"'), 'log container carries its id')
    assert.ok(!html.includes('<img'), 'raw img tag must not appear')
    assert.ok(html.includes('&lt;img'), 'img text should be HTML-escaped')
    assert.ok(html.includes('safe text'), 'plain text is preserved')
  })

  it('does not double-escape nested row html', () => {
    let html = String(pipelineLogHtml([row({ text: '<b>bold</b>' })]))
    assert.ok(!html.includes('&amp;lt;'), 'nested SafeHtml rows must not be re-escaped')
    assert.ok(html.includes('&lt;b&gt;bold&lt;/b&gt;'), 'single escaping applied to row text')
  })

  it('renders the kind glyph badge in each row', () => {
    let html = String(pipelineRowHtml(row({ kind: 'success', text: 'done' })))
    assert.ok(html.includes('>✓</span'), 'success row shows checkmark glyph')
  })

  it('inferKind maps legacy text prefixes', () => {
    assert.equal(inferKind('✓ done'), 'success')
    assert.equal(inferKind('▶ running'), 'active')
    assert.equal(inferKind('! boom'), 'error')
    assert.equal(inferKind('plain'), 'info')
    assert.equal(inferKind(''), 'info')
  })

  it('kindGlyph maps kinds to glyphs', () => {
    assert.equal(kindGlyph('success'), '✓')
    assert.equal(kindGlyph('active'), '▶')
    assert.equal(kindGlyph('error'), '!')
    assert.equal(kindGlyph('info'), '•')
  })

  it('kindColor maps kinds to theme variables', () => {
    assert.equal(kindColor('success'), theme.colors.success.background)
    assert.equal(kindColor('active'), theme.colors.action.primary.background)
    assert.equal(kindColor('error'), theme.colors.action.danger.background)
    assert.equal(kindColor('info'), theme.colors.text.muted)
  })

  it('formatTime produces a localized HH:MM:SS string', () => {
    let ts = new Date(2025, 0, 15, 9, 5, 7).getTime()
    let out = formatTime(ts)
    assert.ok(/^\d{1,2}:\d{2}:\d{2}/.test(out), `expected time-like string, got "${out}"`)
  })
})
