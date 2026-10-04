import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { buildListsSearchHref } from './lists-search-url.ts'

describe('buildListsSearchHref', () => {
  it('keeps the load param from the frame src and adds the filter', () => {
    assert.equal(buildListsSearchHref('/lists?load=42', null, 'abc'), '/lists?filter=abc&load=42')
  })

  it('falls back to the active-list id when the src has no load param', () => {
    assert.equal(buildListsSearchHref('/lists', '42', 'abc'), '/lists?filter=abc&load=42')
  })

  it('drops the filter for a blank or whitespace-only value', () => {
    assert.equal(buildListsSearchHref('/lists?load=42', null, ''), '/lists?load=42')
    assert.equal(buildListsSearchHref('/lists?load=42', null, '   '), '/lists?load=42')
  })

  it('trims the filter value', () => {
    assert.equal(
      buildListsSearchHref('/lists?load=42', null, '  abc  '),
      '/lists?filter=abc&load=42',
    )
  })

  it('replaces an existing filter and drops unrelated params', () => {
    assert.equal(
      buildListsSearchHref('/lists?filter=old&load=42&sort=name', null, 'new'),
      '/lists?filter=new&load=42',
    )
  })

  it('omits both params for an empty new list with no filter', () => {
    assert.equal(buildListsSearchHref('/lists', null, ''), '/lists')
  })
})
