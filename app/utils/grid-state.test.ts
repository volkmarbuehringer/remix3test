import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  gridStateDirection,
  gridStateFromFormData,
  gridStateOverrides,
  type GridState,
} from './grid-state.ts'

function state(order: string): GridState {
  return { offset: '', sort: '', order, filter: '' }
}

describe('grid-state', () => {
  it('gridStateOverrides maps submitted fields to loader overrides', () => {
    let formData = new FormData()
    formData.set('_offset', '20')
    formData.set('_sort', 'a.date')
    formData.set('_order', 'desc')
    formData.set('_filter', 'Raum')
    formData.set('_period', 'this-week')
    formData.set('_status', 'expired')

    assert.deepEqual(gridStateOverrides(gridStateFromFormData(formData)), {
      offset: 20,
      sortColumn: 'a.date',
      sortDirection: 'desc',
      filter: 'Raum',
      period: 'this-week',
      status: 'expired',
    })
  })

  it('gridStateOverrides turns omitted or empty fields into undefined', () => {
    assert.deepEqual(gridStateOverrides(gridStateFromFormData(new FormData())), {
      offset: undefined,
      sortColumn: undefined,
      sortDirection: undefined,
      filter: undefined,
      period: undefined,
      status: undefined,
    })
  })

  it('gridStateDirection whitelists asc/desc and drops anything else', () => {
    // `_order` is client-supplied, so an invalid value must fall back to the caller's default
    // instead of reaching the raw-SQL ORDER BY compiler, which throws on anything else.
    assert.equal(gridStateDirection(state('asc')), 'asc')
    assert.equal(gridStateDirection(state('desc')), 'desc')
    assert.equal(gridStateDirection(state('bogus')), undefined)
    assert.equal(gridStateDirection(state('')), undefined)
  })
})
