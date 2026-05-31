import { eq, gte, lt, type Database } from 'remix/data-table'

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

async function listOfferingsByDayAndResource(
  db: Database,
  date: number,
  resourceId: number,
): Promise<AppointOffering[]> {
  return await db
    .query(appointofferings)
    .where({ day: date, resource_id: resourceId })
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
 * Check whether a given time range falls within at least one offering
 * for a given resource on a given day.
 */
export async function isSlotBookable(
  db: Database,
  date: number,
  resourceId: number,
  startMin: number,
  endMin: number,
): Promise<boolean> {
  let offerings = await listOfferingsByDayAndResource(db, date, resourceId)
  if (offerings.length === 0) return false

  // Parse each offering's during range and check for overlap
  for (let offering of offerings) {
    let parsed = parseDuring(offering.during)
    if (!parsed) {
      console.warn(`[appointofferings] Skipping offering ${offering.id}: unparseable during="${offering.during}"`)
      continue
    }
    // Check if [startMin, endMin) is fully contained within [offeringStart, offeringEnd)
    if (startMin >= parsed.startMin && endMin <= parsed.endMin) {
      return true
    }
  }

  return false
}
