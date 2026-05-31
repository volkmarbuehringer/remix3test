import Holidays from 'date-holidays'
import { type Database } from 'remix/data-table'
import type { Pool } from 'pg'

import { offeringConfigs, type OfferingConfig as SchemaOfferingConfig } from './schema.ts'
import { isDateInPast } from '../utils/date-utils.ts'
export type OfferingConfig = SchemaOfferingConfig

const hd = new Holidays('DE', 'rp')

/**
 * Map ISO weekday number (1=Mon .. 7=Sun) to lowercase English day name.
 */
const DAY_NAMES: Record<number, string> = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  7: 'sunday',
}

export interface DayRule {
  start: number
  end: number
}

export interface WeekPreviewItem {
  day: number
  dateStr: string
  dayName: string
  startMin: number | null
  endMin: number | null
  isHoliday: boolean
  exists: boolean
}

/**
 * Compute the epoch-midnight (00:00 UTC) of the Monday of a given ISO week.
 */
export function mondayOfWeek(year: number, week: number): number {
  // ISO 8601: Week 1 contains Jan 4
  let jan4 = new Date(Date.UTC(year, 0, 4))
  let dayOfWeek = jan4.getUTCDay() || 7 // 1=Mon .. 7=Sun
  // Monday of week 1
  let week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1))
  // Add weeks
  let monday = new Date(week1Monday)
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  return monday.getTime()
}

/**
 * Get offering config for a resource.
 */
export async function getConfig(
  db: Database,
  resourceId: number,
): Promise<OfferingConfig | null> {
  let config = await db.findOne(offeringConfigs, {
    where: { resource_id: resourceId },
  })
  return (config as OfferingConfig | null) ?? null
}

/**
 * Upsert offering config for a resource. `rules` is a JSON object
 * keyed by day name (e.g. { monday: [540, 1020] }).
 */
export async function upsertConfig(
  pool: Pool,
  resourceId: number,
  rules: Record<string, [number, number]>,
): Promise<void> {
  let now = Date.now()
  await pool.query(
    `INSERT INTO offering_configs (resource_id, rules, created_at, updated_at)
     VALUES ($1, $2::jsonb, $3, $3)
     ON CONFLICT (resource_id)
     DO UPDATE SET rules = $2::jsonb, updated_at = $3`,
    [resourceId, JSON.stringify(rules), now],
  )
}

/**
 * Check if an offering already exists for the given resource, day, and time range.
 */
async function offeringExists(
  pool: Pool,
  resourceId: number,
  day: number,
  startMin: number,
  endMin: number,
): Promise<boolean> {
  let result = await pool.query(
    `SELECT 1 FROM appointoffering
     WHERE resource_id = $1 AND day = $2 AND during = int4range($3, $4, '[)')
     LIMIT 1`,
    [resourceId, day, startMin, endMin],
  )
  return result.rows.length > 0
}

/**
 * Generate offerings for a full ISO week from the resource's config.
 * Skips holidays and existing offerings.
 * Returns counts of created and skipped days.
 */
export async function generateWeek(
  pool: Pool,
  resourceId: number,
  year: number,
  week: number,
): Promise<{ created: number; skipped: number; errors: string[] }> {
  // Read config via raw SQL to get the JSONB
  let configResult = await pool.query(
    'SELECT rules FROM offering_configs WHERE resource_id = $1',
    [resourceId],
  )
  if (configResult.rows.length === 0) {
    return { created: 0, skipped: 0, errors: ['Keine Konfiguration für diese Ressource.'] }
  }

  let rules: Record<string, [number, number]> = configResult.rows[0].rules
  if (typeof rules === 'string') {
    try { rules = JSON.parse(rules) } catch { rules = {} }
  }

  let mondayMs = mondayOfWeek(year, week)

  // Reject generating offerings for a week that is already in the past
  if (isDateInPast(mondayMs)) {
    return { created: 0, skipped: 0, errors: ['Die Kalenderwoche liegt in der Vergangenheit.'] }
  }

  let created = 0
  let skipped = 0
  let errors: string[] = []

  for (let i = 0; i < 7; i++) {
    let dayMs = mondayMs + i * 86_400_000
    let dayDate = new Date(dayMs)
    let isoDay = dayDate.getUTCDay() || 7 // 1=Mon .. 7=Sun
    let dayName = DAY_NAMES[isoDay]
    let rule = rules[dayName]
    if (!rule) continue

    let [startMin, endMin] = rule

    // Skip holidays
    if (hd.isHoliday(dayDate) !== false) {
      skipped++
      continue
    }

    // Skip if already exists
    if (await offeringExists(pool, resourceId, dayMs, startMin, endMin)) {
      skipped++
      continue
    }

    try {
      let now = Date.now()
      await pool.query(
        `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
         VALUES ($1::bigint, $2, int4range($3, $4, '[)'), $5, $5)`,
        [dayMs, resourceId, startMin, endMin, now],
      )
      created++
    } catch (error: unknown) {
      let msg = error instanceof Error ? error.message : String(error)
      errors.push(`Tag ${dayDate.toISOString().slice(0, 10)}: ${msg}`)
    }
  }

  return { created, skipped, errors }
}

/**
 * Preview what would be generated for a week without inserting anything.
 */
export async function previewWeek(
  pool: Pool,
  resourceId: number,
  year: number,
  week: number,
): Promise<WeekPreviewItem[]> {
  let configResult = await pool.query(
    'SELECT rules FROM offering_configs WHERE resource_id = $1',
    [resourceId],
  )
  if (configResult.rows.length === 0) return []

  let rules: Record<string, [number, number]> = configResult.rows[0].rules
  if (typeof rules === 'string') {
    try { rules = JSON.parse(rules) } catch { rules = {} }
  }

  let mondayMs = mondayOfWeek(year, week)
  let items: WeekPreviewItem[] = []

  for (let i = 0; i < 7; i++) {
    let dayMs = mondayMs + i * 86_400_000
    let dayDate = new Date(dayMs)
    let isoDay = dayDate.getUTCDay() || 7
    let dayName = DAY_NAMES[isoDay]
    let rule = rules[dayName]

    let dateStr = dayDate.toISOString().slice(0, 10)
    let isHoliday = rule ? hd.isHoliday(dayDate) !== false : false
    let exists = false

    if (rule) {
      let [startMin, endMin] = rule
      exists = await offeringExists(pool, resourceId, dayMs, startMin, endMin)
    }

    items.push({
      day: dayMs,
      dateStr,
      dayName,
      startMin: rule ? rule[0] : null,
      endMin: rule ? rule[1] : null,
      isHoliday,
      exists,
    })
  }

  return items
}
