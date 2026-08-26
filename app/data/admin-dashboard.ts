import { type Database } from 'remix/data-table'

import { getTodayUtcMidnight } from '../utils/date-utils.ts'

export interface DashboardStats {
  /** Appointments whose date is on/after today (pending / upcoming). */
  appointmentsPending: number
  /** Appointments whose date is before today (expired / past). */
  appointmentsExpired: number
  /** Number of configured offering slots (appointoffering rows). */
  offerings: number
  /** Number of resources. */
  resources: number
  /** Number of offering-config rulesets (one per resource). */
  offeringConfigs: number
}

function toCount(result: { rows?: Record<string, unknown>[] }): number {
  return Number((result.rows ?? [])[0]?.count ?? 0)
}

/**
 * Aggregate the at-a-glance numbers shown on the `/verwaltung` dashboard. A
 * single query covers both appointment buckets so the count stays consistent;
 * the remaining tables are simple cardinality reads.
 */
export async function countDashboardStats(db: Database): Promise<DashboardStats> {
  let todayMidnight = getTodayUtcMidnight()

  let appointmentCounts = await db.exec(
    `SELECT
       COUNT(*) FILTER (WHERE date >= $1) AS pending,
       COUNT(*) FILTER (WHERE date < $1) AS expired
     FROM appointments`,
    [todayMidnight],
  )
  let apptRow = (appointmentCounts.rows ?? [])[0] ?? {}

  let offerings = toCount(await db.exec('SELECT COUNT(*) AS count FROM appointoffering'))
  let resources = toCount(await db.exec('SELECT COUNT(*) AS count FROM resources'))
  let offeringConfigs = toCount(await db.exec('SELECT COUNT(*) AS count FROM offering_configs'))

  return {
    appointmentsPending: Number(apptRow.pending ?? 0),
    appointmentsExpired: Number(apptRow.expired ?? 0),
    offerings,
    resources,
    offeringConfigs,
  }
}
