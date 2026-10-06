import { gte, lt, sql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { appointofferings, type AppointOffering } from './schema.ts'
import { int8, queryRows } from './rows.ts'
import { parseDuring } from '../utils/during.ts'

export async function listOfferingsByWeek(
  db: Database,
  weekStart: number,
  weekEnd: number,
  resourceId?: number,
): Promise<AppointOffering[]> {
  let query = db.query(appointofferings).where(gte('day', weekStart)).where(lt('day', weekEnd))

  if (resourceId !== undefined) {
    query = query.where({ resource_id: resourceId })
  }

  return await query.orderBy('day', 'asc').orderBy('during', 'asc').all()
}

/**
 * Query offerings across a date range for a resource (single query, 14-day window).
 * Used by the admin controller for dynamic default time selection.
 */
export async function listOfferingsByDayRange(
  db: Database,
  startDate: number,
  endDate: number,
  resourceId: number,
): Promise<AppointOffering[]> {
  return await db
    .query(appointofferings)
    .where(gte('day', startDate))
    .where(lt('day', endDate))
    .where({ resource_id: resourceId })
    .orderBy('day', 'asc')
    .orderBy('during', 'asc')
    .all()
}

/**
 * Returns distinct days that have at least one offering for a resource in a date window,
 * along with the offering time ranges for each day.
 */
export async function listDaysWithOfferings(
  db: Database,
  resourceId: number,
  startDate: number,
  endDate: number,
): Promise<{ day: number; ranges: { startMin: number; endMin: number }[] }[]> {
  let rows = await queryRows(
    db,
    sql`
    SELECT day, during::text AS during
    FROM appointoffering
    WHERE resource_id = ${resourceId}
      AND day >= ${startDate}
      AND day < ${endDate}
    ORDER BY day ASC, during ASC
  `,
    z.object({ day: int8, during: z.string() }),
  )

  let dayMap = new Map<number, { startMin: number; endMin: number }[]>()
  for (let row of rows) {
    let day = Number(row.day)
    if (!dayMap.has(day)) {
      dayMap.set(day, [])
    }
    let parsed = parseDuring(row.during)
    if (parsed) {
      dayMap.get(day)!.push(parsed)
    }
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([day, ranges]) => ({ day, ranges }))
}

/**
 * Takes offering `during` ranges for a day and returns an array of valid
 * full-hour `start_min` values (multiples of 60) that fit within at least
 * one offering.
 */
export function computeFullHourSlots(ranges: { startMin: number; endMin: number }[]): number[] {
  let slots = new Set<number>()
  for (let { startMin, endMin } of ranges) {
    let firstHour = Math.ceil(startMin / 60) * 60
    for (let m = firstHour; m + 60 <= endMin; m += 60) {
      slots.add(m)
    }
  }
  return Array.from(slots).sort((a, b) => a - b)
}

/**
 * Batch query booked ranges for a resource over a week-long range.
 * Returns a Map keyed by day (epoch ms) with arrays of booked ranges.
 */
export async function getBookedRangesForWeek(
  db: Database,
  resourceId: number,
  weekStart: number,
  weekEnd: number,
): Promise<Map<number, { startMin: number; endMin: number }[]>> {
  let rows = await queryRows(
    db,
    sql`
    SELECT date, start_min, end_min
    FROM appointments
    WHERE resource_id = ${resourceId}
      AND date >= ${weekStart}
      AND date < ${weekEnd}
    ORDER BY date ASC, start_min ASC
  `,
    z.object({ date: int8, start_min: z.number(), end_min: z.number() }),
  )
  let map = new Map<number, { startMin: number; endMin: number }[]>()
  for (let row of rows) {
    let d = Number(row.date)
    if (!map.has(d)) map.set(d, [])
    map.get(d)!.push({ startMin: Number(row.start_min), endMin: Number(row.end_min) })
  }
  return map
}

/**
 * Filter full-hour slots to exclude those overlapping with booked ranges.
 * A slot at minute m is booked if ∃ booked range b where m < b.endMin AND m+60 > b.startMin.
 */
export function filterAvailableSlots(
  fullHourSlots: number[],
  booked: { startMin: number; endMin: number }[],
): number[] {
  return fullHourSlots.filter((m) => {
    for (let b of booked) {
      if (m < b.endMin && m + 60 > b.startMin) return false
    }
    return true
  })
}

/**
 * Check whether a given time range falls within at least one offering
 * for a given resource on a given day. Uses a single DB query instead
 * of fetching all offerings and iterating client-side.
 */
export async function isSlotBookable(
  db: Database,
  date: number,
  resourceId: number,
  startMin: number,
  endMin: number,
): Promise<boolean> {
  let result = await db.exec(sql`
    SELECT 1 FROM appointoffering
    WHERE day = ${date} AND resource_id = ${resourceId}
    AND lower(during) <= ${startMin} AND upper(during) >= ${endMin}
    LIMIT 1
  `)
  return (result.rows?.length ?? 0) > 0
}
