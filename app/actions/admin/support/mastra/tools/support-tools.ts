import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import type { Database } from 'remix/data-table'

export function createSupportTools(db: Database) {
  let lookupUser = createTool({
    id: 'lookup_user',
    description: 'Look up a user by ID or email address. Returns id, name, email, role, and account status.',
    inputSchema: z.object({
      query: z.string().min(1).max(200).describe('Numeric user ID or email address'),
    }),
    execute: async ({ query }) => {
      let isNumeric = /^\d+$/.test(query)
      let result
      if (isNumeric) {
        result = await db.exec(
          'SELECT id, email, name, role, email_verified, created_at FROM users WHERE id = $1 OR email = $2 LIMIT 1',
          [Number(query), query],
        )
      } else {
        result = await db.exec(
          'SELECT id, email, name, role, email_verified, created_at FROM users WHERE email = $1 LIMIT 1',
          [query],
        )
      }
      let rows = result.rows ?? []
      if (rows.length === 0) return { found: false, message: 'No user found matching that query' }
      let user = rows[0] as Record<string, unknown>
      return {
        found: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.email_verified === 1 ? 'yes' : 'no',
          createdAt: user.created_at,
        },
      }
    },
  })

  let listRecentAppointments = createTool({
    id: 'list_recent_appointments',
    description: 'List recent appointments. Optionally filter by user_id. Returns id, title, date, time range, and user name.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).optional().default(10).describe('Maximum appointments to return (1-50)'),
      userId: z.number().int().optional().describe('Filter by user ID'),
    }),
    execute: async ({ limit, userId }) => {
      let whereClause = userId !== undefined ? ' AND a.user_id = $2' : ''
      let query = `SELECT a.id, a.title, a.date, a.during, a.user_id, u.name as user_name
        FROM appointments a LEFT JOIN users u ON a.user_id = u.id
        WHERE 1=1${whereClause}
        ORDER BY a.created_at DESC LIMIT $1`
      let params: unknown[] = [limit]
      if (userId !== undefined) params.push(userId)
      let result = await db.exec(query, params)
      let rows = result.rows ?? []
      return {
        count: rows.length,
        appointments: rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          title: r.title,
          date: r.date,
          timeRange: r.during,
          userName: r.user_name ?? 'Unknown',
        })),
      }
    },
  })

  let countUsers = createTool({
    id: 'count_users',
    description: 'Count total users, optionally filtered by role (e.g. "admin", "customer"). Returns counts grouped by role.',
    inputSchema: z.object({
      role: z.string().optional().describe('Filter by role (e.g. "admin" or "customer")'),
    }),
    execute: async ({ role }) => {
      let whereClause = role ? ' WHERE role = $1' : ''
      let query = `SELECT role, count(*)::int as count FROM users${whereClause} GROUP BY role ORDER BY role`
      let params: unknown[] = role ? [role] : []
      let result = await db.exec(query, params)
      let rows = result.rows ?? []
      let byRole = Object.fromEntries(
        (rows as Array<Record<string, unknown>>).map(r => [r.role, r.count])
      )
      let total = Object.values(byRole).reduce((a: number, b: unknown) => a + (b as number), 0)
      return { total, byRole }
    },
  })

  return { lookupUser, listRecentAppointments, countUsers }
}
