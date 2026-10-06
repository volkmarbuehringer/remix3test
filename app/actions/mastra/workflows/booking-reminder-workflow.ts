import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import { db } from '../../../db.ts'
import { sql } from 'remix/data-table'
import { int8, queryRows } from '../../../data/rows.ts'
import { envPositiveNumber } from '../../../config.ts'
import { dbNotificationSender, reportNotificationFailure } from '../notifications/sender.ts'

const REMINDER_WINDOW_HOURS = envPositiveNumber('REMINDER_WINDOW_HOURS', 24)

const queryUpcomingAppointmentsStep = createStep({
  id: 'query-upcoming-appointments',
  inputSchema: z.object({}),
  outputSchema: z.object({
    appointments: z.array(
      z.object({
        id: z.number(),
        userId: z.number(),
        resourceName: z.string(),
        date: z.number(),
        title: z.string(),
      }),
    ),
    count: z.number(),
  }),
  execute: async () => {
    let now = Date.now()
    let windowMs = REMINDER_WINDOW_HOURS * 3_600_000
    let end = now + windowMs

    let rows = await queryRows(
      db,
      sql`SELECT a.id, a.user_id, COALESCE(r.name, 'Unknown') AS resource_name, a.date, a.title
        FROM appointments a
        LEFT JOIN resources r ON r.id = a.resource_id
        WHERE a.date >= ${now} AND a.date <= ${end}
        ORDER BY a.date ASC`,
      z.object({
        id: z.number(),
        user_id: z.number(),
        resource_name: z.string(),
        date: int8,
        title: z.string(),
      }),
    )
    let appointments = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      resourceName: r.resource_name,
      date: r.date,
      title: r.title,
    }))
    return { appointments, count: appointments.length }
  },
})

const sendRemindersStep = createStep({
  id: 'send-reminders',
  inputSchema: z.object({
    appointments: z.array(
      z.object({
        id: z.number(),
        userId: z.number(),
        resourceName: z.string(),
        date: z.number(),
        title: z.string(),
      }),
    ),
    count: z.number(),
  }),
  outputSchema: z.object({
    sent: z.number(),
    failed: z.number(),
    skipped: z.number(),
  }),
  execute: async ({ inputData }) => {
    let sent = 0
    let failed = 0
    let skipped = 0

    for (let appt of inputData.appointments) {
      let check = await db.exec(sql`SELECT 1 FROM appointments WHERE id = ${appt.id}`)
      if ((check.rows ?? []).length === 0) {
        skipped++
        continue
      }

      let reminderPayload = {
        type: 'reminder' as const,
        recipient: String(appt.userId),
        appointmentId: appt.id,
        title: appt.title,
        resourceName: appt.resourceName,
        date: appt.date,
      }
      try {
        let result = await dbNotificationSender.send(
          String(appt.userId),
          'reminder',
          reminderPayload,
        )
        if (result.sent) {
          sent++
        } else {
          reportNotificationFailure(String(appt.userId), 'reminder', reminderPayload, result.error)
          failed++
        }
      } catch (error) {
        reportNotificationFailure(String(appt.userId), 'reminder', reminderPayload, error)
        failed++
      }
    }

    return { sent, failed, skipped }
  },
})

export const bookingReminderWorkflow = createWorkflow({
  id: 'booking-reminder-workflow',
  inputSchema: z.object({}),
  outputSchema: z.object({
    sent: z.number(),
    failed: z.number(),
    skipped: z.number(),
  }),
  schedule: {
    cron: '0 8 * * *',
    timezone: 'Europe/Berlin',
  },
})
  .then(queryUpcomingAppointmentsStep)
  .then(sendRemindersStep)
  .commit()
