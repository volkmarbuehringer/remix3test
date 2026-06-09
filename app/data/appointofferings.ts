import { gte, lt, sql, type Database } from 'remix/data-table'

import { appointofferings, type AppointOffering } from './schema.ts'

export async function listOfferingsByWeek(
  db: Database,
  weekStart: number,
  weekEnd: number,
  resourceId?: number,
): Promise<AppointOffering[]> {
  let query = db
    .query(appointofferings)
    .where(gte('day', weekStart))
    .where(lt('day', weekEnd))

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
 * Query offerings for a specific day and resource.
 */
export async function listOfferingsByDay(
  db: Database,
  day: number,
  resourceId: number,
): Promise<AppointOffering[]> {
  return await db
    .query(appointofferings)
    .where({ day, resource_id: resourceId })
    .orderBy('during', 'asc')
    .all()
}

/**
 * Parse an offering's `during` range string into [startMin, endMin).
 * Handles various formats the PostgreSQL driver might return.
 */
export function parseDuring(during: string): { startMin: number; endMin: number } | null {
  // Guard against null/undefined values the PostgreSQL driver might return
  if (during == null) return null

  // Standard format: "[start,end)"
  let match = during.match(/^\[(\d+),(\d+)\)$/)
  if (match) {
    return { startMin: parseInt(match[1], 10), endMin: parseInt(match[2], 10) }
  }
  // Fallback: try to extract two numbers separated by comma within brackets
  let fallback = during.match(/\[(\d+)\s*,\s*(\d+)/)
  if (fallback) {
    return { startMin: parseInt(fallback[1], 10), endMin: parseInt(fallback[2], 10) }
  }
  return null
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
  let rows = await db.exec(sql`
    SELECT day, during::text AS during
    FROM appointoffering
    WHERE resource_id = ${resourceId}
      AND day >= ${startDate}
      AND day < ${endDate}
    ORDER BY day ASC, during ASC
  `)

  let dayMap = new Map<number, { startMin: number; endMin: number }[]>()
  for (let row of (rows.rows ?? []) as { day: number; during: string }[]) {
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
export function computeFullHourSlots(
  ranges: { startMin: number; endMin: number }[],
): number[] {
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
 * Query booked time ranges for a resource on a given day.
 * Optionally excludes a specific appointment ID (for self-exclusion in edit mode).
 */
export async function getBookedRanges(
  db: Database,
  resourceId: number,
  date: number,
  excludeId?: number,
): Promise<{ startMin: number; endMin: number }[]> {
  let query = sql`
    SELECT start_min, end_min
    FROM appointments
    WHERE resource_id = ${resourceId} AND date = ${date}
  `
  if (excludeId !== undefined) {
    query = sql`${query} AND id != ${excludeId}`
  }
  query = sql`${query} ORDER BY start_min ASC`
  let result = await db.exec(query)
  return ((result.rows ?? []) as { start_min: number; end_min: number }[]).map(
    (r) => ({ startMin: Number(r.start_min), endMin: Number(r.end_min) }),
  )
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
  let result = await db.exec(sql`
    SELECT date, start_min, end_min
    FROM appointments
    WHERE resource_id = ${resourceId}
      AND date >= ${weekStart}
      AND date < ${weekEnd}
    ORDER BY date ASC, start_min ASC
  `)
  let map = new Map<number, { startMin: number; endMin: number }[]>()
  for (let row of (result.rows ?? []) as { date: number; start_min: number; end_min: number }[]) {
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
