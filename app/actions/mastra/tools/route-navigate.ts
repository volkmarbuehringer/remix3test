import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'

export const routeNavigate = createTool({
  id: 'navigate',
  description: 'Navigate the user to a page in the app. Use when the user wants to see a specific view like lists, appointments, settings, etc.',
  inputSchema: z.object({
    path: z.string().describe('Route path, e.g. /lists or /admin/nutzer'),
    query: z.record(z.string(), z.string()).optional().describe('Query parameters, e.g. { load: "5", filter: "active" }'),
  }),
  execute: async ({ path, query }) => {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
      return { type: 'error', error: 'path must be a relative route starting with /' }
    }
    let beforeQuery = path.includes('?') ? path.slice(0, path.indexOf('?')) : path
    if (/[:]/.test(beforeQuery)) {
      return { type: 'error', error: 'path must not contain a URL scheme' }
    }
    let params = new URLSearchParams(query)
    let qs = params.toString()
    let separator = path.includes('?') ? '&' : '?'
    return { type: 'route', path: qs ? `${path}${separator}${qs}` : path }
  },
})
