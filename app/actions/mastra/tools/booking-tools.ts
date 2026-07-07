import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { db } from '../../../data/connection.ts'
import { createAppointmentRecord } from '../../../data/appointments-new-queries.ts'
import { isExclusionConstraintError } from '../../../utils/db-errors.ts'
import { isDateInPast } from '../../../utils/date-utils.ts'

export const bookingTools = {
  createAppointment: createTool({
    id: 'create_appointment',
    description: 'Erstellt einen neuen Termin für einen Kunden. Validiert den Slot auf Verfügbarkeit und erstellt den Termin bei Erfolg.',
    inputSchema: z.object({
      resourceId: z.number().int().positive().describe('Die ID der Ressource'),
      date: z.number().int().positive().describe('Der Tag als Epochen-Millisekunden (UTC-Mitternacht)'),
      startMin: z.number().int().min(0).max(1380).describe('Die Startminute des Termins (0-1380)'),
      title: z.string().max(200).default('').describe('Der Titel des Termins'),
      userId: z.number().int().positive().describe('Die ID des Kunden, für den der Termin erstellt wird'),
    }),
    execute: async ({ resourceId, date, startMin, title, userId }) => {
      if (isDateInPast(date)) {
        return { error: 'past_date', message: 'Der Termin liegt in der Vergangenheit.' }
      }

      if (startMin < 0 || startMin > 1380 || startMin % 15 !== 0) {
        return { error: 'invalid_slot', message: 'Die Startzeit ist ungültig.' }
      }

      let endMin = startMin + 60
      let during = `[${startMin},${endMin})`
      let now = Date.now()

      try {
        let id = await createAppointmentRecord(db, {
          userId,
          resourceId,
          title,
          dayMs: date,
          during,
          now,
        })
        return { success: true, id, date, start_min: startMin, end_min: endMin }
      } catch (error: unknown) {
        if (isExclusionConstraintError(error)) {
          return { error: 'collision', message: 'Dieser Zeitraum ist bereits belegt.' }
        }
        throw error
      }
    },
  }),
}
