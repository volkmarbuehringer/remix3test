import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { pool } from '../../../data/connection.ts'

// German stop words that add no search value
const STOP_WORDS = new Set([
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr',
  'der', 'die', 'das', 'den', 'dem', 'des',
  'ein', 'eine', 'einen', 'einem', 'eines',
  'mein', 'dein', 'sein', 'unser', 'euer',
  'dieser', 'diese', 'dieses',
  'und', 'oder', 'aber', 'denn', 'doch', 'sondern', 'auch',
  'für', 'auf', 'an', 'in', 'über', 'unter', 'neben', 'zwischen',
  'mit', 'von', 'zu', 'nach', 'bei', 'aus', 'durch', 'um',
  'ist', 'sind', 'war', 'wird', 'werden', 'wurde', 'bin', 'bist',
  'hat', 'haben', 'hast', 'habe',
  'nicht', 'kein', 'keine',
  'mal', 'schon', 'noch', 'bereits', 'bitte', 'danke',
  'einfach', 'gerne', 'gern', 'sehr', 'viel', 'wenig',
  'man', 'kann', 'können', 'muss', 'müssen', 'soll', 'sollen',
  'will', 'wollen', 'darf', 'dürfen', 'mag', 'mögen',
  'brauche', 'brauchen', 'möchte', 'möchtest',
  'würde', 'würden', 'hätte', 'hätten',
  'wenn', 'weil', 'dass', 'da', 'als', 'wie',
  'etwas', 'alles', 'nichts', 'jemand', 'niemand',
  'hier', 'dort', 'dahin', 'dorthin',
  'jetzt', 'sofort', 'später', 'heute', 'morgen', 'gestern',
  'ihnen', 'ihm', 'ihn', 'uns', 'euch',
])

export const customerTools = {
  searchResourcesByCapability: createTool({
    id: 'search_resources_by_capability',
    description: 'Search resources by their capabilities. Accepts a free-text problem description and returns matching resources whose capabilities best match the query. Returns resource id, name, description, and capabilities text.',
    inputSchema: z.object({
      query: z.string().min(1).max(500).describe('The customer problem description or search terms to match against resource capabilities'),
    }),
    execute: async ({ query }) => {
      let client = await pool.connect()
      try {
        let terms = query
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean)
          .map(t => t.replace(/[^a-zA-Zäöüß0-9-]/g, ''))
          .filter(t => t.length > 1 && !STOP_WORDS.has(t))

        if (terms.length === 0) {
          return { count: 0, resources: [] }
        }

        let conditions = terms.map((_, i) => `capabilities ILIKE '%' || $${i + 1} || '%'`)
        let params = terms

        // Build ranked query — each matching term adds 1 to rank
        let rankExpr = terms
          .map((_, i) => `CASE WHEN capabilities ILIKE '%' || $${i + 1} || '%' THEN 1 ELSE 0 END`)
          .join(' + ')

        let result = await client.query(
          `SELECT id, name, description, capabilities, (${rankExpr})::int AS rank
           FROM resources
           WHERE capabilities IS NOT NULL AND capabilities != ''
             AND (${conditions.join(' OR ')})
           ORDER BY rank DESC, name ASC
           LIMIT 20`,
          params,
        )

        return {
          count: result.rows.length,
          resources: result.rows.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            capabilities: r.capabilities,
          })),
        }
      } finally {
        client.release()
      }
    },
  }),
}
