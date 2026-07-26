import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import { db } from '../../../data/connection.ts'
import { logAdminAction } from '../../../data/audit-log.ts'
import { getTodayUtcMidnight } from '../../../utils/date-utils.ts'

const preflightStep = createStep({
  id: 'preflight',
  inputSchema: z.object({
    targetUserId: z.number().positive(),
    resourceId: z.number().positive(),
    adminUserId: z.number().positive(),
    adminEmail: z.string().email(),
  }),
  outputSchema: z.object({
    targetUserId: z.number(),
    resourceId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    targetUserName: z.string(),
    resourceName: z.string(),
    upcomingCount: z.number(),
    upcomingDates: z.array(z.string()),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    let userResult = await db.exec('SELECT name FROM users WHERE id = $1', [inputData.targetUserId])
    let userRow = (userResult.rows ?? [])[0] as { name: string } | undefined
    if (!userRow)
      return {
        ...inputData,
        targetUserName: 'Unknown',
        resourceName: 'Unknown',
        upcomingCount: 0,
        upcomingDates: [],
        error: 'User not found',
      }

    let resourceResult = await db.exec('SELECT name FROM resources WHERE id = $1', [
      inputData.resourceId,
    ])
    let resourceRow = (resourceResult.rows ?? [])[0] as { name: string } | undefined
    if (!resourceRow)
      return {
        ...inputData,
        targetUserName: userRow.name,
        resourceName: 'Unknown',
        upcomingCount: 0,
        upcomingDates: [],
        error: 'Resource not found',
      }

    let todayMidnight = getTodayUtcMidnight()
    let aptResult = await db.exec(
      `SELECT a.date, a.start_min, a.end_min
       FROM appointments a
       WHERE a.user_id = $1 AND a.resource_id = $2 AND a.date >= $3
       ORDER BY a.date ASC`,
      [inputData.targetUserId, inputData.resourceId, todayMidnight],
    )
    let rows = (aptResult.rows ?? []) as Array<{ date: number; start_min: number; end_min: number }>
    let dates = rows.map((r) => {
      let d = new Date(Number(r.date))
      return Number.isNaN(d.getTime()) ? 'unknown' : d.toISOString().slice(0, 10)
    })

    return {
      targetUserId: inputData.targetUserId,
      resourceId: inputData.resourceId,
      adminUserId: inputData.adminUserId,
      adminEmail: inputData.adminEmail,
      targetUserName: userRow.name,
      resourceName: resourceRow.name,
      upcomingCount: rows.length,
      upcomingDates: dates,
    }
  },
})

const confirmGateStep = createStep({
  id: 'confirm-gate',
  inputSchema: z.object({
    targetUserId: z.number(),
    resourceId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    targetUserName: z.string(),
    resourceName: z.string(),
    upcomingCount: z.number(),
    upcomingDates: z.array(z.string()),
    error: z.string().optional(),
  }),
  suspendSchema: z.object({
    question: z.string(),
    actionType: z.string(),
    targetUserName: z.string(),
    resourceName: z.string(),
    pendingCount: z.number(),
  }),
  resumeSchema: z.object({
    confirmed: z.boolean(),
  }),
  outputSchema: z.object({
    confirmed: z.boolean(),
    cancelled: z.boolean().optional(),
    targetUserId: z.number(),
    resourceId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    targetUserName: z.string(),
    resourceName: z.string(),
    upcomingCount: z.number(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (resumeData === undefined) {
      return await suspend({
        question: `${inputData.upcomingCount} Termine von ${inputData.targetUserName} in ${inputData.resourceName} löschen?`,
        actionType: 'delete-appointments',
        targetUserName: inputData.targetUserName,
        resourceName: inputData.resourceName,
        pendingCount: inputData.upcomingCount,
      })
    }
    if (!resumeData.confirmed) {
      return {
        confirmed: false,
        cancelled: true,
        targetUserId: inputData.targetUserId,
        resourceId: inputData.resourceId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        targetUserName: inputData.targetUserName,
        resourceName: inputData.resourceName,
        upcomingCount: inputData.upcomingCount,
      }
    }
    return {
      confirmed: true,
      targetUserId: inputData.targetUserId,
      resourceId: inputData.resourceId,
      adminUserId: inputData.adminUserId,
      adminEmail: inputData.adminEmail,
      targetUserName: inputData.targetUserName,
      resourceName: inputData.resourceName,
      upcomingCount: inputData.upcomingCount,
    }
  },
})

const executeStep = createStep({
  id: 'execute',
  inputSchema: z.object({
    confirmed: z.boolean(),
    targetUserId: z.number(),
    resourceId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    targetUserName: z.string(),
    resourceName: z.string(),
    upcomingCount: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    targetUserId: z.number(),
    resourceId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    targetUserName: z.string(),
    resourceName: z.string(),
    deletedCount: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.confirmed) {
      return {
        success: false,
        targetUserId: inputData.targetUserId,
        resourceId: inputData.resourceId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        targetUserName: inputData.targetUserName,
        resourceName: inputData.resourceName,
        deletedCount: 0,
        error: 'Not confirmed',
      }
    }

    let todayMidnight = getTodayUtcMidnight()
    let delResult = await db.exec(
      'DELETE FROM appointments WHERE user_id = $1 AND resource_id = $2 AND date >= $3',
      [inputData.targetUserId, inputData.resourceId, todayMidnight],
    )

    return {
      success: true,
      targetUserId: inputData.targetUserId,
      resourceId: inputData.resourceId,
      adminUserId: inputData.adminUserId,
      adminEmail: inputData.adminEmail,
      targetUserName: inputData.targetUserName,
      resourceName: inputData.resourceName,
      deletedCount: delResult.affectedRows ?? 0,
    }
  },
})

const finalizeStep = createStep({
  id: 'finalize',
  inputSchema: z.object({
    success: z.boolean(),
    targetUserId: z.number(),
    resourceId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    targetUserName: z.string(),
    resourceName: z.string(),
    deletedCount: z.number(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    targetUserId: z.number(),
    targetUserName: z.string(),
    resourceName: z.string(),
    deletedCount: z.number(),
    auditLogged: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.success) {
      return {
        success: false,
        targetUserId: inputData.targetUserId,
        targetUserName: inputData.targetUserName,
        resourceName: inputData.resourceName,
        deletedCount: 0,
        auditLogged: false,
        error: inputData.error,
      }
    }

    try {
      await logAdminAction(db, {
        admin_user_id: inputData.adminUserId,
        admin_email: inputData.adminEmail,
        action_type: 'delete-appointments',
        target_type: 'appointment',
        target_id: String(inputData.targetUserId),
        details: {
          resourceId: inputData.resourceId,
          resourceName: inputData.resourceName,
          deletedCount: inputData.deletedCount,
          targetUserName: inputData.targetUserName,
        },
      })
      return {
        success: true,
        targetUserId: inputData.targetUserId,
        targetUserName: inputData.targetUserName,
        resourceName: inputData.resourceName,
        deletedCount: inputData.deletedCount,
        auditLogged: true,
      }
    } catch {
      return {
        success: true,
        targetUserId: inputData.targetUserId,
        targetUserName: inputData.targetUserName,
        resourceName: inputData.resourceName,
        deletedCount: inputData.deletedCount,
        auditLogged: false,
      }
    }
  },
})

export const deleteUserAppointmentsWorkflow = createWorkflow({
  id: 'deleteUserAppointmentsWorkflow',
  inputSchema: z.object({
    targetUserId: z.number().positive(),
    resourceId: z.number().positive(),
    adminUserId: z.number().positive(),
    adminEmail: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    targetUserId: z.number(),
    targetUserName: z.string(),
    resourceName: z.string(),
    deletedCount: z.number(),
    auditLogged: z.boolean(),
    error: z.string().optional(),
  }),
})
  .then(preflightStep)
  .then(confirmGateStep)
  .then(executeStep)
  .then(finalizeStep)
  .commit()
