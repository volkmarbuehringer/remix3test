import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import * as s from 'remix/data-schema'

import { appointmentSaveSchema, appointmentsNewSaveSchema } from './appointment-schema.ts'
import { issuesToFieldErrors } from './schema-utils.ts'

function form(entries: Record<string, string>): FormData {
  let data = new FormData()
  for (let [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const validAppointment = {
  resource_id: '1',
  user_id: '2',
  title: 'Kontrolle',
  date: '2026-11-02',
  start_min: '600',
  end_min: '660',
}

describe('appointmentSaveSchema title', () => {
  it('rejects a missing title field instead of defaulting it to an empty string', () => {
    let { title: _title, ...withoutTitle } = validAppointment

    let result = s.parseSafe(appointmentSaveSchema, form(withoutTitle))

    assert.equal(result.success, false)
    if (result.success) return
    assert.deepEqual(issuesToFieldErrors(result.issues), {
      title: 'Titel ist erforderlich.',
    })
  })

  it('rejects an empty title', () => {
    let result = s.parseSafe(appointmentSaveSchema, form({ ...validAppointment, title: '' }))

    assert.equal(result.success, false)
    if (result.success) return
    assert.deepEqual(issuesToFieldErrors(result.issues), {
      title: 'Titel ist erforderlich.',
    })
  })

  it('rejects a whitespace-only title', () => {
    let result = s.parseSafe(appointmentSaveSchema, form({ ...validAppointment, title: '   ' }))

    assert.equal(result.success, false)
    if (result.success) return
    assert.deepEqual(issuesToFieldErrors(result.issues), {
      title: 'Titel ist erforderlich.',
    })
  })

  it('trims a valid title', () => {
    let result = s.parseSafe(
      appointmentSaveSchema,
      form({ ...validAppointment, title: '  Kontrolle  ' }),
    )

    if (!result.success) throw new Error('expected the form to parse')
    assert.equal(result.value.title, 'Kontrolle')
  })
})

const validNewAppointment = {
  resource_id: '1',
  title: 'Kontrolle',
  date: '2026-11-02',
  start_min: '600',
}

for (let [name, schema, valid] of [
  ['appointmentSaveSchema', appointmentSaveSchema, validAppointment],
  ['appointmentsNewSaveSchema', appointmentsNewSaveSchema, validNewAppointment],
] as const) {
  describe(name + ' date', () => {
    it('rejects non-calendar dates instead of letting the parser roll them over', () => {
      for (let date of ['2026-02-29', '2027-02-31', '2026-04-31']) {
        let result = s.parseSafe(schema, form({ ...valid, date }))

        assert.equal(result.success, false, date + ' should be rejected')
        if (result.success) continue
        assert.deepEqual(issuesToFieldErrors(result.issues), {
          date: 'Gültiges Datum erforderlich (YYYY-MM-DD).',
        })
      }
    })

    it('accepts valid calendar dates including a leap day', () => {
      for (let date of ['2026-11-02', '2028-02-29']) {
        let result = s.parseSafe(schema, form({ ...valid, date }))

        if (!result.success) throw new Error('expected ' + date + ' to parse')
        assert.equal(result.value.date, date)
      }
    })
  })
}
