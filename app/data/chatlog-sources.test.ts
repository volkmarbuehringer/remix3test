import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  CHATLOG_SOURCE_FILTERS,
  classifyThreadSourceFor,
  countThreadsBySource,
  matchesSourceFilter,
  parseSourceFilter,
} from './chatlog-sources.ts'

describe('chatlog source classification', () => {
  it("classifies the current admin's own resource as support", () => {
    assert.equal(classifyThreadSourceFor('42', 42), 'support')
  })

  it('classifies another numeric resource as a customer thread', () => {
    assert.equal(classifyThreadSourceFor('7', 42), 'customer')
  })

  it('classifies a non-numeric placeholder as legacy', () => {
    assert.equal(classifyThreadSourceFor('route-user', 42), 'legacy')
    assert.equal(classifyThreadSourceFor('test-user', 42), 'legacy')
  })

  it('classifies a numeric resource as customer when no admin is known', () => {
    assert.equal(classifyThreadSourceFor('42', undefined), 'customer')
  })

  it('treats a missing or unknown filter as all', () => {
    assert.equal(parseSourceFilter(null), 'all')
    assert.equal(parseSourceFilter(''), 'all')
    assert.equal(parseSourceFilter('bogus'), 'all')
    assert.equal(parseSourceFilter('support'), 'support')
    assert.equal(parseSourceFilter('customer'), 'customer')
    assert.equal(parseSourceFilter('legacy'), 'legacy')
  })

  it('offers all four filter values in order', () => {
    assert.deepEqual([...CHATLOG_SOURCE_FILTERS], ['all', 'support', 'customer', 'legacy'])
  })

  it('counts threads per source with all as the total', () => {
    let threads = [
      { resourceId: '42' },
      { resourceId: '42' },
      { resourceId: '7' },
      { resourceId: 'route-user' },
    ]
    assert.deepEqual(countThreadsBySource(threads, 42), {
      all: 4,
      support: 2,
      customer: 1,
      legacy: 1,
    })
  })

  it('matches the active filter, with all matching everything', () => {
    assert.equal(matchesSourceFilter('42', 42, 'all'), true)
    assert.equal(matchesSourceFilter('7', 42, 'all'), true)
    assert.equal(matchesSourceFilter('route-user', 42, 'all'), true)
    assert.equal(matchesSourceFilter('42', 42, 'support'), true)
    assert.equal(matchesSourceFilter('7', 42, 'support'), false)
    assert.equal(matchesSourceFilter('7', 42, 'customer'), true)
    assert.equal(matchesSourceFilter('route-user', 42, 'legacy'), true)
    assert.equal(matchesSourceFilter('42', 42, 'legacy'), false)
  })
})
