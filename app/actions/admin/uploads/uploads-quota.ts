/**
 * Quota arithmetic shared by the uploads panel header and its progress bar.
 * Keeping it out of the controller makes the edge cases (zero cap, over-quota,
 * per-user vs. global) unit-testable without rendering the page.
 */

export type QuotaUsage = {
  userUsedBytes: number
  userQuotaBytes: number | null
  totalUsedBytes: number
  totalQuotaBytes: number
}

export type QuotaStats = {
  used: number
  cap: number
  free: number
  ratio: number
  percent: number
  near: boolean
  label: string
}

/** Ratio at which the progress bar switches to its warning colour. */
export const QUOTA_NEAR_RATIO = 0.85

/**
 * Resolve the quota the header should show. A non-admin sees the narrower
 * per-user quota (with the global quota as a fallback), an admin sees the global
 * one. The numbers feed both the summary text and the progress bar so they can
 * never disagree.
 */
export function getQuotaStats(quota: QuotaUsage): QuotaStats {
  let used = quota.userQuotaBytes != null ? quota.userUsedBytes : quota.totalUsedBytes
  let cap = quota.userQuotaBytes ?? quota.totalQuotaBytes
  let ratio = cap > 0 ? Math.max(0, Math.min(1, used / cap)) : 0
  return {
    used,
    cap,
    free: Math.max(0, cap - used),
    ratio,
    percent: Math.round(ratio * 100),
    near: ratio >= QUOTA_NEAR_RATIO,
    label: quota.userQuotaBytes != null ? 'Ihr Speicher' : 'Speicher',
  }
}
