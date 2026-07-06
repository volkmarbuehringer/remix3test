import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { pool } from '../../../data/connection.ts'

export const supportTools = {
  lookupUser: createTool({
    id: 'lookup_user',
    description: 'Look up a user by ID or email address. Returns id, name, email, role, and account status.',
    inputSchema: z.object({
      query: z.string().min(1).max(200).describe('Numeric user ID or email address'),
    }),
    execute: async ({ query }) => {
      let client = await pool.connect()
      try {
        let isNumeric = /^\d+$/.test(query)
        let result
        if (isNumeric) {
          result = await client.query(
            'SELECT id, email, name, role, email_verified, created_at FROM users WHERE id = $1 OR email = $2 LIMIT 1',
            [Number(query), query],
          )
        } else {
          result = await client.query(
            'SELECT id, email, name, role, email_verified, created_at FROM users WHERE email = $1 LIMIT 1',
            [query],
          )
        }
        let rows = result.rows
        if (rows.length === 0) return { found: false, message: 'No user found matching that query' }
        let user = rows[0]
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
      } finally {
        client.release()
      }
    },
  }),

  listRecentAppointments: createTool({
    id: 'list_recent_appointments',
    description: 'List recent appointments. Optionally filter by user_id. Returns id, title, date, time range, and user name.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).optional().default(10).describe('Maximum appointments to return (1-50)'),
      userId: z.number().int().optional().describe('Filter by user ID'),
    }),
    execute: async ({ limit, userId }) => {
      let client = await pool.connect()
      try {
        let whereClause = userId !== undefined ? ' AND a.user_id = $2' : ''
        let query = `SELECT a.id, a.title, a.date, a.during, a.user_id, u.name as user_name
          FROM appointments a LEFT JOIN users u ON a.user_id = u.id
          WHERE 1=1${whereClause}
          ORDER BY a.created_at DESC LIMIT $1`
        let params: unknown[] = [limit]
        if (userId !== undefined) params.push(userId)
        let result = await client.query(query, params)
        return {
          count: result.rows.length,
          appointments: result.rows.map(r => ({
            id: r.id,
            title: r.title,
            date: r.date,
            timeRange: r.during,
            userName: r.user_name ?? 'Unknown',
          })),
        }
      } finally {
        client.release()
      }
    },
  }),

  countUsers: createTool({
    id: 'count_users',
    description: 'Count total users, optionally filtered by role (e.g. "admin", "customer"). Returns counts grouped by role.',
    inputSchema: z.object({
      role: z.string().optional().describe('Filter by role (e.g. "admin" or "customer")'),
    }),
    execute: async ({ role }) => {
      let client = await pool.connect()
      try {
        let whereClause = role ? ' WHERE role = $1' : ''
        let query = `SELECT role, count(*)::int as count FROM users${whereClause} GROUP BY role ORDER BY role`
        let params: unknown[] = role ? [role] : []
        let result = await client.query(query, params)
        let byRole: Record<string, number> = {}
        for (let r of result.rows) {
          byRole[r.role] = r.count
        }
        let total = Object.values(byRole).reduce((a, b) => a + b, 0)
        return { total, byRole }
      } finally {
        client.release()
      }
    },
  }),

  getCurrentDateTime: createTool({
    id: 'get_current_date_time',
    description: 'Get the current date and time. Returns today\'s date, day of week, and current time. Useful for determining context like "today", "this week", "this month" queries.',
    inputSchema: z.object({}),
    execute: async () => {
      let now = new Date()
      let deFormatter = new Intl.DateTimeFormat('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
      return {
        iso: now.toISOString(),
        formatted: deFormatter.format(now),
        weekday: now.toLocaleDateString('en-US', { weekday: 'long' }),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        unixMs: now.getTime(),
      }
    },
  }),
}
