import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { getQuotaStats, QUOTA_NEAR_RATIO, type QuotaUsage } from './uploads-quota.ts'

const globalQuota: QuotaUsage = {
  userUsedBytes: 0,
  userQuotaBytes: null,
  totalUsedBytes: 60,
  totalQuotaBytes: 500,
}

describe('getQuotaStats', () => {
  it('uses the global quota and label for an admin', () => {
    let stats = getQuotaStats(globalQuota)
    assert.equal(stats.used, 60)
    assert.equal(stats.cap, 500)
    assert.equal(stats.free, 440)
    assert.equal(stats.ratio, 0.12)
    assert.equal(stats.percent, 12)
    assert.equal(stats.near, false)
    assert.equal(stats.label, 'Speicher')
  })

  it('prefers the narrower per-user quota for a non-admin', () => {
    let stats = getQuotaStats({
      userUsedBytes: 40,
      userQuotaBytes: 100,
      totalUsedBytes: 60,
      totalQuotaBytes: 500,
    })
    assert.equal(stats.used, 40)
    assert.equal(stats.cap, 100)
    assert.equal(stats.free, 60)
    assert.equal(stats.percent, 40)
    assert.equal(stats.label, 'Ihr Speicher')
  })

  it('treats a zero cap as empty instead of dividing by zero', () => {
    let stats = getQuotaStats({
      userUsedBytes: 0,
      userQuotaBytes: 0,
      totalUsedBytes: 10,
      totalQuotaBytes: 500,
    })
    assert.equal(stats.ratio, 0)
    assert.equal(stats.percent, 0)
    assert.equal(stats.free, 0)
    assert.equal(stats.near, false)
  })

  it('clamps an over-quota usage and never reports negative free space', () => {
    let stats = getQuotaStats({
      userUsedBytes: 120,
      userQuotaBytes: 100,
      totalUsedBytes: 120,
      totalQuotaBytes: 500,
    })
    assert.equal(stats.ratio, 1)
    assert.equal(stats.percent, 100)
    assert.equal(stats.free, 0)
    assert.equal(stats.near, true)
  })

  it('flags the warning state from the near ratio', () => {
    let below = getQuotaStats({
      userUsedBytes: 84.9,
      userQuotaBytes: 100,
      totalUsedBytes: 84.9,
      totalQuotaBytes: 100,
    })
    let at = getQuotaStats({
      userUsedBytes: QUOTA_NEAR_RATIO * 100,
      userQuotaBytes: 100,
      totalUsedBytes: QUOTA_NEAR_RATIO * 100,
      totalQuotaBytes: 100,
    })
    assert.equal(below.near, false)
    assert.equal(at.near, true)
  })
})
