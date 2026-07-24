import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import {
  executeCancelUserWorkflow,
  executeConsistencyCheckWorkflow,
  executeLockUserWorkflow,
  executeUnlockUserWorkflow,
  executeUserPreflightWorkflow,
} from '../workflow-executor.ts'
import { generatePdfBuffer } from '../../../utils/pdf-utils.ts'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'

const preflightStep = createStep({
  id: 'preflight',
  inputSchema: z.object({
    action: z.enum(['cancel', 'lock', 'unlock']),
    targetUserId: z.number().positive(),
    adminUserId: z.number().positive(),
    adminEmail: z.string().email(),
  }),
  outputSchema: z.object({
    action: z.enum(['cancel', 'lock', 'unlock']),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    found: z.boolean(),
    user: z.object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
      role: z.string(),
      disabledAt: z.number().nullable(),
    }).optional(),
    pendingCount: z.number(),
    lockedUsers: z.array(z.object({
      id: z.number(), name: z.string(), email: z.string(), pendingCount: z.number(),
    })),
    lockedTotal: z.number(),
    activeUsers: z.array(z.object({
      id: z.number(), name: z.string(), email: z.string(), pendingCount: z.number(),
    })),
    activeTotal: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    let [preflight, consistency] = await Promise.all([
      executeUserPreflightWorkflow({ targetUserId: inputData.targetUserId }),
      executeConsistencyCheckWorkflow(),
    ])
    return {
      action: inputData.action,
      targetUserId: inputData.targetUserId,
      adminUserId: inputData.adminUserId,
      adminEmail: inputData.adminEmail,
      found: preflight.found,
      user: preflight.user,
      pendingCount: preflight.pendingCount,
      lockedUsers: consistency.lockedUsers,
      lockedTotal: consistency.lockedTotal,
      activeUsers: consistency.activeUsers,
      activeTotal: consistency.activeTotal,
      error: preflight.error || (consistency.success ? undefined : 'consistency check failed'),
    }
  },
})

const confirmGateStep = createStep({
  id: 'confirm-gate',
  inputSchema: z.object({
    action: z.enum(['cancel', 'lock', 'unlock']),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    found: z.boolean(),
    user: z.object({
      id: z.number(), name: z.string(), email: z.string(),
      role: z.string(), disabledAt: z.number().nullable(),
    }).optional(),
    pendingCount: z.number(),
    lockedUsers: z.array(z.object({
      id: z.number(), name: z.string(), email: z.string(), pendingCount: z.number(),
    })),
    lockedTotal: z.number(),
    activeUsers: z.array(z.object({
      id: z.number(), name: z.string(), email: z.string(), pendingCount: z.number(),
    })),
    activeTotal: z.number(),
    error: z.string().optional(),
  }),
  suspendSchema: z.object({
    question: z.string(),
    actionType: z.enum(['cancel', 'lock', 'unlock']),
    targetUserName: z.string(),
    targetUserEmail: z.string(),
    pendingCount: z.number(),
    lockedTotal: z.number(),
    activeTotal: z.number(),
  }),
  resumeSchema: z.object({
    confirmed: z.boolean(),
  }),
  outputSchema: z.object({
    confirmed: z.boolean(),
    cancelled: z.boolean().optional(),
    targetUserId: z.number(),
    action: z.enum(['cancel', 'lock', 'unlock']),
    adminUserId: z.number(),
    adminEmail: z.string(),
    user: z.object({
      id: z.number(), name: z.string(), email: z.string(),
      role: z.string(), disabledAt: z.number().nullable(),
    }).optional(),
    pendingCount: z.number(),
    lockedTotal: z.number(),
    activeTotal: z.number(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (resumeData === undefined) {
      return await suspend({
        question: `${inputData.action === 'cancel' ? 'Cancel' : inputData.action === 'lock' ? 'Lock' : 'Unlock'} ${inputData.user?.name ?? 'user'}?`,
        actionType: inputData.action,
        targetUserName: inputData.user?.name ?? 'Unknown',
        targetUserEmail: inputData.user?.email ?? 'unknown',
        pendingCount: inputData.pendingCount,
        lockedTotal: inputData.lockedTotal,
        activeTotal: inputData.activeTotal,
      })
    }
    if (!resumeData.confirmed) {
      return {
        confirmed: false,
        cancelled: true,
        targetUserId: inputData.targetUserId,
        action: inputData.action,
        adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
        user: inputData.user,
        pendingCount: inputData.pendingCount,
        lockedTotal: inputData.lockedTotal,
        activeTotal: inputData.activeTotal,
      }
    }
    return {
      confirmed: true,
      targetUserId: inputData.targetUserId,
      action: inputData.action,
      adminUserId: inputData.adminUserId,
      adminEmail: inputData.adminEmail,
      user: inputData.user,
      pendingCount: inputData.pendingCount,
      lockedTotal: inputData.lockedTotal,
      activeTotal: inputData.activeTotal,
    }
  },
})

const executeActionStep = createStep({
  id: 'execute-action',
  inputSchema: z.object({
    confirmed: z.boolean(),
    targetUserId: z.number(),
    action: z.enum(['cancel', 'lock', 'unlock']),
    adminUserId: z.number(),
    adminEmail: z.string(),
    user: z.object({
      id: z.number(), name: z.string(), email: z.string(),
      role: z.string(), disabledAt: z.number().nullable(),
    }).optional(),
    pendingCount: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    action: z.enum(['cancel', 'lock', 'unlock']),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    user: z.object({
      id: z.number(), name: z.string(), email: z.string(),
      role: z.string(), disabledAt: z.number().nullable(),
    }).optional(),
    deletedAppointments: z.number().optional(),
    auditLogged: z.boolean().optional(),
    notificationSent: z.boolean().optional(),
    error: z.string().optional(),
    pendingCount: z.number(),
    lockedTotal: z.number(),
    activeTotal: z.number(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.confirmed) {
      return {
        success: false, action: inputData.action, targetUserId: inputData.targetUserId,
        adminUserId: inputData.adminUserId, adminEmail: inputData.adminEmail,
        error: 'Not confirmed', pendingCount: inputData.pendingCount,
        lockedTotal: 0, activeTotal: 0,
      }
    }
    let result: {
      success: boolean; targetUserId: number; deletedAppointments?: number;
      error?: string; auditLogged?: boolean; alreadyLocked?: boolean;
      alreadyUnlocked?: boolean; notificationSent?: boolean;
    } = { success: false, targetUserId: inputData.targetUserId }

    if (inputData.action === 'cancel') {
      result = await executeCancelUserWorkflow({
        targetUserId: inputData.targetUserId, adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail, deleteAppointments: true,
      })
    } else if (inputData.action === 'lock') {
      let r = await executeLockUserWorkflow({
        targetUserId: inputData.targetUserId, adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
      })
      result = { success: r.success, targetUserId: inputData.targetUserId, error: r.error, auditLogged: r.auditLogged }
    } else {
      let r = await executeUnlockUserWorkflow({
        targetUserId: inputData.targetUserId, adminUserId: inputData.adminUserId,
        adminEmail: inputData.adminEmail,
      })
      result = { success: r.success, targetUserId: inputData.targetUserId, error: r.error, auditLogged: r.auditLogged }
    }

    return {
      success: result.success,
      action: inputData.action,
      targetUserId: inputData.targetUserId,
      adminUserId: inputData.adminUserId,
      adminEmail: inputData.adminEmail,
      user: inputData.user,
      deletedAppointments: result.deletedAppointments,
      auditLogged: result.auditLogged,
      error: result.error,
      pendingCount: inputData.pendingCount,
      lockedTotal: 0,
      activeTotal: 0,
    }
  },
})

const finalizeStep = createStep({
  id: 'finalize',
  inputSchema: z.object({
    success: z.boolean(),
    action: z.enum(['cancel', 'lock', 'unlock']),
    targetUserId: z.number(),
    adminUserId: z.number(),
    adminEmail: z.string(),
    user: z.object({
      id: z.number(), name: z.string(), email: z.string(),
      role: z.string(), disabledAt: z.number().nullable(),
    }).optional(),
    deletedAppointments: z.number().optional(),
    auditLogged: z.boolean().optional(),
    error: z.string().optional(),
    pendingCount: z.number(),
    lockedTotal: z.number(),
    activeTotal: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    action: z.enum(['cancel', 'lock', 'unlock']),
    targetUserId: z.number(),
    targetUserName: z.string(),
    targetUserEmail: z.string(),
    deletedAppointments: z.number(),
    auditLogged: z.boolean(),
    reportPdf: z.string().optional(),
    reportFilename: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.success) {
      return {
        success: false, action: inputData.action, targetUserId: inputData.targetUserId,
        targetUserName: inputData.user?.name ?? 'Unknown',
        targetUserEmail: inputData.user?.email ?? 'unknown',
        deletedAppointments: 0, auditLogged: false, error: inputData.error,
      }
    }

    let safeName = (inputData.user?.name ?? 'user').replace(/[^a-zA-Z0-9_-]/g, '_')
    let dateFormatted = new Date().toISOString().slice(0, 10)
    let titleText: string
    let actionLabel: string
    let actionDesc: string
    if (inputData.action === 'cancel') {
      titleText = 'Cancellation Report'
      actionLabel = 'Account Cancelled'
      actionDesc = 'Login disabled, API tokens revoked, future appointments deleted'
    } else if (inputData.action === 'lock') {
      titleText = 'Account Lock Report'
      actionLabel = 'Account Locked'
      actionDesc = 'Login disabled, all data and appointments preserved'
    } else {
      titleText = 'Account Unlock Report'
      actionLabel = 'Account Unlocked'
      actionDesc = 'Login re-enabled, existing sessions invalidated'
    }

    let docDef: TDocumentDefinitions = {
      content: [
        { text: titleText, style: 'header' },
        { text: `Generated: ${dateFormatted}  |  Report: ${inputData.action}-${safeName}-${dateFormatted}`, style: 'subheader' },
        { text: '', margin: [0, 10, 0, 0] },
        { text: 'Admin', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1, widths: ['auto', '*'],
            body: [
              [{ text: 'Field', bold: true }, { text: 'Value', bold: true }],
              ['ID', String(inputData.adminUserId)],
              ['Email', inputData.adminEmail],
            ],
          },
        },
        { text: '', margin: [0, 10, 0, 0] },
        { text: 'Target User', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1, widths: ['auto', '*'],
            body: [
              [{ text: 'Field', bold: true }, { text: 'Value', bold: true }],
              ['Name', inputData.user?.name ?? 'Unknown'],
              ['Email', inputData.user?.email ?? 'unknown'],
              ['User ID', String(inputData.targetUserId)],
            ],
          },
        },
        { text: '', margin: [0, 10, 0, 0] },
        { text: 'Action Summary', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1, widths: ['auto', '*'],
            body: [
              [{ text: 'Field', bold: true }, { text: 'Value', bold: true }],
              ['Action', actionLabel],
              ['Details', actionDesc],
              ...(inputData.action === 'cancel'
                ? [['Appointments Deleted', `Yes (${inputData.deletedAppointments ?? 0})`]]
                : []),
            ],
          },
        },
        { text: '', margin: [0, 10, 0, 0] },
        { text: 'Audit Logged', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1, widths: ['auto', '*'],
            body: [
              [{ text: 'Field', bold: true }, { text: 'Value', bold: true }],
              ['Audit entry', inputData.auditLogged ? 'Yes' : 'No'],
            ],
          },
        },
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        subheader: { fontSize: 10, color: '#666', margin: [0, 0, 0, 20] },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 10, 0, 4] },
      },
    }
    let buf = await generatePdfBuffer(docDef)

    return {
      success: true,
      action: inputData.action,
      targetUserId: inputData.targetUserId,
      targetUserName: inputData.user?.name ?? 'Unknown',
      targetUserEmail: inputData.user?.email ?? 'unknown',
      deletedAppointments: inputData.deletedAppointments ?? 0,
      auditLogged: inputData.auditLogged ?? false,
      reportPdf: buf.toString('base64'),
      reportFilename: `${inputData.action}-report-${safeName}-${dateFormatted}.pdf`,
    }
  },
})

export const userManagementWorkflow = createWorkflow({
  id: 'userManagementWorkflow',
  inputSchema: z.object({
    action: z.enum(['cancel', 'lock', 'unlock']),
    targetUserId: z.number().positive(),
    adminUserId: z.number().positive(),
    adminEmail: z.string().email(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    action: z.enum(['cancel', 'lock', 'unlock']),
    targetUserId: z.number(),
    targetUserName: z.string(),
    targetUserEmail: z.string(),
    deletedAppointments: z.number(),
    auditLogged: z.boolean(),
    reportPdf: z.string().optional(),
    reportFilename: z.string().optional(),
    error: z.string().optional(),
  }),
})
  .then(preflightStep)
  .then(confirmGateStep)
  .then(executeActionStep)
  .then(finalizeStep)
  .commit()
