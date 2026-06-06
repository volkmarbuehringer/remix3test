import { registerWorkflow } from '../registry.ts'
import type { Workflow } from '../types.ts'

const trendingReportWorkflow: Workflow = async function* (context, params) {
  let genre = params.genre as string | undefined

  yield { id: 'query', name: 'Querying books', status: 'running' }

  let sampleBooks = [
    { id: 1, title: 'Popular Book 1', author: 'Author A' },
    { id: 2, title: 'Popular Book 2', author: 'Author B' },
  ]

  yield {
    id: 'query',
    name: 'Querying books',
    status: 'completed',
    output: { count: sampleBooks.length },
  }

  return {
    count: sampleBooks.length,
    books: sampleBooks,
  }
}

registerWorkflow({
  id: 'trending-report',
  name: 'Trending Report',
  description: 'Generate a report on trending books',
  parameters: [
    { name: 'genre', type: 'string', required: false, description: 'Filter by genre' },
  ],
  tools: ['search_wikipedia'],
  run: trendingReportWorkflow,
})
