import Holidays from 'date-holidays'
import { type Database } from 'remix/data-table'

import { offeringConfigs, type OfferingConfig as SchemaOfferingConfig } from './schema.ts'
import { isDateInPast } from '../utils/date-utils.ts'
export type OfferingConfig = SchemaOfferingConfig

function safeJsonParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

function isValidRule(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number'
}

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
export async function getConfig(db: Database, resourceId: number): Promise<OfferingConfig | null> {
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
  db: Database,
  resourceId: number,
  rules: Record<string, [number, number]>,
): Promise<void> {
  let now = Date.now()
  await db.exec(
    `INSERT INTO offering_configs (resource_id, rules, created_at, updated_at)
     VALUES ($1, $2::jsonb, $3, $3)
     ON CONFLICT (resource_id)
     DO UPDATE SET rules = $2::jsonb, updated_at = $3`,
    [resourceId, JSON.stringify(rules), now],
  )
}

/**
 * Record existing offerings for the week in one batch query to avoid
 * the N+1 pattern of calling offeringExists for each day.
 */
async function listExistingOfferingKeys(
  db: Database,
  resourceId: number,
  mondayMs: number,
): Promise<Set<string>> {
  let sundayMs = mondayMs + 7 * 86_400_000
  let result = await db.exec(
    `SELECT day, lower(during) AS start_min, upper(during) AS end_min
     FROM appointoffering
     WHERE resource_id = $1 AND day >= $2 AND day < $3`,
    [resourceId, mondayMs, sundayMs],
  )
  let keys = new Set<string>()
  for (let row of result.rows ?? []) {
    keys.add(`${row.day}:${row.start_min}:${row.end_min}`)
  }
  return keys
}

/**
 * Generate offerings for a full ISO week from the resource's config.
 * Skips holidays and existing offerings.
 * Returns counts of created and skipped days.
 */
export async function generateWeek(
  db: Database,
  resourceId: number,
  year: number,
  week: number,
): Promise<{ created: number; skipped: number; errors: string[] }> {
  // Read config via raw SQL to get the JSONB
  let configResult = await db.exec('SELECT rules FROM offering_configs WHERE resource_id = $1', [
    resourceId,
  ])
  if (!configResult.rows || configResult.rows.length === 0) {
    return { created: 0, skipped: 0, errors: ['Keine Konfiguration für diese Ressource.'] }
  }

  let rawRules = configResult.rows[0].rules
  let rules: Record<string, unknown> =
    typeof rawRules === 'string' ? safeJsonParse(rawRules) : (rawRules as Record<string, unknown>)

  let mondayMs = mondayOfWeek(year, week)

  // Reject generating offerings for a week that is already in the past
  if (isDateInPast(mondayMs)) {
    return { created: 0, skipped: 0, errors: ['Die Kalenderwoche liegt in der Vergangenheit.'] }
  }

  let created = 0
  let skipped = 0
  let errors: string[] = []

  let existingKeys = await listExistingOfferingKeys(db, resourceId, mondayMs)

  let inserts: Array<{ dayMs: number; startMin: number; endMin: number }> = []

  for (let i = 0; i < 7; i++) {
    let dayMs = mondayMs + i * 86_400_000
    let dayDate = new Date(dayMs)
    let isoDay = dayDate.getUTCDay() || 7 // 1=Mon .. 7=Sun
    let dayName = DAY_NAMES[isoDay]
    let rule = rules[dayName]
    if (!isValidRule(rule)) continue

    let [startMin, endMin] = rule

    // Skip holidays
    if (hd.isHoliday(dayDate) !== false) {
      skipped++
      continue
    }

    // Skip if already exists
    if (existingKeys.has(`${dayMs}:${startMin}:${endMin}`)) {
      skipped++
      continue
    }

    inserts.push({ dayMs, startMin, endMin })
  }

  if (inserts.length > 0) {
    try {
      let now = Date.now()
      let placeholders: string[] = []
      let values: unknown[] = []
      for (let insert of inserts) {
        let base = values.length
        placeholders.push(
          `($${base + 1}::bigint, $${base + 2}, int4range($${base + 3}, $${base + 4}, '[)'), $${base + 5}, $${base + 5})`,
        )
        values.push(insert.dayMs, resourceId, insert.startMin, insert.endMin, now)
      }
      await db.exec(
        `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
         VALUES ${placeholders.join(', ')}`,
        values,
      )
      created = inserts.length
    } catch (error: unknown) {
      let msg = error instanceof Error ? error.message : String(error)
      errors.push(msg)
    }
  }

  return { created, skipped, errors }
}
