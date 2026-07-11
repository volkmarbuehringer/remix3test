import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { pool } from '../../../data/connection.ts'
import {
  computeFullHourSlots,
  filterAvailableSlots,
  parseDuring,
} from '../../../data/appointofferings.ts'
import { getTodayUtcMidnight, MS_PER_DAY, formatMinOption } from '../../../utils/date-utils.ts'
import { executeBookingWorkflow, executeCancellationWorkflow } from '../workflow-executor.ts'
import { createAsyncStorage } from '../../../utils/async-storage.ts'

export const { runWithId: runWithUserId, requireId: requireCurrentUserId } =
  createAsyncStorage('customer')

// German stop words that add no search value
const STOP_WORDS = new Set([
  'ich',
  'du',
  'er',
  'sie',
  'es',
  'wir',
  'ihr',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'eines',
  'mein',
  'dein',
  'sein',
  'unser',
  'euer',
  'dieser',
  'diese',
  'dieses',
  'und',
  'oder',
  'aber',
  'denn',
  'doch',
  'sondern',
  'auch',
  'für',
  'auf',
  'an',
  'in',
  'über',
  'unter',
  'neben',
  'zwischen',
  'mit',
  'von',
  'zu',
  'nach',
  'bei',
  'aus',
  'durch',
  'um',
  'ist',
  'sind',
  'war',
  'wird',
  'werden',
  'wurde',
  'bin',
  'bist',
  'hat',
  'haben',
  'hast',
  'habe',
  'nicht',
  'kein',
  'keine',
  'mal',
  'schon',
  'noch',
  'bereits',
  'bitte',
  'danke',
  'einfach',
  'gerne',
  'gern',
  'sehr',
  'viel',
  'wenig',
  'man',
  'kann',
  'können',
  'muss',
  'müssen',
  'soll',
  'sollen',
  'will',
  'wollen',
  'darf',
  'dürfen',
  'mag',
  'mögen',
  'brauche',
  'brauchen',
  'möchte',
  'möchtest',
  'würde',
  'würden',
  'hätte',
  'hätten',
  'wenn',
  'weil',
  'dass',
  'da',
  'als',
  'wie',
  'etwas',
  'alles',
  'nichts',
  'jemand',
  'niemand',
  'hier',
  'dort',
  'dahin',
  'dorthin',
  'jetzt',
  'sofort',
  'später',
  'heute',
  'morgen',
  'gestern',
  'ihnen',
  'ihm',
  'ihn',
  'uns',
  'euch',
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
    description:
      'Findet die nächsten verfügbaren Terminslots für eine Ressource. Parameter: resourceId (Pflicht), daysAhead (optional, Standard 180, maximal 180), offsetDays (optional, Standard 0, maximal 365), title (optional, vom Gespräch abgeleiteter Titel). offsetDays gibt an, wie viele Tage ab heute übersprungen werden sollen (z.B. offsetDays=30 für Termine ab Tag 31). Gibt bis zu 10 Tage mit allen verfügbaren Slots + resource_id + resource_name + title zurück.',
    inputSchema: z.object({
      resourceId: z
        .number()
        .int()
        .positive()
        .describe('Die ID der Ressource, für die freie Slots gesucht werden sollen'),
      daysAhead: z
        .number()
        .int()
        .min(1)
        .max(180)
        .default(180)
        .describe('Wie viele Tage im Voraus gesucht werden soll (maximal 180)'),
      offsetDays: z
        .number()
        .int()
        .min(0)
        .max(365)
        .default(0)
        .describe(
          'Wie viele Tage ab heute übersprungen werden sollen (für später liegende Termine)',
        ),
      title: z
        .string()
        .max(200)
        .default('')
        .describe('Vom Gesprächskontext abgeleiteter Titel für den Termin'),
    }),
    execute: async ({ resourceId, daysAhead, offsetDays, title }) => {
      let client = await pool.connect()
      try {
        let resourceResult = await client.query('SELECT name FROM resources WHERE id = $1', [
          resourceId,
        ])
        let resourceName = resourceResult.rows[0]?.name ?? 'Unbekannt'

        let todayMidnight = getTodayUtcMidnight()
        let startDate = todayMidnight + offsetDays * MS_PER_DAY
        let endDate = startDate + daysAhead * MS_PER_DAY

        let offeringResult = await client.query(
          `SELECT day, during::text AS during
           FROM appointoffering
           WHERE resource_id = $1 AND day >= $2 AND day < $3
           ORDER BY day ASC, during ASC`,
          [resourceId, startDate, endDate],
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
          [resourceId, startDate, endDate],
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

        let byDay = new Map<number, typeof allSlots>()
        for (let s of allSlots) {
          if (byDay.size >= 10) break
          let arr = byDay.get(s.date_epoch_ms)
          if (!arr) {
            arr = []
            byDay.set(s.date_epoch_ms, arr)
          }
          arr.push(s)
        }
        let top = [...byDay.values()].flat()

        return {
          slots: top.map((s) => ({
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
    description:
      'Search resources by their capabilities. Accepts a free-text problem description and returns matching resources whose capabilities best match the query. Returns resource id, name, description, and capabilities text.',
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe(
          'The customer problem description or search terms to match against resource capabilities',
        ),
    }),
    execute: async ({ query }) => {
      let client = await pool.connect()
      try {
        let terms = query
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean)
          .map((t) => t.replace(/[^a-zA-Zäöüß0-9-]/g, ''))
          .filter((t) => t.length > 1 && !STOP_WORDS.has(t))

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
          resources: result.rows.map((r) => ({
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

  triggerBookingWorkflow: createTool({
    id: 'trigger_booking_workflow',
    description:
      'Startet den Buchungs-Workflow für einen Kunden. Parameter: resourceId (Pflicht), title (optional), date (Pflicht, epoch ms), startMin (Pflicht, Minuten seit Mitternacht). Die Buchung wird im Workflow validiert und erstellt. Gibt den Workflow-Status und ggf. die Buchungs-ID zurück.',
    inputSchema: z.object({
      resourceId: z
        .number()
        .int()
        .positive()
        .describe('Die ID der Ressource, die gebucht werden soll'),
      title: z.string().max(200).default('').describe('Titel oder Beschreibung des Termins'),
      date: z.number().describe('Gewünschter Tag als epoch ms'),
      startMin: z
        .number()
        .int()
        .min(0)
        .max(1380)
        .describe('Gewünschte Startzeit in Minuten seit Mitternacht'),
    }),
    execute: async ({ resourceId, title, date, startMin }) => {
      let customerId = requireCurrentUserId()
      return executeBookingWorkflow({ resourceId, customerId, title, date, startMin })
    },
  }),

  cancelBooking: createTool({
    id: 'cancel_booking',
    description:
      'Bricht einen bestehenden Termin ab. Parameter: appointmentId (Pflicht), appointmentSummary (Pflicht, zur Anzeige im Bestätigungsdialog). Stellt sicher, dass der Termin dem aktuell eingeloggten Kunden gehört, löscht ihn und sendet eine Benachrichtigung. Dieses Tool benötigt eine System-Bestätigung — der Kunde sieht einen Bestätigungs-Button. Frage NICHT zusätzlich im Chat nach Bestätigung.',
    requireApproval: true,
    inputSchema: z.object({
      appointmentId: z.number().int().positive().describe('Die ID des zu stornierenden Termins'),
      appointmentSummary: z
        .string()
        .min(1)
        .max(300)
        .describe(
          'PFLICHTFELD: Beschreibe den Termin kurz zur Anzeige im Bestätigungsdialog (z.B. "Massage, 15.07.2026, 14:00–15:00 Uhr")',
        ),
    }),
    execute: async ({ appointmentId }) => {
      let requestingUserId = requireCurrentUserId()
      return executeCancellationWorkflow({ appointmentId, requestingUserId })
    },
  }),

  listMyAppointments: createTool({
    id: 'list_my_appointments',
    description:
      'Zeigt die eigenen bevorstehenden Termine des Kunden an. Parameter: keine. Gibt eine Liste aller zukünftigen Termine des aktuell eingeloggten Kunden zurück mit ID, Datum, Uhrzeit, Ressourcenname und Titel.',
    inputSchema: z.object({}),
    execute: async () => {
      let userId = requireCurrentUserId()
      let todayMidnight = getTodayUtcMidnight()
      let client = await pool.connect()
      try {
        let result = await client.query(
          `SELECT a.id, a.date, a.during::text AS during, a.title, r.name AS resource_name
           FROM appointments a
           JOIN resources r ON r.id = a.resource_id
           WHERE a.user_id = $1 AND a.date >= $2
           ORDER BY a.date ASC`,
          [userId, todayMidnight],
        )
        return {
          appointments: result.rows.map((r) => {
            let parsed = parseDuring(r.during)
            return {
              id: r.id,
              date_epoch_ms: Number(r.date),
              start_min: parsed?.startMin ?? 0,
              end_min: parsed?.endMin ?? 60,
              time_display: parsed
                ? `${formatMinOption(parsed.startMin)}–${formatMinOption(parsed.endMin)}`
                : '',
              title: r.title,
              resource_name: r.resource_name,
            }
          }),
          count: result.rows.length,
        }
      } finally {
        client.release()
      }
    },
  }),

  cancelAllAppointments: createTool({
    id: 'cancel_all_appointments',
    description:
      'Bricht ALLE eigenen bevorstehenden Termine des Kunden ab. Parameter: count (Pflicht, Anzahl der zu stornierenden Termine), appointmentSummaries (Pflicht, Liste der Terminbeschreibungen zur Anzeige). Vor dem Aufruf MÜSSEN dem Kunden die betroffenen Termine gezeigt werden (list_my_appointments). Gibt eine Zusammenfassung mit Anzahl stornierter, fehlgeschlagener und bereits stornierter Termine zurück. Dieses Tool benötigt eine System-Bestätigung — der Kunde sieht einen Bestätigungs-Button.',
    requireApproval: true,
    inputSchema: z.object({
      count: z
        .number()
        .int()
        .nonnegative()
        .default(0)
        .describe('Anzahl der zu stornierenden Termine (für die Anzeige im Bestätigungsdialog)'),
      appointmentSummaries: z
        .array(z.string())
        .default([])
        .describe(
          'PFLICHTFELD: Liste der Terminbeschreibungen zur Anzeige im Bestätigungsdialog (z.B. ["Massage, 15.07. 14:00", "Physio, 16.07. 10:00"])',
        ),
    }),
    execute: async () => {
      let userId = requireCurrentUserId()
      let todayMidnight = getTodayUtcMidnight()
      let appointmentIds: number[]
      let client = await pool.connect()
      try {
        let result = await client.query(
          `SELECT a.id, a.date, a.during::text AS during, a.title, r.name AS resource_name
           FROM appointments a
           JOIN resources r ON r.id = a.resource_id
           WHERE a.user_id = $1 AND a.date >= $2
           ORDER BY a.date ASC`,
          [userId, todayMidnight],
        )
        appointmentIds = result.rows.map((r) => r.id as number)
      } finally {
        client.release()
      }
      if (appointmentIds.length === 0) {
        return { cancelled: 0, failed: 0, skipped: 0, details: [] }
      }
      let cancelled = 0
      let failed = 0
      let skipped = 0
      let details: { id: number; status: string; error?: string }[] = []
      for (let id of appointmentIds) {
        try {
          let wfResult = await executeCancellationWorkflow({
            appointmentId: id,
            requestingUserId: userId,
          })
          if (wfResult.success) {
            cancelled++
            details.push({ id, status: 'cancelled' })
          } else if (wfResult.error === 'already_cancelled') {
            skipped++
            details.push({ id, status: 'already_cancelled' })
          } else {
            failed++
            details.push({ id, status: 'failed', error: wfResult.error })
          }
        } catch (e) {
          failed++
          details.push({ id, status: 'failed', error: e instanceof Error ? e.message : String(e) })
        }
      }
      return { cancelled, failed, skipped, details }
    },
  }),

  confirmResource: createTool({
    id: 'confirm_resource',
    description:
      'Legt dem Kunden eine Resource zur Bestätigung vor. ' +
      'Bei Bestätigung wird mit find_next_available_slots fortgefahren. ' +
      'Bei Ablehnung die nächstbeste Resource vorschlagen.',
    requireApproval: true,
    inputSchema: z.object({
      resourceId: z
        .number()
        .int()
        .positive()
        .describe('Die ID der Resource, die bestätigt werden soll'),
      resourceName: z.string().min(1).max(200).describe('Der Name der Resource zur Anzeige'),
      description: z
        .string()
        .min(1)
        .max(500)
        .describe('PFLICHTFELD: Beschreibe kurz in 1-2 Sätzen, warum diese Resource zum Kundenanliegen passt'),
      previousResourceIds: z
        .array(z.number().int())
        .optional()
        .describe('Bereits abgelehnte Resource-IDs'),
    }),
    execute: async ({ resourceId, resourceName }) => ({ success: true, resourceId, resourceName }),
  }),
}
