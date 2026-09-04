import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import { db } from '../../../db.ts'
import { deleteAppointmentRecord } from '../../../data/appointments.ts'
import { dbNotificationSender } from '../notifications/sender.ts'
import { enqueueFailedNotification } from '../notifications/queue.ts'

const verifyOwnershipStep = createStep({
  id: 'verify-ownership',
  inputSchema: z.object({
    appointmentId: z.number(),
    requestingUserId: z.number(),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    appointmentId: z.number(),
    requestingUserId: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    let result = await db.exec('SELECT id, user_id FROM appointments WHERE id = $1', [
      inputData.appointmentId,
    ])
    let rows = result.rows as Array<{ id: number; user_id: number }> | undefined

    if (!rows || rows.length === 0) {
      return {
        valid: false,
        appointmentId: inputData.appointmentId,
        requestingUserId: inputData.requestingUserId,
        error: 'already_cancelled',
      }
    }

    if (rows[0]!.user_id !== inputData.requestingUserId) {
      return {
        valid: false,
        appointmentId: inputData.appointmentId,
        requestingUserId: inputData.requestingUserId,
        error: 'not_owner',
      }
    }

    return {
      valid: true,
      appointmentId: inputData.appointmentId,
      requestingUserId: inputData.requestingUserId,
    }
  },
})

const deleteAppointmentStep = createStep({
  id: 'delete-appointment',
  inputSchema: z.object({
    valid: z.boolean(),
    appointmentId: z.number(),
    requestingUserId: z.number(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    appointmentId: z.number(),
    requestingUserId: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.valid) {
      return {
        success: false,
        appointmentId: inputData.appointmentId,
        requestingUserId: inputData.requestingUserId,
        error: inputData.error,
      }
    }

    let deleted = await deleteAppointmentRecord(
      db,
      String(inputData.appointmentId),
      inputData.requestingUserId,
    )
    if (!deleted) {
      return {
        success: false,
        appointmentId: inputData.appointmentId,
        requestingUserId: inputData.requestingUserId,
        error: 'already_cancelled',
      }
    }

    return {
      success: true,
      appointmentId: inputData.appointmentId,
      requestingUserId: inputData.requestingUserId,
    }
  },
})

const sendCancellationNotificationStep = createStep({
  id: 'send-cancellation-notification',
  inputSchema: z.object({
    success: z.boolean(),
    appointmentId: z.number(),
    requestingUserId: z.number(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    appointmentId: z.number(),
    notificationSent: z.boolean().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.success) {
      return { success: false, appointmentId: inputData.appointmentId, error: inputData.error }
    }

    let recipient = String(inputData.requestingUserId)
    try {
      // The appointment row is already deleted, so do not reference it in the
      // notification (notifications.appointment_id is a FK to appointments).
      let result = await dbNotificationSender.send(recipient, 'cancellation', {
        type: 'cancellation',
        recipient,
      })
      if (!result.sent) {
        enqueueFailedNotification(recipient, 'cancellation', {
          type: 'cancellation',
          recipient,
        })
      }
      return {
        success: true,
        appointmentId: inputData.appointmentId,
        notificationSent: result.sent,
      }
    } catch {
      enqueueFailedNotification(recipient, 'cancellation', {
        type: 'cancellation',
        recipient,
      })
      return { success: true, appointmentId: inputData.appointmentId, notificationSent: false }
    }
  },
})

export const bookingCancellationWorkflow = createWorkflow({
  id: 'booking-cancellation-workflow',
  inputSchema: z.object({
    appointmentId: z.number(),
    requestingUserId: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    appointmentId: z.number(),
    error: z.string().optional(),
    notificationSent: z.boolean().optional(),
  }),
})
  .then(verifyOwnershipStep)
  .then(deleteAppointmentStep)
  .then(sendCancellationNotificationStep)
  .commit()
