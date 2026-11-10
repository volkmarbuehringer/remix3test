import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { parseUsersQuery } from './admin-users.ts'

function parse(query: string) {
  return parseUsersQuery(new URL('https://remix.run/admin/users' + query))
}

describe('parseUsersQuery', () => {
  it('defaults to sorting by name ascending', () => {
    assert.deepEqual(parse(''), {
      filter: undefined,
      status: undefined,
      column: 'name',
      direction: 'asc',
    })
  })

  it('reads the whitelisted sort column and direction', () => {
    assert.deepEqual(parse('?sort=created_at&order=desc'), {
      filter: undefined,
      status: undefined,
      column: 'created_at',
      direction: 'desc',
    })
  })

  it('falls back for unknown sort/order values', () => {
    let query = parse('?sort=password_hash&order=sideways')
    assert.equal(query.column, 'name')
    assert.equal(query.direction, 'asc')
  })

  it('treats the legacy filter=enabled|disabled as a status, never a search term', () => {
    assert.equal(parse('?filter=enabled').filter, undefined)
    assert.equal(parse('?filter=enabled').status, 'enabled')
    assert.equal(parse('?filter=disabled').filter, undefined)
    assert.equal(parse('?filter=disabled').status, 'disabled')
  })

  it('prefers the status param over a legacy filter token', () => {
    let query = parse('?filter=enabled&status=disabled')
    assert.equal(query.filter, undefined, 'the legacy token must not become a search term')
    assert.equal(query.status, 'disabled')
  })

  it('combines a text search with the status filter', () => {
    let query = parse('?filter=anna&status=enabled')
    assert.equal(query.filter, 'anna')
    assert.equal(query.status, 'enabled')
  })

  it('keeps a numeric filter as a search term (matched by ID)', () => {
    let query = parse('?filter=42')
    assert.equal(query.filter, '42')
    assert.equal(query.status, undefined)
  })
})
