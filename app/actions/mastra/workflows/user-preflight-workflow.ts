import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import { db } from '../../../db.ts'
import { getTodayUtcMidnight } from '../../../utils/date-utils.ts'

const lookupUserAndCountStep = createStep({
  id: 'lookup-user-and-count',
  inputSchema: z.object({
    targetUserId: z.number().positive(),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    user: z
      .object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        role: z.string(),
        disabledAt: z.number().nullable(),
      })
      .optional(),
    pendingCount: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    let result = await db.exec(
      'SELECT id, email, name, role, disabled_at FROM users WHERE id = $1',
      [inputData.targetUserId],
    )
    let rows = result.rows as Array<Record<string, unknown>> | undefined
    let row = rows?.[0]
    if (!row) {
      return { found: false, pendingCount: 0, error: 'User not found' }
    }

    let todayMidnight = getTodayUtcMidnight()
    let apptResult = await db.exec(
      'SELECT count(*)::int AS count FROM appointments WHERE user_id = $1 AND date >= $2',
      [inputData.targetUserId, todayMidnight],
    )
    let count = Number((apptResult.rows ?? [])[0]?.count ?? 0)

    return {
      found: true,
      user: {
        id: Number(row.id),
        name: String(row.name ?? ''),
        email: String(row.email ?? ''),
        role: String(row.role ?? ''),
        disabledAt: row.disabled_at != null ? Number(row.disabled_at) : null,
      },
      pendingCount: count,
    }
  },
})

export const userPreflightWorkflow = createWorkflow({
  id: 'userPreflightWorkflow',
  inputSchema: z.object({
    targetUserId: z.number().positive(),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    user: z
      .object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        role: z.string(),
        disabledAt: z.number().nullable(),
      })
      .optional(),
    pendingCount: z.number(),
    error: z.string().optional(),
  }),
})
  .then(lookupUserAndCountStep)
  .commit()
