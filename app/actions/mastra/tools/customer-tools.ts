import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { pool } from '../../../data/connection.ts'
import { computeFullHourSlots, filterAvailableSlots, parseDuring } from '../../../data/appointofferings.ts'
import { getTodayUtcMidnight, MS_PER_DAY } from '../../../utils/date-utils.ts'

// German stop words that add no search value
const STOP_WORDS = new Set([
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr',
  'der', 'die', 'das', 'den', 'dem', 'des',
  'ein', 'eine', 'einen', 'einem', 'eines',
  'mein', 'dein', 'sein', 'unser', 'euer',
  'dieser', 'diese', 'dieses',
  'und', 'oder', 'aber', 'denn', 'doch', 'sondern', 'auch',
  'für', 'auf', 'an', 'in', 'über', 'unter', 'neben', 'zwischen',
  'mit', 'von', 'zu', 'nach', 'bei', 'aus', 'durch', 'um',
  'ist', 'sind', 'war', 'wird', 'werden', 'wurde', 'bin', 'bist',
  'hat', 'haben', 'hast', 'habe',
  'nicht', 'kein', 'keine',
  'mal', 'schon', 'noch', 'bereits', 'bitte', 'danke',
  'einfach', 'gerne', 'gern', 'sehr', 'viel', 'wenig',
  'man', 'kann', 'können', 'muss', 'müssen', 'soll', 'sollen',
  'will', 'wollen', 'darf', 'dürfen', 'mag', 'mögen',
  'brauche', 'brauchen', 'möchte', 'möchtest',
  'würde', 'würden', 'hätte', 'hätten',
  'wenn', 'weil', 'dass', 'da', 'als', 'wie',
  'etwas', 'alles', 'nichts', 'jemand', 'niemand',
  'hier', 'dort', 'dahin', 'dorthin',
  'jetzt', 'sofort', 'später', 'heute', 'morgen', 'gestern',
  'ihnen', 'ihm', 'ihn', 'uns', 'euch',
])

function formatDateDisplay(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

export const customerTools = {
  findNextAvailableSlots: createTool({
    id: 'find_next_available_slots',
    description: 'Findet die nächsten verfügbaren Terminslots für eine Ressource. Parameter: resourceId (Pflicht), daysAhead (optional, Standard 7), title (optional, vom Gespräch abgeleiteter Titel). Gibt bis zu 3 freie Slots + resource_id + resource_name + title zurück.',
    inputSchema: z.object({
      resourceId: z.number().int().positive().describe('Die ID der Ressource, für die freie Slots gesucht werden sollen'),
      daysAhead: z.number().int().min(1).max(30).default(7).describe('Wie viele Tage im Voraus gesucht werden soll (maximal 30)'),
      title: z.string().max(200).default('').describe('Vom Gesprächskontext abgeleiteter Titel für den Termin'),
    }),
    execute: async ({ resourceId, daysAhead, title }) => {
      let client = await pool.connect()
      try {
        let resourceResult = await client.query(
          'SELECT name FROM resources WHERE id = $1',
          [resourceId],
        )
        let resourceName = resourceResult.rows[0]?.name ?? 'Unbekannt'

        let todayMidnight = getTodayUtcMidnight()
        let endDate = todayMidnight + daysAhead * MS_PER_DAY

        let offeringResult = await client.query(
          `SELECT day, during::text AS during
           FROM appointoffering
           WHERE resource_id = $1 AND day >= $2 AND day < $3
           ORDER BY day ASC, during ASC`,
          [resourceId, todayMidnight, endDate],
        )

        let dayRanges = new Map<number, { startMin: number; endMin: number }[]>()
        for (let row of offeringResult.rows) {
          let day = Number(row.day)
          if (!dayRanges.has(day)) dayRanges.set(day, [])
          let parsed = parseDuring(row.during)
          if (parsed) dayRanges.get(day)!.push(parsed)
        }

        if (dayRanges.size === 0) {
          return { slots: [] }
        }

        let bookingResult = await client.query(
          `SELECT date, start_min, end_min
           FROM appointments
           WHERE resource_id = $1 AND date >= $2 AND date < $3
           ORDER BY date ASC, start_min ASC`,
          [resourceId, todayMidnight, endDate],
        )

        let bookedByDay = new Map<number, { startMin: number; endMin: number }[]>()
        for (let row of bookingResult.rows) {
          let d = Number(row.date)
          if (!bookedByDay.has(d)) bookedByDay.set(d, [])
          bookedByDay.get(d)!.push({ startMin: Number(row.start_min), endMin: Number(row.end_min) })
        }

        let now = Date.now()
        let allSlots: { date_epoch_ms: number; start_min: number; end_min: number }[] = []

        for (let [day, ranges] of dayRanges) {
          let slots = computeFullHourSlots(ranges)
          let booked = bookedByDay.get(day) ?? []
          if (booked.length > 0) {
            slots = filterAvailableSlots(slots, booked)
          }

          for (let m of slots) {
            let slotEpoch = day + m * 60_000
            if (slotEpoch > now) {
              allSlots.push({ date_epoch_ms: day, start_min: m, end_min: m + 60 })
            }
          }
        }

        allSlots.sort((a, b) => {
          if (a.date_epoch_ms !== b.date_epoch_ms) return a.date_epoch_ms - b.date_epoch_ms
          return a.start_min - b.start_min
        })

        let top = allSlots.slice(0, 3)

        return {
          slots: top.map(s => ({
            date_epoch_ms: s.date_epoch_ms,
            date_display: formatDateDisplay(s.date_epoch_ms),
            start_min: s.start_min,
            end_min: s.end_min,
          })),
          resource_id: resourceId,
          resource_name: resourceName,
          title,
        }
      } finally {
        client.release()
      }
    },
  }),

  searchResourcesByCapability: createTool({
    id: 'search_resources_by_capability',
    description: 'Search resources by their capabilities. Accepts a free-text problem description and returns matching resources whose capabilities best match the query. Returns resource id, name, description, and capabilities text.',
    inputSchema: z.object({
      query: z.string().min(1).max(500).describe('The customer problem description or search terms to match against resource capabilities'),
    }),
    execute: async ({ query }) => {
      let client = await pool.connect()
      try {
        let terms = query
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean)
          .map(t => t.replace(/[^a-zA-Zäöüß0-9-]/g, ''))
          .filter(t => t.length > 1 && !STOP_WORDS.has(t))

        if (terms.length === 0) {
          return { count: 0, resources: [] }
        }

        let conditions = terms.map((_, i) => `capabilities ILIKE '%' || $${i + 1} || '%'`)
        let params = terms

        // Build ranked query — each matching term adds 1 to rank
        let rankExpr = terms
          .map((_, i) => `CASE WHEN capabilities ILIKE '%' || $${i + 1} || '%' THEN 1 ELSE 0 END`)
          .join(' + ')

        let result = await client.query(
          `SELECT id, name, description, capabilities, (${rankExpr})::int AS rank
           FROM resources
           WHERE capabilities IS NOT NULL AND capabilities != ''
             AND (${conditions.join(' OR ')})
           ORDER BY rank DESC, name ASC
           LIMIT 20`,
          params,
        )

        return {
          count: result.rows.length,
          resources: result.rows.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            capabilities: r.capabilities,
          })),
        }
      } finally {
        client.release()
      }
    },
  }),
}
