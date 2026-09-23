import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { normalizeMimeType } from './upload-validation.ts'

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
