import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { formatBytes, normalizeMimeType } from './upload-validation.ts'

describe('normalizeMimeType', () => {
  it('drops parameters and lower-cases the media type', () => {
    // Bun's File constructor appends a charset to text types; the allowlist
    // must compare the media type only.
    assert.equal(normalizeMimeType('text/csv;charset=utf-8'), 'text/csv')
    assert.equal(normalizeMimeType('TEXT/CSV'), 'text/csv')
    assert.equal(normalizeMimeType('  application/pdf  '), 'application/pdf')
  })

  it('ignores a quoted parameter that itself contains a semicolon', () => {
    // A naive split(';') would still return `application/pdf` here, but the
    // vendor parser is the single source of truth for parameterized values.
    assert.equal(normalizeMimeType('application/pdf; boundary="x;y"'), 'application/pdf')
  })

  it('returns an empty string for missing or empty input', () => {
    assert.equal(normalizeMimeType(''), '')
  })
})

describe('formatBytes', () => {
  it('uses German decimal separators and drops a trailing ,0', () => {
    assert.equal(formatBytes(0), '0 B')
    assert.equal(formatBytes(0.5), '0,5 B')
    assert.equal(formatBytes(1536), '1,5 KB')
    assert.equal(formatBytes(63.6 * 1024 * 1024), '63,6 MB')
    assert.equal(formatBytes(500 * 1024 * 1024), '500 MB')
  })

  it('renders an em dash for invalid values', () => {
    assert.equal(formatBytes(-1), '\u2014')
    assert.equal(formatBytes(Number.NaN), '\u2014')
  })
})
