import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import * as s from 'remix/data-schema'

import { offeringSaveSchema } from './offering-schema.ts'
import { issuesToFieldErrors } from './schema-utils.ts'

function form(entries: Record<string, string>): FormData {
  let data = new FormData()
  for (let [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const validOffering = {
  resource_id: '1',
  day: '2026-11-02',
  start_min: '480',
  end_min: '540',
}

describe('offeringSaveSchema day', () => {
  it('rejects a non-calendar date that matches the YYYY-MM-DD shape', () => {
    // 2026-02-31 passes a shape-only regex but is not a real date; it must
    // fail validation instead of silently rolling over to another day.
    for (let day of ['2026-02-29', '2026-02-31', '2026-04-31', '2026-13-01']) {
      let result = s.parseSafe(offeringSaveSchema, form({ ...validOffering, day }))

      assert.equal(result.success, false, day + ' should be rejected')
      if (result.success) continue
      assert.deepEqual(issuesToFieldErrors(result.issues), {
        day: 'Gültiges Datum erforderlich (YYYY-MM-DD).',
      })
    }
  })

  it('rejects a malformed date', () => {
    let result = s.parseSafe(offeringSaveSchema, form({ ...validOffering, day: 'not-a-date' }))

    assert.equal(result.success, false)
    if (result.success) return
    assert.deepEqual(issuesToFieldErrors(result.issues), {
      day: 'Gültiges Datum erforderlich (YYYY-MM-DD).',
    })
  })

  it('accepts a valid calendar date including a leap day', () => {
    for (let day of ['2026-11-02', '2028-02-29']) {
      let result = s.parseSafe(offeringSaveSchema, form({ ...validOffering, day }))

      if (!result.success) throw new Error('expected ' + day + ' to parse')
      assert.equal(result.value.day, day)
    }
  })
})
