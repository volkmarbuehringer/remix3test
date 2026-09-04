import { sql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { getTodayUtcMidnight } from '../utils/date-utils.ts'
import { queryRows, int8Aggregate } from './rows.ts'

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

async function toCount(db: Database, query: string): Promise<number> {
  let rows = await queryRows(db, query, z.object({ count: int8Aggregate }))
  return rows.length > 0 ? rows[0].count : 0
}

/**
 * Aggregate the at-a-glance numbers shown on the `/verwaltung` dashboard. A
 * single query covers both appointment buckets so the count stays consistent;
 * the remaining tables are simple cardinality reads.
 */
export async function countDashboardStats(db: Database): Promise<DashboardStats> {
  let todayMidnight = getTodayUtcMidnight()

  let apptRows = await queryRows(
    db,
    sql`SELECT
       COUNT(*) FILTER (WHERE date >= ${todayMidnight}) AS pending,
       COUNT(*) FILTER (WHERE date < ${todayMidnight}) AS expired
     FROM appointments`,
    z.object({ pending: int8Aggregate, expired: int8Aggregate }),
  )
  let apptRow = apptRows[0]

  return {
    appointmentsPending: apptRow?.pending ?? 0,
    appointmentsExpired: apptRow?.expired ?? 0,
    offerings: await toCount(db, 'SELECT COUNT(*) AS count FROM appointoffering'),
    resources: await toCount(db, 'SELECT COUNT(*) AS count FROM resources'),
    offeringConfigs: await toCount(db, 'SELECT COUNT(*) AS count FROM offering_configs'),
  }
}
