import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod/v4'
import { db } from '../../../db.ts'

export type UserWithPending = {
  id: number
  name: string
  email: string
  pendingCount: number
}

export const checkLockedUsersPendingAppointments = createStep({
  id: 'check-locked-users-pending-appts',
  inputSchema: z.object({}),
  outputSchema: z.object({
    lockedUsers: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        pendingCount: z.number(),
      }),
    ),
    lockedTotal: z.number(),
  }),
  execute: async () => {
    let now = new Date()
    now.setUTCHours(0, 0, 0, 0)
    let todayMidnight = now.getTime()
    let result = await db.exec(
      `SELECT u.id, u.name, u.email, count(a.id)::int AS "pendingCount"
       FROM users u
       LEFT JOIN appointments a ON a.user_id = u.id AND a.date >= $1
       WHERE u.disabled_at IS NOT NULL
       GROUP BY u.id, u.name, u.email
       ORDER BY u.name`,
      [todayMidnight],
    )
    let users = (result.rows ?? []) as UserWithPending[]
    let total = users.reduce((sum, u) => sum + u.pendingCount, 0)
    return { lockedUsers: users, lockedTotal: total }
  },
})

export const checkActiveUsersPendingAppointments = createStep({
  id: 'check-active-users-pending-appts',
  inputSchema: z.object({}),
  outputSchema: z.object({
    activeUsers: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        pendingCount: z.number(),
      }),
    ),
    activeTotal: z.number(),
  }),
  execute: async () => {
    let now = new Date()
    now.setUTCHours(0, 0, 0, 0)
    let todayMidnight = now.getTime()
    let result = await db.exec(
      `SELECT u.id, u.name, u.email, count(a.id)::int AS "pendingCount"
       FROM users u
       LEFT JOIN appointments a ON a.user_id = u.id AND a.date >= $1
       WHERE u.disabled_at IS NULL
       GROUP BY u.id, u.name, u.email
       ORDER BY u.name`,
      [todayMidnight],
    )
    let users = (result.rows ?? []) as UserWithPending[]
    let total = users.reduce((sum, u) => sum + u.pendingCount, 0)
    return { activeUsers: users, activeTotal: total }
  },
})

export const consistencyCheckWorkflow = createWorkflow({
  id: 'consistencyCheckWorkflow',
  inputSchema: z.object({}),
  outputSchema: z.object({
    lockedUsers: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        pendingCount: z.number(),
      }),
    ),
    lockedTotal: z.number(),
    activeUsers: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        pendingCount: z.number(),
      }),
    ),
    activeTotal: z.number(),
  }),
})
  .parallel([checkLockedUsersPendingAppointments, checkActiveUsersPendingAppointments])
  .commit()
