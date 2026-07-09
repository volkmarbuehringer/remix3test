import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import { db } from '../../../data/connection.ts'
import { createAppointmentRecord } from '../../../data/appointments.ts'
import { isExclusionConstraintError } from '../../../utils/db-errors.ts'
import { isDateInPast } from '../../../utils/date-utils.ts'
import { isSlotBookable } from '../../../data/appointofferings.ts'
import { pool } from '../../../data/connection.ts'
import { consoleNotificationSender } from '../notifications/sender.ts'
import { enqueueFailedNotification } from '../notifications/queue.ts'
import { formatMinOption } from '../../../utils/date-utils.ts'

const findAvailableSlotsStep = createStep({
  id: 'find-available-slots',
  inputSchema: z.object({
    resourceId: z.number(),
    customerId: z.number(),
    title: z.string().max(200).default(''),
    date: z.number().optional(),
    startMin: z.number().optional(),
  }),
  outputSchema: z.object({
    hasSlots: z.boolean(),
    resourceId: z.number(),
    customerId: z.number(),
    title: z.string(),
    date: z.number().optional(),
    startMin: z.number().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    let { resourceId, customerId, title, date, startMin } = inputData

    if (date !== undefined && startMin !== undefined) {
      let bookable = await isSlotBookable(db, date, resourceId, startMin, startMin + 60)
      if (!bookable) {
        return { hasSlots: false, resourceId, customerId, title, error: 'Slot is no longer available' }
      }
      if (isDateInPast(date)) {
        return { hasSlots: false, resourceId, customerId, title, error: 'Cannot book in the past' }
      }
      return { hasSlots: true, resourceId, customerId, title, date, startMin }
    }

    let client = await pool.connect()
    try {
      let todayMidnight = new Date()
      todayMidnight.setUTCHours(0, 0, 0, 0)
      let startDate = todayMidnight.getTime()
      let endDate = startDate + 180 * 86_400_000

      let offeringResult = await client.query(
        `SELECT day, during::text AS during
         FROM appointoffering
         WHERE resource_id = $1 AND day >= $2 AND day < $3
         ORDER BY day ASC, during ASC`,
        [resourceId, startDate, endDate],
      )

      if (offeringResult.rows.length === 0) {
        return { hasSlots: false, resourceId, customerId, title, error: 'Keine freien Termine verfügbar' }
      }

      return { hasSlots: true, resourceId, customerId, title }
    } finally {
      client.release()
    }
  },
})

const createAppointmentStep = createStep({
  id: 'create-appointment',
  inputSchema: z.object({
    hasSlots: z.boolean(),
    resourceId: z.number(),
    customerId: z.number(),
    title: z.string(),
    date: z.number().optional(),
    startMin: z.number().optional(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    id: z.number().optional(),
    resourceId: z.number(),
    customerId: z.number(),
    title: z.string(),
    date: z.number().optional(),
    startMin: z.number().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.hasSlots || inputData.date === undefined || inputData.startMin === undefined) {
      return { success: false, resourceId: inputData.resourceId, customerId: inputData.customerId, title: inputData.title, error: inputData.error ?? 'invalid_params' }
    }

    let during = `[${inputData.startMin},${inputData.startMin + 60})`
    let now = Date.now()

    try {
      let id = await createAppointmentRecord(db, {
        userId: inputData.customerId,
        resourceId: inputData.resourceId,
        title: inputData.title,
        dayMs: inputData.date,
        during,
        now,
      })
      return { success: true, id, resourceId: inputData.resourceId, customerId: inputData.customerId, title: inputData.title, date: inputData.date, startMin: inputData.startMin }
    } catch (error: unknown) {
      if (isExclusionConstraintError(error)) {
        return { success: false, resourceId: inputData.resourceId, customerId: inputData.customerId, title: inputData.title, error: 'collision' }
      }
      throw error
    }
  },
})

const sendConfirmationStep = createStep({
  id: 'send-confirmation',
  inputSchema: z.object({
    success: z.boolean(),
    id: z.number().optional(),
    resourceId: z.number(),
    customerId: z.number(),
    title: z.string(),
    date: z.number().optional(),
    startMin: z.number().optional(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    id: z.number().optional(),
    error: z.string().optional(),
    notificationSent: z.boolean().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.success || !inputData.id) {
      return { success: false, error: inputData.error }
    }

    let timeRange = inputData.startMin !== undefined
      ? `${formatMinOption(inputData.startMin)}–${formatMinOption(inputData.startMin + 60)}`
      : undefined

    let payload = {
      type: 'confirmation' as const,
      recipient: String(inputData.customerId),
      appointmentId: inputData.id,
      title: inputData.title,
      date: inputData.date,
      timeRange,
    }

    try {
      let result = await consoleNotificationSender.send(String(inputData.customerId), 'confirmation', payload)
      if (!result.sent) {
        enqueueFailedNotification(String(inputData.customerId), 'confirmation', payload)
      }
      return { success: true, id: inputData.id, notificationSent: result.sent }
    } catch {
      enqueueFailedNotification(String(inputData.customerId), 'confirmation', payload)
      return { success: true, id: inputData.id, notificationSent: false }
    }
  },
})

export const customerBookingWorkflow = createWorkflow({
  id: 'customer-booking-workflow',
  inputSchema: z.object({
    resourceId: z.number(),
    customerId: z.number(),
    title: z.string().max(200).default(''),
    date: z.number().optional(),
    startMin: z.number().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    id: z.number().optional(),
    error: z.string().optional(),
    notificationSent: z.boolean().optional(),
  }),
})
  .then(findAvailableSlotsStep)
  .then(createAppointmentStep)
  .then(sendConfirmationStep)
  .commit()
