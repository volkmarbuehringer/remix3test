import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import { db } from '../../../db.ts'
import { sql } from 'remix/data-table'
import { int8, queryRow } from '../../../data/rows.ts'
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
    let row = await queryRow(
      db,
      sql`SELECT id, email, name, role, disabled_at FROM users WHERE id = ${inputData.targetUserId}`,
      z.object({
        id: z.number(),
        email: z.string(),
        name: z.string(),
        role: z.string(),
        disabled_at: int8.nullable(),
      }),
    )
    if (!row) {
      return { found: false, pendingCount: 0, error: 'User not found' }
    }

    let todayMidnight = getTodayUtcMidnight()
    let countRow = await queryRow(
      db,
      sql`SELECT count(*)::int AS count FROM appointments WHERE user_id = ${inputData.targetUserId} AND date >= ${todayMidnight}`,
      z.object({ count: z.number() }),
    )

    return {
      found: true,
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        disabledAt: row.disabled_at,
      },
      pendingCount: countRow?.count ?? 0,
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
