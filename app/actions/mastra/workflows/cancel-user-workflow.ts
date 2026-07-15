import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import { db } from '../../../data/connection.ts'
import { logAdminAction } from '../../../data/audit-log.ts'
import { getTodayUtcMidnight } from '../../../utils/date-utils.ts'
import { consoleNotificationSender } from '../notifications/sender.ts'
import { enqueueFailedNotification } from '../notifications/queue.ts'

const validateTargetStep = createStep({
  id: 'validate-target',
  inputSchema: z.object({
    targetUserId: z.number().positive(),
    adminUserId: z.number().positive(),
    adminEmail: z.string().email(),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    userEmail: z.string().optional(),
    userName: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (inputData.targetUserId === inputData.adminUserId) {
      return {
        valid: false,
        targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        error: 'Cannot cancel your own account',
      }
    }
    let result = await db.exec(
      'SELECT id, email, name, role, disabled_at FROM users WHERE id = $1',
      [inputData.targetUserId],
    )
    let rows = result.rows as Array<Record<string, unknown>> | undefined
    let row = rows?.[0]
    if (!row) {
      return {
        valid: false,
        targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        error: 'User not found',
      }
    }
    if (row.role === 'admin') {
      return {
        valid: false,
        targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        error: 'Cannot cancel admin accounts',
      }
    }
    if (row.disabled_at != null) {
      return {
        valid: false,
        targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        error: 'Account already disabled',
      }
    }
    return {
      valid: true,
      targetUserId: inputData.targetUserId,
      adminUserId: inputData.adminUserId,
      adminEmail: inputData.adminEmail,
      userEmail: String(row.email ?? ''),
      userName: String(row.name ?? ''),
    }
  },
})

const deleteAndDisableAccountStep = createStep({
  id: 'delete-and-disable-account',
  inputSchema: z.object({
    valid: z.boolean(),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    userEmail: z.string().optional(),
    userName: z.string().optional(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    disabled: z.boolean(),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    userEmail: z.string().optional(),
    userName: z.string().optional(),
    deletedAppointments: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.valid) {
      return {
        valid: false,
        disabled: false,
        targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        userEmail: inputData.userEmail,
        userName: inputData.userName,
        deletedAppointments: 0,
        error: inputData.error,
      }
    }
    let now = Date.now()
    let todayMidnight = getTodayUtcMidnight()

    return await db.transaction(async (tx) => {
      let delResult = await tx.exec(
        'DELETE FROM appointments WHERE user_id = $1 AND date >= $2',
        [inputData.targetUserId, todayMidnight],
      )
      let deletedAppointments = delResult.affectedRows ?? 0

      let disableResult = await tx.exec(
        'UPDATE users SET disabled_at = $1, token_version = token_version + 1, updated_at = $1 WHERE id = $2 AND disabled_at IS NULL',
        [now, inputData.targetUserId],
      )
      if ((disableResult.affectedRows ?? 0) === 0) {
        return {
          valid: false,
          disabled: false,
          targetUserId: inputData.targetUserId,
          adminUserId: inputData.adminUserId,
          adminEmail: inputData.adminEmail,
          userEmail: inputData.userEmail,
          userName: inputData.userName,
          deletedAppointments,
          error: 'Account already disabled',
        }
      }

      await tx.exec(
        'UPDATE api_tokens SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL',
        [now, inputData.targetUserId],
      )

      return {
        valid: true,
        disabled: true,
        targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        userEmail: inputData.userEmail,
        userName: inputData.userName,
        deletedAppointments,
      }
    })
  },
})

const auditLogStep = createStep({
  id: 'audit-log',
  inputSchema: z.object({
    valid: z.boolean(),
    disabled: z.boolean(),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    userEmail: z.string().optional(),
    userName: z.string().optional(),
    deletedAppointments: z.number(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    valid: z.boolean(),
    disabled: z.boolean(),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    userEmail: z.string().optional(),
    userName: z.string().optional(),
    deletedAppointments: z.number(),
    auditLogged: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.valid || !inputData.disabled) {
      return {
        valid: inputData.valid,
        disabled: inputData.disabled,
        targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        userEmail: inputData.userEmail,
        userName: inputData.userName,
        deletedAppointments: inputData.deletedAppointments,
        auditLogged: false,
        error: inputData.error,
      }
    }
    try {
      await logAdminAction(db, {
        admin_user_id: inputData.adminUserId,
        admin_email: inputData.adminEmail,
        action_type: 'user_cancelled',
        target_type: 'user',
        target_id: String(inputData.targetUserId),
        details: {
          targetEmail: inputData.userEmail,
          targetName: inputData.userName,
          deletedAppointments: inputData.deletedAppointments,
        },
      })
      return {
        valid: true,
        disabled: true,
        targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        userEmail: inputData.userEmail,
        userName: inputData.userName,
        deletedAppointments: inputData.deletedAppointments,
        auditLogged: true,
      }
    } catch {
      return {
        valid: true,
        disabled: true,
        targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        userEmail: inputData.userEmail,
        userName: inputData.userName,
        deletedAppointments: inputData.deletedAppointments,
        auditLogged: false,
      }
    }
  },
})

const notifyUserStep = createStep({
  id: 'notify-user',
  inputSchema: z.object({
    valid: z.boolean(),
    disabled: z.boolean(),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    userEmail: z.string().optional(),
    userName: z.string().optional(),
    deletedAppointments: z.number(),
    auditLogged: z.boolean(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    targetUserId: z.number(),
    deletedAppointments: z.number(),
    auditLogged: z.boolean(),
    notificationSent: z.boolean().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.valid || !inputData.disabled) {
      return {
        success: false,
        targetUserId: inputData.targetUserId,
        deletedAppointments: inputData.deletedAppointments,
        auditLogged: false,
        error: inputData.error,
      }
    }
    try {
      let result = await consoleNotificationSender.send(
        String(inputData.targetUserId),
        'cancellation',
        {
          type: 'cancellation',
          recipient: String(inputData.targetUserId),
          customerName: inputData.userName,
          title: 'Account cancelled',
        },
      )
      if (!result.sent) {
        enqueueFailedNotification(String(inputData.targetUserId), 'cancellation', {
          type: 'cancellation',
          recipient: String(inputData.targetUserId),
          customerName: inputData.userName,
          title: 'Account cancelled',
        })
      }
      return {
        success: true,
        targetUserId: inputData.targetUserId,
        deletedAppointments: inputData.deletedAppointments,
        auditLogged: inputData.auditLogged,
        notificationSent: result.sent,
      }
    } catch {
      enqueueFailedNotification(String(inputData.targetUserId), 'cancellation', {
        type: 'cancellation',
        recipient: String(inputData.targetUserId),
        customerName: inputData.userName,
        title: 'Account cancelled',
      })
      return {
        success: true,
        targetUserId: inputData.targetUserId,
        deletedAppointments: inputData.deletedAppointments,
        auditLogged: inputData.auditLogged,
        notificationSent: false,
      }
    }
  },
})

export const cancelUserWorkflow = createWorkflow({
  id: 'cancel-user-workflow',
  inputSchema: z.object({
    targetUserId: z.number().positive(),
    adminUserId: z.number().positive(),
    adminEmail: z.string().email(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    targetUserId: z.number(),
    deletedAppointments: z.number(),
    auditLogged: z.boolean(),
    error: z.string().optional(),
    notificationSent: z.boolean().optional(),
  }),
})
  .then(validateTargetStep)
  .then(deleteAndDisableAccountStep)
  .then(auditLogStep)
  .then(notifyUserStep)
  .commit()
