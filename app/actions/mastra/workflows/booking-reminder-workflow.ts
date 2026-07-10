import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import { pool } from '../../../data/connection.ts'
import { consoleNotificationSender } from '../notifications/sender.ts'
import { enqueueFailedNotification } from '../notifications/queue.ts'

const REMINDER_WINDOW_HOURS = Number(process.env.REMINDER_WINDOW_HOURS) || 24

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

    let client = await pool.connect()
    try {
      let result = await client.query(
        `SELECT a.id, a.user_id, COALESCE(r.name, 'Unknown') AS resource_name, a.date, a.title
         FROM appointments a
         LEFT JOIN resources r ON r.id = a.resource_id
         WHERE a.date >= $1 AND a.date <= $2
         ORDER BY a.date ASC`,
        [now, end],
      )
      let appointments = result.rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        resourceName: r.resource_name,
        date: Number(r.date),
        title: r.title,
      }))
      return { appointments, count: appointments.length }
    } finally {
      client.release()
    }
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
      let client = await pool.connect()
      try {
        let check = await client.query('SELECT 1 FROM appointments WHERE id = $1', [appt.id])
        if (check.rows.length === 0) {
          skipped++
          continue
        }
      } finally {
        client.release()
      }

      try {
        let result = await consoleNotificationSender.send(String(appt.userId), 'reminder', {
          type: 'reminder',
          recipient: String(appt.userId),
          appointmentId: appt.id,
        })
        if (result.sent) {
          sent++
        } else {
          enqueueFailedNotification(String(appt.userId), 'reminder', {
            type: 'reminder',
            recipient: String(appt.userId),
            appointmentId: appt.id,
          })
          failed++
        }
      } catch {
        enqueueFailedNotification(String(appt.userId), 'reminder', {
          type: 'reminder',
          recipient: String(appt.userId),
          appointmentId: appt.id,
        })
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
