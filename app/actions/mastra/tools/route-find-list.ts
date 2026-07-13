import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { pool } from '../../../data/connection.ts'

export const findList = createTool({
  id: 'find_list',
  description: 'Search for lists by description or item labels. Returns matching list IDs and descriptions with pagination info.',
  inputSchema: z.object({
    search: z.string().optional().describe('Text to search for in list descriptions or item labels (e.g. "abx", "shopping", "todo")'),
    sort: z.enum(['newest', 'oldest']).optional().describe('Sort order: "newest" (updated_at DESC, default) or "oldest" (updated_at ASC)'),
    limit: z.number().int().min(1).max(50).optional().describe('Maximum results to return (default 10, max 50)'),
    offset: z.number().int().min(0).optional().describe('Number of results to skip for pagination (default 0)'),
  }),
  execute: async ({ search, sort, limit, offset }) => {
    let safeLimit = Math.min(Math.max(limit ?? 10, 1), 50)
    let safeOffset = Math.max(offset ?? 0, 0)
    let orderClause = sort === 'oldest' ? 'ORDER BY updated_at ASC' : 'ORDER BY updated_at DESC'

    let whereClause: string
    let params: unknown[] = []

    if (search && search.trim()) {
      let esc = search.trim().replace(/[%_\\]/g, '\\$&').slice(0, 200)
      let pattern = `%${esc}%`
      whereClause = `WHERE description ILIKE $1 OR EXISTS (SELECT 1 FROM jsonb_array_elements(list) item WHERE item->>'label' ILIKE $1)`
      params.push(pattern)
    } else {
      whereClause = ''
    }

    params.push(safeLimit + 1, safeOffset)

    let orderPos = params.length - 1

    try {
      let query = `SELECT id, description, updated_at FROM lists ${whereClause} ${orderClause} LIMIT $${orderPos} OFFSET $${orderPos + 1}`
      let result = await pool.query(query, params)

      let rows = result.rows.map((r: Record<string, unknown>) => ({
        id: Number(r.id),
        description: String(r.description ?? ''),
        updatedAt: Number(r.updated_at),
      }))

      let hasMore = rows.length > safeLimit
      if (hasMore) rows.pop()

      if (rows.length === 0) {
        let label = search?.trim() ? ` matching "${search.trim()}"` : ''
        return { found: false, message: `No lists found${label}`, hasMore: false }
      }

      return { found: true, lists: rows, hasMore }
    } catch (err) {
      console.error('[findList] query error:', err)
      return { found: false, error: 'Internal search error', hasMore: false }
    }
  },
})
