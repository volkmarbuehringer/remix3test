import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { pool } from '../../../data/connection.ts'

export const findList = createTool({
  id: 'find_list',
  description: 'Search for a list by its description using pattern matching. Returns matching list IDs and descriptions.',
  inputSchema: z.object({
    search: z.string().describe('Text to search for in list descriptions (e.g. "abx", "shopping", "todo")'),
  }),
  execute: async ({ search }) => {
    if (!search || !search.trim()) {
      return { found: false, error: 'Search text is required' }
    }
    let esc = search.trim().replace(/[%_\\]/g, '\\$&').slice(0, 200)
    let pattern = `%${esc}%`
    try {
      let result = await pool.query(
        `SELECT id, description, updated_at FROM lists WHERE description ILIKE $1 ORDER BY updated_at DESC LIMIT 10`,
        [pattern],
      )
      let rows = result.rows.map((r: Record<string, unknown>) => ({
        id: Number(r.id),
        description: String(r.description ?? ''),
        updatedAt: Number(r.updated_at),
      }))
      if (rows.length === 0) {
        return { found: false, message: `No lists found matching "${search.trim()}"` }
      }
      return { found: true, lists: rows }
    } catch (err) {
      console.error('[findList] query error:', err)
      return { found: false, error: 'Internal search error' }
    }
  },
})
