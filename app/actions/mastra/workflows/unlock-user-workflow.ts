import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import { db } from '../../../db.ts'
import { logAdminAction } from '../../../data/audit-log.ts'

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
    userName: z.string().optional(),
    userEmail: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (inputData.targetUserId === inputData.adminUserId) {
      return {
        valid: false,
        targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        error: 'Cannot unlock your own account',
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
    return {
      valid: true,
      targetUserId: inputData.targetUserId,
      adminUserId: inputData.adminUserId,
      adminEmail: inputData.adminEmail,
      userName: String(row.name ?? ''),
      userEmail: String(row.email ?? ''),
    }
  },
})

const executeUnlockStep = createStep({
  id: 'execute-unlock',
  inputSchema: z.object({
    valid: z.boolean(),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    userName: z.string().optional(),
    userEmail: z.string().optional(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    userName: z.string().optional(),
    userEmail: z.string().optional(),
    alreadyUnlocked: z.boolean().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.valid) {
      return {
        success: false,
        targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        userName: inputData.userName,
        userEmail: inputData.userEmail,
        error: inputData.error,
      }
    }
    let result = await db.exec(
      'UPDATE users SET disabled_at = NULL, token_version = token_version + 1, updated_at = $1 WHERE id = $2 AND disabled_at IS NOT NULL',
      [Date.now(), inputData.targetUserId],
    )
    if ((result.affectedRows ?? 0) === 0) {
      // Already in the desired state (e.g. unlocked via the admin panel) — treat as idempotent success.
      return {
        success: true,
        targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        userName: inputData.userName,
        userEmail: inputData.userEmail,
        alreadyUnlocked: true,
      }
    }
    return {
      success: true,
      targetUserId: inputData.targetUserId,
      adminUserId: inputData.adminUserId,
      adminEmail: inputData.adminEmail,
      userName: inputData.userName,
      userEmail: inputData.userEmail,
    }
  },
})

const auditLogStep = createStep({
  id: 'audit-log',
  inputSchema: z.object({
    success: z.boolean(),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    userName: z.string().optional(),
    userEmail: z.string().optional(),
    alreadyUnlocked: z.boolean().optional(),
    error: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    targetUserId: z.number(),
    alreadyUnlocked: z.boolean().optional(),
    error: z.string().optional(),
    auditLogged: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.success) {
      return {
        success: false,
        targetUserId: inputData.targetUserId,
        error: inputData.error,
        auditLogged: false,
      }
    }
    if (inputData.alreadyUnlocked) {
      // No state change — skip the audit entry to avoid double-logging
      // when the unlock already happened via the admin panel.
      return {
        success: true,
        targetUserId: inputData.targetUserId,
        alreadyUnlocked: true,
        auditLogged: false,
      }
    }
    try {
      await logAdminAction(db, {
        admin_user_id: inputData.adminUserId,
        admin_email: inputData.adminEmail,
        action_type: 'unlock',
        target_type: 'user',
        target_id: String(inputData.targetUserId),
        details: {
          targetEmail: inputData.userEmail,
          targetName: inputData.userName,
        },
      })
      return { success: true, targetUserId: inputData.targetUserId, auditLogged: true }
    } catch {
      return { success: true, targetUserId: inputData.targetUserId, auditLogged: false }
    }
  },
})

export const unlockUserWorkflow = createWorkflow({
  id: 'unlock-user-workflow',
  inputSchema: z.object({
    targetUserId: z.number().positive(),
    adminUserId: z.number().positive(),
    adminEmail: z.string().email(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    targetUserId: z.number(),
    alreadyUnlocked: z.boolean().optional(),
    error: z.string().optional(),
    auditLogged: z.boolean(),
  }),
})
  .then(validateTargetStep)
  .then(executeUnlockStep)
  .then(auditLogStep)
  .commit()
