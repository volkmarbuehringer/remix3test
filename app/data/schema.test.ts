import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../db.ts'
import { decodeInt8Fields } from '../utils/schema-utils.ts'
import { users } from './schema.ts'

describe('data-table BIGINT decoding', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('decodeInt8Fields returns a new record without mutating the input', () => {
    let input = { created_at: '1700000000000', name: 'unchanged' }
    let output = decodeInt8Fields(input, 'created_at')
    assert.equal(output.created_at, 1700000000000)
    assert.equal(output.name, 'unchanged')
    assert.equal(input.created_at, '1700000000000', 'the source row must not be mutated')
    assert.ok(output !== input, 'a new record must be returned')
  })

  it('decodes int8 columns to numbers and leaves a null int8 null', async () => {
    let admin = await db.findOne(users, { where: { email: 'admin@newapp.com' } })
    assert.ok(admin, 'seeded admin should exist')
    assert.equal(typeof admin.created_at, 'number', 'created_at must decode to a number')
    assert.equal(typeof admin.updated_at, 'number', 'updated_at must decode to a number')
    assert.equal(typeof admin.token_version, 'number', 'an int4 column must stay a number')
    assert.equal(admin.disabled_at, null, 'a null int8 must stay null')
  })
})
