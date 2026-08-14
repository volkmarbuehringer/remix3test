import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import { db } from '../../../db.ts'
import { createAppointmentRecord } from '../../../data/appointments.ts'
import { isExclusionConstraintError } from '../../../utils/db-errors.ts'
import { isDateInPast } from '../../../utils/date-utils.ts'
import { isSlotBookable } from '../../../data/appointofferings.ts'
import { appointmentCreatedScorer } from '../scorers/booking-scorers.ts'

const validateBookingStep = createStep({
  id: 'validate-booking',
  inputSchema: z.object({
    resourceId: z.number(),
    date: z.number(),
    startMin: z.number(),
    title: z.string().max(200),
    userId: z.number(),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    resourceId: z.number(),
    date: z.number(),
    startMin: z.number(),
    endMin: z.number(),
    title: z.string(),
    userId: z.number(),
  }),
  execute: async ({ inputData }) => {
    if (isDateInPast(inputData.date)) {
      return {
        valid: false,
        resourceId: inputData.resourceId,
        date: inputData.date,
        startMin: inputData.startMin,
        endMin: inputData.startMin + 60,
        title: inputData.title,
        userId: inputData.userId,
      }
    }
    if (inputData.startMin < 0 || inputData.startMin > 1380 || inputData.startMin % 15 !== 0) {
      return {
        valid: false,
        resourceId: inputData.resourceId,
        date: inputData.date,
        startMin: inputData.startMin,
        endMin: inputData.startMin + 60,
        title: inputData.title,
        userId: inputData.userId,
      }
    }
    let bookable = await isSlotBookable(
      db,
      inputData.date,
      inputData.resourceId,
      inputData.startMin,
      inputData.startMin + 60,
    )
    if (!bookable) {
      return {
        valid: false,
        resourceId: inputData.resourceId,
        date: inputData.date,
        startMin: inputData.startMin,
        endMin: inputData.startMin + 60,
        title: inputData.title,
        userId: inputData.userId,
      }
    }
    return {
      valid: true,
      resourceId: inputData.resourceId,
      date: inputData.date,
      startMin: inputData.startMin,
      endMin: inputData.startMin + 60,
      title: inputData.title,
      userId: inputData.userId,
    }
  },
})

const createAppointmentStep = createStep({
  id: 'create-appointment',
  inputSchema: z.object({
    valid: z.boolean(),
    resourceId: z.number(),
    date: z.number(),
    startMin: z.number(),
    endMin: z.number(),
    title: z.string(),
    userId: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    id: z.number().optional(),
    error: z.string().optional(),
  }),
  scorers: {
    appointmentCreated: {
      scorer: appointmentCreatedScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
  },
  execute: async ({ inputData, loggerVNext }) => {
    if (!inputData.valid) {
      return { success: false, error: 'invalid_params' }
    }

    let during = `[${inputData.startMin},${inputData.endMin})`
    let now = Date.now()

    try {
      let id = await createAppointmentRecord(db, {
        userId: inputData.userId,
        resourceId: inputData.resourceId,
        title: inputData.title,
        dayMs: inputData.date,
        during,
        now,
      })
      loggerVNext?.info('Appointment created', {
        appointmentId: id,
        resourceId: inputData.resourceId,
        userId: inputData.userId,
      })
      return { success: true, id }
    } catch (error: unknown) {
      if (isExclusionConstraintError(error)) {
        return { success: false, error: 'collision' }
      }
      throw error
    }
  },
})

export const bookingWorkflow = createWorkflow({
  id: 'booking-workflow',
  inputSchema: z.object({
    resourceId: z.number(),
    date: z.number(),
    startMin: z.number(),
    title: z.string().max(200),
    userId: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    id: z.number().optional(),
    error: z.string().optional(),
  }),
})
  .then(validateBookingStep)
  .then(createAppointmentStep)
  .commit()
