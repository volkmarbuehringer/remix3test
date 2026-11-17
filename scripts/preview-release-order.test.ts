import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { releasePublishedAt, sortReleasesByPublishedAt } from './preview-release-order.ts'

describe('preview release ordering', () => {
  it('orders by publication time, not the tag counter', () => {
    let oldTag = {
      tag_name: 'v0.20261117.163354-main-9b0ff351',
      published_at: '2026-11-17T16:41:02Z',
      created_at: '2026-11-17T16:40:00Z',
    }
    let newTag = {
      tag_name: 'v0.20261117.0-main-ab790c88',
      published_at: '2026-11-17T18:04:52Z',
      created_at: '2026-11-17T18:04:00Z',
    }

    assert.deepEqual(
      sortReleasesByPublishedAt([oldTag, newTag]).map((release) => release.tag_name),
      [newTag.tag_name, oldTag.tag_name],
    )
  })

  it('falls back to created_at, then to zero', () => {
    let created = '2026-11-17T18:04:00Z'
    assert.equal(releasePublishedAt({ created_at: created }), Date.parse(created))
    assert.equal(
      releasePublishedAt({ published_at: null, created_at: created }),
      Date.parse(created),
    )
    assert.equal(
      releasePublishedAt({ published_at: 'not-a-date', created_at: created }),
      Date.parse(created),
    )
    assert.equal(releasePublishedAt({}), 0)
  })
})
